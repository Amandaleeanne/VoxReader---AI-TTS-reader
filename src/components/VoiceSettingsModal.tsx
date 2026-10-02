import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  WifiOff,
  Radio,
  Sliders,
  Play,
  Check,
  X,
  Key,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GeminiVoiceName, TTSEngineType, VoiceSettings } from '../types';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: VoiceSettings) => void;
}

const GEMINI_VOICES: { name: GeminiVoiceName; title: string; desc: string }[] = [
  { name: 'Kore', title: 'Kore (Default)', desc: 'Calm, balanced, natural flow. Ideal for literature & articles.' },
  { name: 'Puck', title: 'Puck', desc: 'Energetic, expressive, and engaging.' },
  { name: 'Fenrir', title: 'Fenrir', desc: 'Deep, resonant, and authoritative.' },
  { name: 'Charon', title: 'Charon', desc: 'Warm, mature, classic storytelling cadence.' },
  { name: 'Zephyr', title: 'Zephyr', desc: 'Gentle, bright, and soothing clarity.' },
];

const EDGE_VOICES = [
  { id: 'en-US-AriaNeural', title: 'Aria (US Neural)', desc: 'Expressive, clear, natural American English' },
  { id: 'en-US-GuyNeural', title: 'Guy (US Neural)', desc: 'Professional, articulate American English' },
  { id: 'en-US-JennyNeural', title: 'Jenny (US Neural)', desc: 'Warm, conversational American English' },
  { id: 'en-GB-SoniaNeural', title: 'Sonia (UK Neural)', desc: 'Sophisticated, pleasant British English' },
  { id: 'en-GB-RyanNeural', title: 'Ryan (UK Neural)', desc: 'Crisp, modern British English' },
  { id: 'en-AU-NatashaNeural', title: 'Natasha (AU Neural)', desc: 'Bright, cheerful Australian English' },
  { id: 'en-CA-ClaraNeural', title: 'Clara (CA Neural)', desc: 'Smooth, friendly Canadian English' },
];

