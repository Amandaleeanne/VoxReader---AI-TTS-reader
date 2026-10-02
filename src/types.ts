export type TTSEngineType = 'gemini' | 'edgetts' | 'webspeech' | 'openai' | 'elevenlabs';

export type GeminiVoiceName = 'Kore' | 'Puck' | 'Fenrir' | 'Charon' | 'Zephyr';

export interface WordToken {
  word: string; // Full token preserving original formatting and punctuation
  cleanWord?: string; // Phonetic word stripped of outer punctuation for audio timing
  startIndex: number;
  endIndex: number;
}

export interface SentenceItem {
  id: string; // e.g. "s-0"
  globalIndex: number;
  paragraphIndex: number;
  sentenceIndexInParagraph: number;
  text: string;
  words: WordToken[];
}

export interface ParagraphItem {
  id: string;
  paragraphIndex: number;
  sentences: SentenceItem[];
  rawText: string;
  isHeading?: boolean;
  headingLevel?: number;
}

export interface DocNavigationItem {
  title: string;
  url: string;
}

export interface DocNavigation {
  prev?: DocNavigationItem;
  next?: DocNavigationItem;
}

export interface ArticleDocument {
  id: string;
  title: string;
  author?: string;
  domain?: string;
  sourceUrl?: string;
  fileType: 'webpage' | 'pdf' | 'epub' | 'text' | 'manual';
  rawContent: string;
  paragraphs: ParagraphItem[];
  totalSentences: number;
  totalWords: number;
  createdAt: number;
  lastOpenedAt: number;
  lastReadSentenceIndex: number;
  favorite?: boolean;
  docNavigation?: DocNavigation;
}

export interface VoiceSettings {
  engine: TTSEngineType;
  geminiVoice: GeminiVoiceName;
  edgeVoice: string;
  webSpeechVoiceURI: string;
  openAIVoice: string;
  elevenLabsVoiceId: string;
  customGeminiKey?: string;
  customOpenAIKey?: string;
  customElevenLabsKey?: string;
  rate: number; // 0.5 to 3.0
  pitch: number; // 0.5 to 1.5
  volume: number; // 0 to 1
  autoScroll: boolean;
}

export interface DisplaySettings {
  theme: 'paper' | 'light' | 'dark' | 'midnight' | 'forest';
  fontFamily: 'serif' | 'sans' | 'dyslexic' | 'mono';
  fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  lineHeight: 'tight' | 'normal' | 'relaxed';
  focusMode: boolean; // Dims non-active sentences slightly to enhance focus
  bionicReading: boolean; // Bold initial letters of words
}
