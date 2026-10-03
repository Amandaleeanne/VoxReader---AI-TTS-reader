import { SentenceItem, VoiceSettings, WordToken } from '../types';
import { decodeHtmlAndNormalizeQuotes } from '../utils/textParser';

export interface TTSCallbacks {
  onSentenceChange?: (sentenceIndex: number) => void;
  onWordBoundary?: (wordIndex: number | null, charIndex: number) => void;
  onStateChange?: (isPlaying: boolean, isBuffering: boolean) => void;
  onError?: (error: string) => void;
  onFinish?: () => void;
}

/**
 * Hashed dictionary of short, unstressed monosyllabic function words (clitics).
 * In natural and neural speech synthesis, these words undergo vowel reduction (schwa)
 * and co-articulation, speaking in 30-40% of the duration of stressed content words.
 */
export const SHORT_FUNCTION_WORDS = new Set<string>([
  // Articles & demonstratives
  'a', 'an', 'the',
  // Prepositions
  'in', 'on', 'at', 'to', 'by', 'of', 'for', 'up', 'as', 'into', 'from', 'with', 'off',
  // Conjunctions
  'and', 'or', 'but', 'nor', 'so', 'if', 'than', 'that',
  // Pronouns
  'it', 'its', 'he', 'she', 'we', 'me', 'us', 'him', 'my', 'his', 'her', 'our', 'you',
  // Auxiliary & copular verbs
  'is', 'am', 'are', 'was', 'be', 'do', 'did', 'has', 'had', 'can', 'may'
]);

/**
 * Estimate word boundaries for audio playback with dynamic timing adjustment.
 * At playback rates above 1.5x, pauses around punctuation are compressed aggressively
 * by neural TTS synthesizers and audio time-stretch DSP algorithms compared to voiced phonemes.
 * Uses a hashed dictionary to fine-tune short monosyllabic words so highlighting moves briskly.
 */
export function calculateWordTimings(
  words: WordToken[],
  totalDurationSeconds: number,
  playbackRate: number = 1.0
): { wordIndex: number; startTime: number; endTime: number }[] {
  if (words.length === 0 || totalDurationSeconds <= 0) return [];

  // Dynamic pause compression factor for high-speed playback (> 1.5x)
  const pauseFactor =
    playbackRate > 1.5
      ? Math.max(0.35, 1.0 / (1.0 + (playbackRate - 1.5) * 0.85))
      : 1.0;

  const weights = words.map((w, i) => {
    const clean = (w.cleanWord || w.word).toLowerCase().replace(/[^a-z0-9]/g, '');
    const isShort = SHORT_FUNCTION_WORDS.has(clean);
    const nextClean =
      i + 1 < words.length
        ? (words[i + 1].cleanWord || words[i + 1].word).toLowerCase().replace(/[^a-z0-9]/g, '')
        : '';
    const nextIsShort = SHORT_FUNCTION_WORDS.has(nextClean);

    let weight: number;
    if (isShort) {
      // High-speed clitic phonetics: short monosyllables speak in reduced, rapid durations
      if (clean.length === 1) weight = 0.65;
      else if (clean.length === 2) weight = 0.85;
      else weight = 1.05;
    } else {
      const len = clean.length || w.word.length;
      weight = len <= 2 ? 1.4 : Math.pow(len, 0.85) * 1.5;
    }

    // Dynamic co-articulation adjustment:
    // If the next word is in the hashed dictionary of fast-spoken short words,
    // the speaker articulates forward directly into it, so the highlight does not stay on for as long.
    if (nextIsShort && !isShort) {
      weight *= 0.88;
    }

    // Dynamically scaled punctuation pause weights
    if (/[,;:]/.test(w.word)) weight += 1.8 * pauseFactor;
    if (/[.?!]/.test(w.word)) weight += 2.8 * pauseFactor;
    return weight;
  });

  const totalWeight = weights.reduce((acc, val) => acc + val, 0);
  const timings: { wordIndex: number; startTime: number; endTime: number }[] = [];

  let currentSec = 0;
  for (let i = 0; i < words.length; i++) {
    const fraction = weights[i] / totalWeight;
    const wordDuration = fraction * totalDurationSeconds;
    timings.push({
      wordIndex: i,
      startTime: currentSec,
      endTime: currentSec + wordDuration,
    });
    currentSec += wordDuration;
  }

  return timings;
}