const OPENAI_VOICES = [
  { id: 'alloy', title: 'Alloy', desc: 'Balanced, versatile' },
  { id: 'echo', title: 'Echo', desc: 'Warm, deep' },
  { id: 'fable', title: 'Fable', desc: 'Expressive British accent' },
  { id: 'onyx', title: 'Onyx', desc: 'Authoritative, calm' },
  { id: 'nova', title: 'Nova', desc: 'Energetic, engaging' },
  { id: 'shimmer', title: 'Shimmer', desc: 'Clear, gentle' },
];

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);

  // Populate browser speech synthesis voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        const sorted = [...voices].sort((a, b) => {
          if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
          if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
          return a.name.localeCompare(b.name);
        });
        setBrowserVoices(sorted);
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  if (!isOpen) return null;

  const handleEngineChange = (engine: TTSEngineType) => {
    onUpdateSettings({ ...settings, engine });
  };

  const handleGeminiVoiceChange = (geminiVoice: GeminiVoiceName) => {
    onUpdateSettings({ ...settings, geminiVoice });
  };

  const handleEdgeVoiceChange = (edgeVoice: string) => {
    onUpdateSettings({ ...settings, edgeVoice });
  };

  const handleOpenAIVoiceChange = (openAIVoice: string) => {
    onUpdateSettings({ ...settings, openAIVoice });
  };

  const handleBrowserVoiceChange = (webSpeechVoiceURI: string) => {
    onUpdateSettings({ ...settings, webSpeechVoiceURI });
  };

  const handleRateChange = (rate: number) => {
    onUpdateSettings({ ...settings, rate: Math.round(rate * 100) / 100 });
  };

  const handlePitchChange = (pitch: number) => {
    onUpdateSettings({ ...settings, pitch: Math.round(pitch * 100) / 100 });
  };

  // Audition voice
  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);

    const previewPhrase = 'Welcome to VoxRead. Reading aloud with synchronized highlighting.';

    if (settings.engine === 'webspeech') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(previewPhrase);
        if (settings.webSpeechVoiceURI) {
          const v = browserVoices.find((x) => x.voiceURI === settings.webSpeechVoiceURI);
          if (v) utterance.voice = v;
        }
        utterance.rate = settings.rate;
        utterance.pitch = settings.pitch;
        utterance.onend = () => setIsPreviewing(false);
        utterance.onerror = () => setIsPreviewing(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPreviewing(false);
      }
      return;
    }

    try {
      let endpoint = '/api/tts/gemini';
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any = { text: previewPhrase };

      if (settings.engine === 'edgetts') {
        endpoint = '/api/tts/edge';
        body.voice = settings.edgeVoice || 'en-US-AriaNeural';
      } else if (settings.engine === 'openai') {
        endpoint = '/api/tts/openai';
        body.voice = settings.openAIVoice || 'alloy';
        if (settings.customOpenAIKey) {
          headers['x-openai-key'] = settings.customOpenAIKey;
        }
      } else if (settings.engine === 'elevenlabs') {
        endpoint = '/api/tts/elevenlabs';
        body.voiceId = settings.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM';
        if (settings.customElevenLabsKey) {
          headers['x-elevenlabs-key'] = settings.customElevenLabsKey;
        }
      } else {
        body.voice = settings.geminiVoice;
        if (settings.customGeminiKey) {
          headers['x-gemini-key'] = settings.customGeminiKey;
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const mime = data.mimeType || (settings.engine === 'gemini' ? 'audio/wav' : 'audio/mp3');
          const audio = new Audio(`data:${mime};base64,${data.audioBase64}`);
          audio.playbackRate = settings.rate;
          audio.onended = () => setIsPreviewing(false);
          audio.onerror = () => setIsPreviewing(false);
          await audio.play();
          return;
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Voice test failed. Check settings or API key.');
      }
    } catch (err) {
      console.warn('Preview failed:', err);
    }
    setIsPreviewing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Voice & Audio Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TTS Model Engine Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Text-To-Speech Engine (Model Swappable)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* EdgeTTS (Free AI) */}
              <button
                type="button"
                onClick={() => handleEngineChange('edgetts')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  settings.engine === 'edgetts'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Radio className="w-3.5 h-3.5 text-cyan-500" />
                    <span>EdgeTTS</span>
                  </div>
                  {settings.engine === 'edgetts' && (
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Free AI Neural voices. No API key needed, zero tokens.
                </p>
              </button>

              {/* Gemini TTS */}
              <button
                type="button"
                onClick={() => handleEngineChange('gemini')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  settings.engine === 'gemini'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Gemini 3.8</span>
                  </div>
                  {settings.engine === 'gemini' && (
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Google neural speech. Token-cached per sentence.
                </p>
              </button>

              {/* Web Speech API */}
              <button
                type="button"
                onClick={() => handleEngineChange('webspeech')}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  settings.engine === 'webspeech'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 shadow-sm'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Offline Speech</span>
                  </div>
                  {settings.engine === 'webspeech' && (
                    <div className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  100% Offline, native device voices, zero latency.
                </p>
              </button>
            </div>

            {/* Custom Provider Toggles (OpenAI, ElevenLabs) */}
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleEngineChange('openai')}
                className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between ${
                  settings.engine === 'openai'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-neutral-800 text-amber-950 dark:text-amber-100'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <span>OpenAI TTS (API Key)</span>
                {settings.engine === 'openai' && <Check className="w-3 h-3 text-amber-500" />}
              </button>

              <button
                type="button"
                onClick={() => handleEngineChange('elevenlabs')}
                className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold flex items-center justify-between ${
                  settings.engine === 'elevenlabs'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-neutral-800 text-amber-950 dark:text-amber-100'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <span>ElevenLabs (API Key)</span>
                {settings.engine === 'elevenlabs' && <Check className="w-3 h-3 text-amber-500" />}
              </button>
            </div>
          </div>

          {/* Voice Personas for selected engine */}
          {settings.engine === 'edgetts' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                EdgeTTS Free Neural Voice
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {EDGE_VOICES.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      (settings.edgeVoice || 'en-US-AriaNeural') === v.id
                        ? 'border-amber-400 bg-amber-50/50 dark:bg-neutral-800 dark:border-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="edgeVoice"
                      checked={(settings.edgeVoice || 'en-US-AriaNeural') === v.id}
                      onChange={() => handleEdgeVoiceChange(v.id)}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {v.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{v.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {settings.engine === 'gemini' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Gemini Voice Persona
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {GEMINI_VOICES.map((v) => (
                  <label
                    key={v.name}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      settings.geminiVoice === v.name
                        ? 'border-amber-400 bg-amber-50/50 dark:bg-neutral-800 dark:border-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="geminiVoice"
                      checked={settings.geminiVoice === v.name}
                      onChange={() => handleGeminiVoiceChange(v.name)}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {v.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{v.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {settings.engine === 'openai' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                OpenAI Voice Persona
              </label>
              <div className="grid grid-cols-2 gap-2">
                {OPENAI_VOICES.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
                      (settings.openAIVoice || 'alloy') === v.id
                        ? 'border-amber-400 bg-amber-50/50 dark:bg-neutral-800 dark:border-amber-500'
                        : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="openAIVoice"
                      checked={(settings.openAIVoice || 'alloy') === v.id}
                      onChange={() => handleOpenAIVoiceChange(v.id)}
                      className="mt-0.5 text-amber-600"
                    />
                    <div>
                      <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {v.title}
                      </div>
                      <div className="text-[10px] text-neutral-500 dark:text-neutral-400">{v.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {settings.engine === 'elevenlabs' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                ElevenLabs Voice ID
              </label>
              <input
                type="text"
                placeholder="e.g. 21m00Tcm4TlvDq8ikWAM (Rachel)"
                value={settings.elevenLabsVoiceId || ''}
                onChange={(e) => onUpdateSettings({ ...settings, elevenLabsVoiceId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl"
              />
            </div>
          )}

          {settings.engine === 'webspeech' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
                Offline Browser Voice ({browserVoices.length} available)
              </label>
              <select
                value={settings.webSpeechVoiceURI}
                onChange={(e) => handleBrowserVoiceChange(e.target.value)}
                className="w-full px-3 py-2.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
              >
                {browserVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User API Keys Section (Collapsible) */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setShowApiKeys(!showApiKeys)}
              className="flex items-center justify-between w-full text-xs font-semibold text-neutral-700 dark:text-neutral-300 py-1 hover:text-amber-600 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                <span>Custom AI API Keys (Optional)</span>
              </div>
              {showApiKeys ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showApiKeys && (
              <div className="mt-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    OpenAI API Key (for OpenAI voices)
                  </label>
                  <input
                    type="password"
                    placeholder="sk-proj-..."
                    value={settings.customOpenAIKey || ''}
                    onChange={(e) => onUpdateSettings({ ...settings, customOpenAIKey: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    ElevenLabs API Key (for ElevenLabs voices)
                  </label>
                  <input
                    type="password"
                    placeholder="xi-api-key-..."
                    value={settings.customElevenLabsKey || ''}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, customElevenLabsKey: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 mb-1">
                    Gemini API Key Override (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Defaults to auto-injected server key"
                    value={settings.customGeminiKey || ''}
                    onChange={(e) => onUpdateSettings({ ...settings, customGeminiKey: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Token Optimization Notice */}
          <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Token Optimization Active</span>
              <span>
                Audio is lazily generated only for active sentences and cached in-memory. Replays and
                re-reading cost 0 tokens. EdgeTTS and Offline Speech are 100% free with unlimited reading.
              </span>
            </div>
          </div>
        </div>

        {/* Footer with Audition Button */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <button
            onClick={handlePreview}
            disabled={isPreviewing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-600 hover:bg-white dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isPreviewing ? 'Testing Voice...' : 'Audition Voice'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
