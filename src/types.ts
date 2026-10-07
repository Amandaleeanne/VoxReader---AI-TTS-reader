export type TTSEngineType = 'gemini' | 'edgetts' | 'webspeech' | 'openai' | 'elevenlabs';

export type GeminiVoiceName = 'Kore' | 'Puck' | 'Fenrir' | 'Charon' | 'Zephyr';

export interface WordToken {
  word: string; // Full token preserving original formatting and punctuation
  cleanWord?: string; // Phonetic word stripped of outer punctuation for audio timing
  startIndex: number;
  endIndex: number;
  isBold?: boolean;
  isItalic?: boolean;
  isCode?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  linkUrl?: string;
  hasLineBreakAfter?: boolean; // For preserving exact line breaks in poetry, text, pdf
}

export interface SentenceItem {
  id: string; // e.g. "s-0"
  globalIndex: number;
  paragraphIndex: number;
  sentenceIndexInParagraph: number;
  text: string;
  words: WordToken[];
  isBold?: boolean;
  isItalic?: boolean;
  isHeading?: boolean;
  headingLevel?: number;
}

export type BlockType =
  | 'paragraph'
  | 'heading'
  | 'chapter-header'
  | 'blockquote'
  | 'code'
  | 'list-item'
  | 'table'
  | 'page-break'
  | 'divider';

export interface ParagraphItem {
  id: string;
  paragraphIndex: number;
  sentences: SentenceItem[];
  rawText: string;
  isHeading?: boolean;
  headingLevel?: number; // 1 to 6
  blockType?: BlockType;
  pageNumber?: number; // For PDF page tracking
  chapterTitle?: string; // For EPUB chapter grouping
  isListItem?: boolean;
  listMarker?: string; // e.g. "•", "1.", "-"
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  isBold?: boolean;
  isItalic?: boolean;
  preserveLineBreaks?: boolean; // For text/poetry/dialogue where exact lines must be preserved
  fontSizePt?: number; // Exact PDF font size if available
  fontFamilyName?: string; // e.g., 'serif', 'sans', 'mono'
  indentPx?: number; // Left indentation in pixels or ems from PDF minX or CSS
  isPoemOrVerse?: boolean;
  tableData?: {
    headers: string[];
    rows: string[][];
    alignments?: ('left' | 'center' | 'right')[];
  }; // For tables in EPUB, Markdown, or PDF
  runningHeader?: string;
  runningFooter?: string;
  hasExplicitParagraphBreak?: boolean;
}

export interface DocNavigationItem {
  title: string;
  url: string;
}

export interface DocNavigation {
  prev?: DocNavigationItem;
  next?: DocNavigationItem;
}

export interface DocumentMetadataDetails {
  pageCount?: number;
  fileSizeFormatted?: string;
  publisher?: string;
  publicationDate?: string;
  language?: string;
  chapters?: string[];
  pdfCreator?: string;
  pdfProducer?: string;
  subject?: string;
}

export interface ArticleDocument {
  id: string;
  title: string;
  author?: string;
  domain?: string;
  sourceUrl?: string;
  fileType: 'webpage' | 'pdf' | 'epub' | 'text' | 'manual' | 'markdown';
  rawContent: string;
  paragraphs: ParagraphItem[];
  totalSentences: number;
  totalWords: number;
  createdAt: number;
  lastOpenedAt: number;
  lastReadSentenceIndex: number;
  favorite?: boolean;
  docNavigation?: DocNavigation;
  metadataDetails?: DocumentMetadataDetails;
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
  autoPlayOnDocumentLoad: boolean;
}

export interface DisplaySettings {
  theme: 'paper' | 'light' | 'dark' | 'midnight' | 'forest';
  fontFamily: 'serif' | 'sans' | 'dyslexic' | 'mono';
  fontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  lineHeight: 'tight' | 'normal' | 'relaxed';
  textAlign?: 'left' | 'justify' | 'center';
  focusMode: boolean; // Dims non-active sentences slightly to enhance focus
  bionicReading: boolean; // Bold initial letters of words
}