export class TTSController {
  private sentences: SentenceItem[] = [];
  private currentIndex: number = 0;
  private settings: VoiceSettings;
  private callbacks: TTSCallbacks;

  private isPlaying: boolean = false;
  private isBuffering: boolean = false;

  // Web Speech API
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastReportedWordIndex: number | null = null;

  // Dual-buffered audio players for gapless, zero-pause server TTS playback
  private primaryAudio: HTMLAudioElement | null = null;
  private secondaryAudio: HTMLAudioElement | null = null;
  private activePlayerIndex: 0 | 1 = 0; // 0 for primary, 1 for secondary
  private preloadedIndex: number | null = null;
  private isPreloadPending: boolean = false;

  // Audio cache to save tokens and eliminate repeat fetch delays
  private audioCache = new Map<string, string>();
  private inFlightFetches = new Map<string, Promise<string>>();
  private wordTimings: { wordIndex: number; startTime: number; endTime: number }[] = [];
  private timeUpdateAnimFrame: number | null = null;
  private isTransitioning: boolean = false;

  constructor(settings: VoiceSettings, callbacks: TTSCallbacks = {}) {
    this.settings = settings;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      this.primaryAudio = new Audio();
      this.secondaryAudio = new Audio();
      this.setupAudioListeners();
    }
  }

  private getActiveAudio(): HTMLAudioElement | null {
    return this.activePlayerIndex === 0 ? this.primaryAudio : this.secondaryAudio;
  }

  private getStandbyAudio(): HTMLAudioElement | null {
    return this.activePlayerIndex === 0 ? this.secondaryAudio : this.primaryAudio;
  }

  public updateSettings(newSettings: VoiceSettings) {
    const engineChanged = this.settings.engine !== newSettings.engine;
    const voiceChanged =
      this.settings.geminiVoice !== newSettings.geminiVoice ||
      this.settings.edgeVoice !== newSettings.edgeVoice ||
      this.settings.openAIVoice !== newSettings.openAIVoice ||
      this.settings.elevenLabsVoiceId !== newSettings.elevenLabsVoiceId ||
      this.settings.webSpeechVoiceURI !== newSettings.webSpeechVoiceURI;
    const rateChanged = this.settings.rate !== newSettings.rate;

    this.settings = newSettings;

    if (rateChanged) {
      if (this.primaryAudio) {
        this.primaryAudio.defaultPlaybackRate = this.settings.rate;
        this.primaryAudio.playbackRate = this.settings.rate;
      }
      if (this.secondaryAudio) {
        this.secondaryAudio.defaultPlaybackRate = this.settings.rate;
        this.secondaryAudio.playbackRate = this.settings.rate;
      }
      // Recompute dynamic timings on the fly with the new playback rate
      const active = this.getActiveAudio();
      const currentSentence = this.sentences[this.currentIndex];
      if (active && currentSentence && active.duration) {
        this.wordTimings = calculateWordTimings(
          currentSentence.words,
          active.duration,
          this.settings.rate
        );
      }

      // Immediately trigger more aggressive pre-fetching when speed increases
      if (this.isPlaying) {
        this.triggerDynamicPrefetch(this.currentIndex);
      }
    }

    if (this.isPlaying && (engineChanged || voiceChanged)) {
      this.playSentence(this.currentIndex, true);
    }
  }

  public setSentences(sentences: SentenceItem[], startIndex: number = 0) {
    this.stop();
    this.sentences = sentences;
    this.currentIndex = Math.max(0, Math.min(startIndex, sentences.length - 1));
    this.preloadedIndex = null;
    this.isPreloadPending = false;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsBuffering(): boolean {
    return this.isBuffering;
  }

  public async play() {
    if (this.sentences.length === 0) return;
    this.isPlaying = true;
    this.notifyState();
    await this.playSentence(this.currentIndex, false);
    this.triggerDynamicPrefetch(this.currentIndex);
  }

  public pause() {
    this.isPlaying = false;
    this.isBuffering = false;
    this.cancelSpeech();
    this.notifyState();
  }

  public stop() {
    this.isPlaying = false;
    this.isBuffering = false;
    this.cancelSpeech();
    this.callbacks.onWordBoundary?.(null, 0);
    this.notifyState();
  }

  public async jumpToSentence(index: number, autoPlay: boolean = true) {
    if (index < 0 || index >= this.sentences.length) return;
    this.currentIndex = index;
    this.callbacks.onSentenceChange?.(this.currentIndex);
    this.callbacks.onWordBoundary?.(null, 0);

    if (autoPlay) {
      this.isPlaying = true;
      this.notifyState();
      await this.playSentence(this.currentIndex, true);
      this.triggerDynamicPrefetch(this.currentIndex);
    } else {
      this.cancelSpeech();
      this.isPlaying = false;
      this.notifyState();
    }
  }

  public async nextSentence() {
    if (this.currentIndex + 1 < this.sentences.length) {
      // Natural continuous transition - do not interrupt or wipe audio pipelines
      await this.playSentence(this.currentIndex + 1, false);
    } else {
      this.stop();
      this.callbacks.onFinish?.();
    }
  }

  public async prevSentence() {
    if (this.currentIndex - 1 >= 0) {
      await this.jumpToSentence(this.currentIndex - 1, this.isPlaying);
    }
  }

  public async replayCurrent() {
    await this.jumpToSentence(this.currentIndex, true);
  }

  /**
   * Only called on manual user action (pause, stop, jump), never between sequential sentences!
   */
  private cancelSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;

    if (this.primaryAudio) {
      this.primaryAudio.pause();
      this.primaryAudio.currentTime = 0;
    }
    if (this.secondaryAudio) {
      this.secondaryAudio.pause();
      this.secondaryAudio.currentTime = 0;
    }
    if (this.timeUpdateAnimFrame) {
      cancelAnimationFrame(this.timeUpdateAnimFrame);
      this.timeUpdateAnimFrame = null;
    }
    this.lastReportedWordIndex = null;
    this.preloadedIndex = null;
    this.isPreloadPending = false;
    this.isTransitioning = false;
    this.inFlightFetches.clear();
  }

  private async playSentence(index: number, isManualJump: boolean = false) {
    const sentence = this.sentences[index];
    if (!sentence || !this.isPlaying) return;

    if (isManualJump) {
      this.currentIndex = index;
      this.callbacks.onSentenceChange?.(index);
    }

    if (this.settings.engine === 'webspeech') {
      this.playViaWebSpeech(sentence, isManualJump);
    } else {
      await this.playViaServerTTS(sentence, index, isManualJump);
    }
  }

  // --- Web Speech API (Offline, Gapless, No False Pauses on Periods) ---
  private playViaWebSpeech(sentence: SentenceItem, isManualJump: boolean) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.callbacks.onError?.('Web Speech API is not supported in this browser.');
      return;
    }

    // Only cancel speech synthesis on a manual user jump to prevent audio pipeline stutter
    if (isManualJump) {
      window.speechSynthesis.cancel();
    }

    const cleanSpokenText = decodeHtmlAndNormalizeQuotes(sentence.text).replace(
      /\[([^\]]+)\]\([^\s)]+\)/g,
      '$1'
    );
    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    this.currentUtterance = utterance;

    const voices = window.speechSynthesis.getVoices();
    if (this.settings.webSpeechVoiceURI) {
      const match = voices.find((v) => v.voiceURI === this.settings.webSpeechVoiceURI);
      if (match) utterance.voice = match;
    }

    utterance.rate = Math.max(0.5, Math.min(this.settings.rate, 3.0));
    utterance.pitch = Math.max(0.5, Math.min(this.settings.pitch, 1.5));
    utterance.volume = Math.max(0, Math.min(this.settings.volume, 1.0));

    // Synchronize sentence text highlighting at the exact moment speech starts
    utterance.onstart = () => {
      if (!this.isPlaying) return;
      this.currentIndex = sentence.globalIndex;
      this.callbacks.onSentenceChange?.(sentence.globalIndex);
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.charIndex !== undefined) {
        const charIdx = event.charIndex;
        const words = sentence.words;
        let foundWordIdx: number | null = null;

        for (let i = 0; i < words.length; i++) {
          if (charIdx >= words[i].startIndex && charIdx <= words[i].endIndex + 1) {
            foundWordIdx = i;
            break;
          }
        }

        if (foundWordIdx === null) {
          for (let i = 0; i < words.length; i++) {
            if (words[i].startIndex >= charIdx) {
              foundWordIdx = Math.max(0, i - 1);
              break;
            }
          }
          if (foundWordIdx === null && words.length > 0) {
            foundWordIdx = words.length - 1;
          }
        }

        if (foundWordIdx !== this.lastReportedWordIndex) {
          this.lastReportedWordIndex = foundWordIdx;
          this.callbacks.onWordBoundary?.(foundWordIdx, charIdx);
        }
      }
    };

    utterance.onend = () => {
      this.lastReportedWordIndex = null;
      this.callbacks.onWordBoundary?.(null, 0);
      if (this.isPlaying) {
        // Instant seamless advance without cancelling synthesis pipeline!
        this.nextSentence();
      }
    };

    utterance.onerror = (e) => {
      if (e.error && e.error !== 'interrupted' && e.error !== 'canceled' && e.error !== 'not-allowed') {
        console.warn('Speech synthesis notice:', e);
      }
    };

    this.isBuffering = false;
    this.notifyState();
    if (typeof window !== 'undefined') {
      (window as any).__vox_active_utterance = utterance;
    }
    window.speechSynthesis.speak(utterance);
  }

  // --- Server TTS (EdgeTTS, Gemini, OpenAI, ElevenLabs) with Dual-Buffering ---
  private getCacheKey(sentence: SentenceItem): string {
    const engine = this.settings.engine;
    let voice = '';
    if (engine === 'gemini') voice = this.settings.geminiVoice;
    else if (engine === 'edgetts') voice = this.settings.edgeVoice || 'en-US-AriaNeural';
    else if (engine === 'openai') voice = this.settings.openAIVoice || 'alloy';
    else if (engine === 'elevenlabs') voice = this.settings.elevenLabsVoiceId || 'default';

    const textSample = sentence.text.trim().slice(0, 100);
    return `${engine}:${voice}:${sentence.words.length}:${textSample}`;
  }

  private async fetchAudioUrl(sentence: SentenceItem): Promise<string> {
    const cacheKey = this.getCacheKey(sentence);
    const cached = this.audioCache.get(cacheKey);
    if (cached) return cached;

    // Deduplicate concurrent fetch requests for the same sentence
    const inFlight = this.inFlightFetches.get(cacheKey);
    if (inFlight) return inFlight;

    let endpoint = '/api/tts/gemini';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const cleanSpoken = decodeHtmlAndNormalizeQuotes(sentence.text)
      .replace(/\[([^\]]+)\]\([^\s)]+\)/g, '$1')
      .trim();
    let body: any = { text: cleanSpoken };

    if (this.settings.engine === 'edgetts') {
      endpoint = '/api/tts/edge';
      body.voice = this.settings.edgeVoice || 'en-US-AriaNeural';
    } else if (this.settings.engine === 'openai') {
      endpoint = '/api/tts/openai';
      body.voice = this.settings.openAIVoice || 'alloy';
      body.speed = this.settings.rate;
      if (this.settings.customOpenAIKey) {
        headers['x-openai-key'] = this.settings.customOpenAIKey.trim();
      }
    } else if (this.settings.engine === 'elevenlabs') {
      endpoint = '/api/tts/elevenlabs';
      body.voiceId = this.settings.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
      if (this.settings.customElevenLabsKey) {
        headers['x-elevenlabs-key'] = this.settings.customElevenLabsKey.trim();
      }
    } else {
      // Gemini
      body.voice = this.settings.geminiVoice;
      if (this.settings.customGeminiKey) {
        headers['x-gemini-key'] = this.settings.customGeminiKey.trim();
      }
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `TTS request failed with status ${res.status}`);
        }

        const data = await res.json();
        if (!data.audioBase64) {
          throw new Error('No audio returned from speech service.');
        }

        const mime = data.mimeType || (this.settings.engine === 'gemini' ? 'audio/wav' : 'audio/mp3');
        const audioUrl = `data:${mime};base64,${data.audioBase64}`;
        this.audioCache.set(cacheKey, audioUrl);
        return audioUrl;
      } catch (err: any) {
        // If Gemini hit quota or failed, automatically fall back to EdgeTTS
        if (this.settings.engine === 'gemini') {
          try {
            const edgeRes = await fetch('/api/tts/edge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: sentence.text.trim(),
                voice: 'en-US-AriaNeural',
              }),
            });
            if (edgeRes.ok) {
              const edgeData = await edgeRes.json();
              if (edgeData.audioBase64) {
                const audioUrl = `data:audio/mp3;base64,${edgeData.audioBase64}`;
                this.audioCache.set(cacheKey, audioUrl);
                return audioUrl;
              }
            }
          } catch {
            // ignore fallback error
          }
        }
        throw err;
      }
    })().finally(() => {
      this.inFlightFetches.delete(cacheKey);
    });

    this.inFlightFetches.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Calculates dynamic pre-fetch lookahead based on speed rate.
   * Faster playback accelerates sentence completion; we scale up to 10 sentences
   * ahead so upcoming paragraphs are fully pre-rendered and pre-cached before reaching them.
   */
  private getPrefetchLookaheadCount(): number {
    const rate = this.settings.rate || 1.0;
    if (rate <= 1.25) return 2;   // Normal speed: 2 sentences ahead
    if (rate <= 1.75) return 4;   // 1.5x: 4 sentences ahead (~1 paragraph)
    if (rate <= 2.25) return 6;   // 2.0x: 6 sentences ahead (~1-2 paragraphs)
    if (rate <= 2.75) return 8;   // 2.5x: 8 sentences ahead (~2-3 paragraphs)
    return 10;                    // 3.0x+: 10 sentences ahead (~3-4 paragraphs)
  }

  /**
   * Pre-loads the immediate next sentence into the standby player so that when the current sentence
   * hits a period and ends, the next sentence starts with 0ms delay and zero loading.
   */
  private async preloadNextSentence(nextIndex: number) {
    if (nextIndex >= this.sentences.length) return;
    if (this.preloadedIndex === nextIndex || this.isPreloadPending) return;

    this.isPreloadPending = true;
    const nextSentence = this.sentences[nextIndex];
    const standby = this.getStandbyAudio();
    if (!standby) {
      this.isPreloadPending = false;
      return;
    }

    try {
      const audioUrl = await this.fetchAudioUrl(nextSentence);
      if (this.isPlaying) {
        standby.pause();
        standby.currentTime = 0;
        standby.defaultPlaybackRate = this.settings.rate;
        standby.playbackRate = this.settings.rate;
        standby.volume = this.settings.volume;
        standby.src = audioUrl;
        standby.load();
        // ONLY mark as preloaded after audio URL is loaded and ready
        this.preloadedIndex = nextIndex;
      }
    } catch {
      // background preload error is non-fatal
    } finally {
      this.isPreloadPending = false;
    }
  }

  /**
   * Dynamically pre-fetches audio sentences ahead of the current playback position.
   * Scales aggressively with playback rate: at 3x speed, warms up to 10 sentences ahead
   * so whole paragraphs are pre-cached in memory for instantaneous zero-latency playback.
   */
  private triggerDynamicPrefetch(fromIndex: number) {
    if (!this.isPlaying || this.settings.engine === 'webspeech') return;

    const lookahead = this.getPrefetchLookaheadCount();
    const targetMax = Math.min(fromIndex + lookahead, this.sentences.length - 1);

    // Immediate next sentence is preloaded into standby audio player for gapless swap
    if (fromIndex + 1 <= targetMax) {
      this.preloadNextSentence(fromIndex + 1);
    }

    // Subsequent sentences across upcoming paragraphs are pre-fetched concurrently into audioCache
    const sentencesToWarm: SentenceItem[] = [];
    for (let idx = fromIndex + 2; idx <= targetMax; idx++) {
      const sentence = this.sentences[idx];
      if (sentence) {
        const key = this.getCacheKey(sentence);
        if (!this.audioCache.has(key) && !this.inFlightFetches.has(key)) {
          sentencesToWarm.push(sentence);
        }
      }
    }

    if (sentencesToWarm.length === 0) return;

    // Parallel fetch with concurrency limit of 3 to optimize throughput without browser network congestion
    const concurrency = Math.min(3, sentencesToWarm.length);
    let queueIdx = 0;

    const runWorker = async () => {
      while (queueIdx < sentencesToWarm.length && this.isPlaying) {
        const item = sentencesToWarm[queueIdx++];
        if (!item) break;
        try {
          await this.fetchAudioUrl(item);
        } catch {
          // background pre-fetch error is non-fatal
        }
      }
    };

    for (let i = 0; i < concurrency; i++) {
      runWorker();
    }
  }

  private async playViaServerTTS(sentence: SentenceItem, index: number, isManualJump: boolean) {
    if (this.timeUpdateAnimFrame) {
      cancelAnimationFrame(this.timeUpdateAnimFrame);
      this.timeUpdateAnimFrame = null;
    }

    // Check if the next sentence is already preloaded in the standby player
    const standby = this.getStandbyAudio();
    const isPreloadedInStandby =
      this.preloadedIndex === index &&
      standby &&
      Boolean(standby.src) &&
      !isManualJump;

    if (isPreloadedInStandby) {
      // Instant swap: Standby becomes Active! 0ms latency, zero buffering indicator!
      this.activePlayerIndex = this.activePlayerIndex === 0 ? 1 : 0;
      const active = this.getActiveAudio();
      const previousActive = this.getStandbyAudio();

      // Reset previous active player so it cannot fire phantom ended events
      if (previousActive) {
        previousActive.pause();
        previousActive.currentTime = 0;
      }

      this.preloadedIndex = null;

      if (!active || !this.isPlaying) return;

      active.defaultPlaybackRate = this.settings.rate;
      active.playbackRate = this.settings.rate;
      active.volume = this.settings.volume;

      try {
        await active.play();
        active.playbackRate = this.settings.rate;

        // Synchronize UI highlight with actual audio start
        this.currentIndex = index;
        this.callbacks.onSentenceChange?.(index);

        this.startAudioWordTracking(sentence, active);
        this.triggerDynamicPrefetch(index);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Otherwise, fetch / retrieve from cache
    let audioUrl: string;
    const cacheKey = this.getCacheKey(sentence);
    const cached = this.audioCache.get(cacheKey);

    if (cached) {
      audioUrl = cached;
    } else {
      // Only show buffering indicator if user manually jumped or network is required
      this.isBuffering = true;
      this.notifyState();

      try {
        audioUrl = await this.fetchAudioUrl(sentence);
      } catch (err: any) {
        this.isBuffering = false;
        this.notifyState();
        console.warn('Server TTS failed, falling back to Web Speech:', err);
        this.playViaWebSpeech(sentence, true);
        return;
      }
    }

    if (!this.isPlaying) return;

    this.isBuffering = false;
    this.notifyState();

    const active = this.getActiveAudio();
    const currentStandby = this.getStandbyAudio();
    if (currentStandby) {
      currentStandby.pause();
      currentStandby.currentTime = 0;
    }
    if (!active) return;

    this.preloadedIndex = null;
    active.pause();
    active.currentTime = 0;
    active.defaultPlaybackRate = this.settings.rate;
    active.playbackRate = this.settings.rate;
    active.volume = this.settings.volume;
    active.src = audioUrl;

    try {
      await active.play();
      active.playbackRate = this.settings.rate;

      // Synchronize UI highlight with actual audio start
      this.currentIndex = index;
      this.callbacks.onSentenceChange?.(index);

      this.startAudioWordTracking(sentence, active);
      // Dynamically pre-fetch lookahead sentences based on playback speed
      this.triggerDynamicPrefetch(index);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Audio play error:', e);
      }
    }
  }

  private setupAudioListeners() {
    const handleEnded = (playerIdx: 0 | 1) => {
      // Only respond if this was the currently active player
      if (this.activePlayerIndex !== playerIdx) return;
      if (!this.isPlaying) return;

      this.lastReportedWordIndex = null;
      this.callbacks.onWordBoundary?.(null, 0);

      if (this.timeUpdateAnimFrame) {
        cancelAnimationFrame(this.timeUpdateAnimFrame);
        this.timeUpdateAnimFrame = null;
      }

      this.nextSentence();
    };

    const enforceRate = (audio: HTMLAudioElement) => {
      audio.defaultPlaybackRate = this.settings.rate;
      audio.playbackRate = this.settings.rate;
    };

    if (this.primaryAudio) {
      this.primaryAudio.onended = () => handleEnded(0);
      this.primaryAudio.onplay = () => this.primaryAudio && enforceRate(this.primaryAudio);
      this.primaryAudio.onplaying = () => this.primaryAudio && enforceRate(this.primaryAudio);
      this.primaryAudio.oncanplay = () => this.primaryAudio && enforceRate(this.primaryAudio);
      this.primaryAudio.onerror = () => {
        if (this.isPlaying && this.activePlayerIndex === 0) {
          this.callbacks.onError?.('Audio playback encountered an issue.');
        }
      };
    }

    if (this.secondaryAudio) {
      this.secondaryAudio.onended = () => handleEnded(1);
      this.secondaryAudio.onplay = () => this.secondaryAudio && enforceRate(this.secondaryAudio);
      this.secondaryAudio.onplaying = () => this.secondaryAudio && enforceRate(this.secondaryAudio);
      this.secondaryAudio.oncanplay = () => this.secondaryAudio && enforceRate(this.secondaryAudio);
      this.secondaryAudio.onerror = () => {
        if (this.isPlaying && this.activePlayerIndex === 1) {
          this.callbacks.onError?.('Audio playback encountered an issue.');
        }
      };
    }
  }

  private startAudioWordTracking(sentence: SentenceItem, audio: HTMLAudioElement) {
    const onLoadedMetadata = () => {
      const duration = audio.duration || 1;
      this.wordTimings = calculateWordTimings(sentence.words, duration, this.settings.rate);
      this.trackAudioWordFrame(sentence, audio);
    };

    if (audio.duration && !isNaN(audio.duration)) {
      onLoadedMetadata();
    } else {
      audio.onloadedmetadata = onLoadedMetadata;
    }
  }

  private trackAudioWordFrame(sentence: SentenceItem, audio: HTMLAudioElement) {
    if (!this.isPlaying || audio.paused) return;

    // Perceptual audio-visual alignment:
    // A micro lead-in of ~20ms compensates for display frame delivery and eye tracking saccades,
    // ensuring word highlights trigger cleanly on phonetic onset rather than lagging behind.
    const perceptualLeadSec = 0.020;
    const effectiveTime = audio.currentTime + perceptualLeadSec;

    let activeWordIndex: number | null = null;

    for (let i = 0; i < this.wordTimings.length; i++) {
      const timing = this.wordTimings[i];
      if (effectiveTime >= timing.startTime && effectiveTime <= timing.endTime) {
        activeWordIndex = timing.wordIndex;
        break;
      }
    }

    if (activeWordIndex === null && this.wordTimings.length > 0) {
      if (effectiveTime < this.wordTimings[0].startTime) {
        activeWordIndex = 0;
      } else {
        activeWordIndex = this.wordTimings.length - 1;
      }
    }

    // Monotonic boundary protection during high-speed continuous playback
    if (this.lastReportedWordIndex !== null && activeWordIndex !== null) {
      if (activeWordIndex < this.lastReportedWordIndex && !audio.seeking && audio.currentTime > 0.08) {
        activeWordIndex = this.lastReportedWordIndex;
      }
    }

    if (activeWordIndex !== this.lastReportedWordIndex) {
      this.lastReportedWordIndex = activeWordIndex;
      this.callbacks.onWordBoundary?.(
        activeWordIndex,
        activeWordIndex !== null ? sentence.words[activeWordIndex]?.startIndex ?? 0 : 0
      );
    }

    this.timeUpdateAnimFrame = requestAnimationFrame(() =>
      this.trackAudioWordFrame(sentence, audio)
    );
  }

  private notifyState() {
    this.callbacks.onStateChange?.(this.isPlaying, this.isBuffering);
  }

  public destroy() {
    this.stop();
    if (this.primaryAudio) {
      this.primaryAudio.pause();
      this.primaryAudio.src = '';
      this.primaryAudio = null;
    }
    if (this.secondaryAudio) {
      this.secondaryAudio.pause();
      this.secondaryAudio.src = '';
      this.secondaryAudio = null;
    }
  }
}
