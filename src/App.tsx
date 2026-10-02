import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ReaderView } from './components/ReaderView';
import { PlaybackBar } from './components/PlaybackBar';
import { ImportModal } from './components/ImportModal';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { LibraryModal } from './components/LibraryModal';
import { AppearanceModal } from './components/AppearanceModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ArticleDocument, DisplaySettings, VoiceSettings } from './types';
import { TTSController } from './services/ttsService';
import { parseTextIntoDocument } from './utils/textParser';
import { SAMPLE_ARTICLES } from './data/sampleArticles';
import {
  saveArticleToStorage,
  getAllArticlesFromStorage,
  sanitizeStoredArticle,
  updateArticleProgress,
  getSettings,
  saveSettings,
  getActiveDocId,
  saveActiveDocId,
  SETTINGS_KEY,
  DISPLAY_KEY,
} from './utils/storage';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engine: 'gemini',
  geminiVoice: 'Kore',
  edgeVoice: 'en-US-AriaNeural',
  webSpeechVoiceURI: '',
  openAIVoice: 'alloy',
  elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoScroll: true,
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'paper',
  fontFamily: 'serif',
  fontSize: 'base',
  lineHeight: 'normal',
  focusMode: false,
  bionicReading: false,
};

export default function App() {
  // Voice & Display settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() =>
    getSettings<VoiceSettings>(SETTINGS_KEY, DEFAULT_VOICE_SETTINGS)
  );

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(() =>
    getSettings<DisplaySettings>(DISPLAY_KEY, DEFAULT_DISPLAY_SETTINGS)
  );

  // Document & Reading State
  const [document, setDocument] = useState<ArticleDocument>(() => {
    return parseTextIntoDocument(SAMPLE_ARTICLES[0].content, {
      title: SAMPLE_ARTICLES[0].title,
      author: SAMPLE_ARTICLES[0].author,
      fileType: 'manual',
      id: SAMPLE_ARTICLES[0].id,
    });
  });

  const documentRef = useRef<ArticleDocument>(document);
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [savedArticles, setSavedArticles] = useState<ArticleDocument[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(
    null
  );

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // TTS Controller Ref
  const ttsControllerRef = useRef<TTSController | null>(null);

  // Show Toast
  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Update theme class on HTML element for dark mode styling
  useEffect(() => {
    const isDark = displaySettings.theme === 'dark' || displaySettings.theme === 'midnight';
    if (isDark) {
      window.document.documentElement.classList.add('dark');
    } else {
      window.document.documentElement.classList.remove('dark');
    }
    saveSettings(DISPLAY_KEY, displaySettings);
  }, [displaySettings]);

  // Load Saved Library on Mount
  useEffect(() => {
    const loadInit = async () => {
      const list = await getAllArticlesFromStorage();
      setSavedArticles(list);

      const activeId = getActiveDocId();
      if (activeId) {
        const found = list.find((a) => a.id === activeId);
        if (found) {
          const sanitized = sanitizeStoredArticle(found);
          setDocument(sanitized);
          setCurrentSentenceIndex(sanitized.lastReadSentenceIndex || 0);
        }
      }
    };
    loadInit();
  }, []);

  // Initialize and maintain TTSController
  useEffect(() => {
    const controller = new TTSController(voiceSettings, {
      onSentenceChange: (idx) => {
        setCurrentSentenceIndex(idx);
        updateArticleProgress(document.id, idx);
      },
      onWordBoundary: (wIdx) => {
        setCurrentWordIndex(wIdx);
      },
      onStateChange: (playing, buffering) => {
        setIsPlaying(playing);
        setIsBuffering(buffering);
      },
      onError: (errMsg) => {
        showToast(errMsg, 'error');
      },
      onFinish: () => {
        showToast('Finished reading document.', 'success');
      },
    });

    ttsControllerRef.current = controller;

    // Flatten all sentences across paragraphs
    const allSentences = document.paragraphs.flatMap((p) => p.sentences);
    controller.setSentences(allSentences, currentSentenceIndex);

    return () => {
      controller.destroy();
    };
  }, []); // Run once on mount

  // Update sentences in controller whenever document changes
  useEffect(() => {
    if (ttsControllerRef.current) {
      const allSentences = document.paragraphs.flatMap((p) => p.sentences);
      ttsControllerRef.current.setSentences(allSentences, currentSentenceIndex);
    }
  }, [document]);

  // Update voice settings in controller and persistence
  const handleUpdateVoiceSettings = (newSettings: VoiceSettings) => {
    setVoiceSettings(newSettings);
    saveSettings(SETTINGS_KEY, newSettings);
    if (ttsControllerRef.current) {
      ttsControllerRef.current.updateSettings(newSettings);
    }
  };

  // Playback control actions
  const handleTogglePlay = () => {
    if (!ttsControllerRef.current) return;
    if (isPlaying) {
      ttsControllerRef.current.pause();
    } else {
      ttsControllerRef.current.play();
    }
  };

  const handleSkipForward = () => {
    ttsControllerRef.current?.nextSentence();
  };

  const handleSkipBackward = () => {
    ttsControllerRef.current?.prevSentence();
  };

  const handleReplay = () => {
    ttsControllerRef.current?.replayCurrent();
  };

  const handleSpeedChange = (rate: number) => {
    handleUpdateVoiceSettings({ ...voiceSettings, rate });
  };

  const handleJumpToSentence = (index: number) => {
    setCurrentSentenceIndex(index);
    ttsControllerRef.current?.jumpToSentence(index, true);
  };

  const handleScrub = (index: number) => {
    setCurrentSentenceIndex(index);
    ttsControllerRef.current?.jumpToSentence(index, isPlaying);
  };

  // Load new document (from Webpage, File, or Paste)
  const handleDocumentLoaded = async (newDoc: ArticleDocument) => {
    const sanitized = sanitizeStoredArticle(newDoc);
    setDocument(sanitized);
    setCurrentSentenceIndex(0);
    setCurrentWordIndex(null);
    saveActiveDocId(sanitized.id);

    // Auto-save to offline library so it's always available offline
    await saveArticleToStorage(sanitized);
    const updatedList = await getAllArticlesFromStorage();
    setSavedArticles(updatedList);

    showToast(`Loaded "${sanitized.title}". Ready to read.`, 'success');

    // Automatically begin playback with chosen model
    setTimeout(() => {
      ttsControllerRef.current?.jumpToSentence(0, true);
    }, 150);
  };

  // Select document from Library
  const handleSelectFromLibrary = (article: ArticleDocument, startSentenceIndex: number = 0) => {
    const sanitized = sanitizeStoredArticle(article);
    setDocument(sanitized);
    setCurrentSentenceIndex(startSentenceIndex);
    setCurrentWordIndex(null);
    saveActiveDocId(sanitized.id);

    showToast(`Resumed "${sanitized.title}" at sentence ${startSentenceIndex + 1}.`, 'info');

    setTimeout(() => {
      ttsControllerRef.current?.jumpToSentence(startSentenceIndex, true);
    }, 150);
  };

  // Navigate to an in-text hyperlink or documentation next/prev button
  const handleNavigateToUrl = async (url: string) => {
    showToast(`Loading "${url}"...`, 'info');
    try {
      const res = await fetch('/api/extract-webpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch webpage: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.content || data.content.trim().length === 0) {
        throw new Error('No readable article text found at this address.');
      }

      const newDoc = parseTextIntoDocument(data.content, {
        title: data.title || url,
        domain: data.domain,
        sourceUrl: data.url,
        fileType: 'webpage',
        docNavigation: data.docNavigation,
      });

      await handleDocumentLoaded(newDoc);
    } catch (err: any) {
      showToast(err.message || 'Failed to open link.', 'error');
    }
  };

  // Save current document to storage explicitly
  const handleSaveCurrentDocument = async () => {
    await saveArticleToStorage(document);
    const updatedList = await getAllArticlesFromStorage();
    setSavedArticles(updatedList);
    showToast('Saved to your offline library.', 'success');
  };

  const isSavedInLibrary = savedArticles.some((a) => a.id === document.id);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowRight' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleSkipForward();
      } else if (e.code === 'ArrowLeft' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        handleSkipBackward();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReplay();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleSpeedChange(Math.min(3.0, Math.round((voiceSettings.rate + 0.25) * 100) / 100));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleSpeedChange(Math.max(0.5, Math.round((voiceSettings.rate - 0.25) * 100) / 100));
      } else if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setIsVoiceOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAppearanceOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsLibraryOpen((prev) => !prev);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsImportOpen(false);
        setIsVoiceOpen(false);
        setIsLibraryOpen(false);
        setIsAppearanceOpen(false);
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, voiceSettings.rate]);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 animate-bounce flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold backdrop-blur-md border bg-white/95 dark:bg-neutral-800/95 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100">
          {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
          {notification.type === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
          {notification.type === 'info' && <Info className="w-4 h-4 text-amber-500" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        currentDocument={document}
        isSavedInLibrary={isSavedInLibrary}
        libraryCount={savedArticles.length}
        voiceSettings={voiceSettings}
        onSaveCurrentDocument={handleSaveCurrentDocument}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenVoiceSettings={() => setIsVoiceOpen(true)}
        onOpenAppearance={() => setIsAppearanceOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Main Synchronized Reader View */}
      <ReaderView
        document={document}
        currentSentenceIndex={currentSentenceIndex}
        currentWordIndex={currentWordIndex}
        isPlaying={isPlaying}
        autoScroll={voiceSettings.autoScroll}
        displaySettings={displaySettings}
        onSentenceClick={handleJumpToSentence}
        onNavigateToUrl={handleNavigateToUrl}
      />

      {/* Persistent Bottom Playback Bar */}
      <PlaybackBar
        isPlaying={isPlaying}
        isBuffering={isBuffering}
        currentIndex={currentSentenceIndex}
        totalSentences={document.totalSentences}
        totalWords={document.totalWords}
        settings={voiceSettings}
        onTogglePlay={handleTogglePlay}
        onSkipForward={handleSkipForward}
        onSkipBackward={handleSkipBackward}
        onReplay={handleReplay}
        onSpeedChange={handleSpeedChange}
        onOpenVoiceSettings={() => setIsVoiceOpen(true)}
        onScrub={handleScrub}
      />

      {/* Modals */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onDocumentLoaded={handleDocumentLoaded}
      />

      <VoiceSettingsModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        settings={voiceSettings}
        onUpdateSettings={handleUpdateVoiceSettings}
      />

      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        currentArticleId={document.id}
        onSelectArticle={handleSelectFromLibrary}
        onArticlesChange={setSavedArticles}
      />

      <AppearanceModal
        isOpen={isAppearanceOpen}
        onClose={() => setIsAppearanceOpen(false)}
        settings={displaySettings}
        onUpdateSettings={(newDisplay) => setDisplaySettings(newDisplay)}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
