import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Bookmark,
  BookmarkCheck,
  Sliders,
  Type,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle,
  Keyboard,
  ExternalLink,
} from 'lucide-react';
import { ArticleDocument, VoiceSettings } from '../types';

interface HeaderProps {
  currentDocument: ArticleDocument;
  isSavedInLibrary: boolean;
  libraryCount: number;
  voiceSettings: VoiceSettings;
  onSaveCurrentDocument: () => void;
  onOpenImport: () => void;
  onOpenLibrary: () => void;
  onOpenVoiceSettings: () => void;
  onOpenAppearance: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDocument,
  isSavedInLibrary,
  libraryCount,
  voiceSettings,
  onSaveCurrentDocument,
  onOpenImport,
  onOpenLibrary,
  onOpenVoiceSettings,
  onOpenAppearance,
  onOpenShortcuts,
}) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <BookOpen className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-white">
                VoxRead
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                Open Reader
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:inline">
              Read Aloud for Web, PDF & ePub
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Add / Import Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-sm shadow-amber-500/20 transition-all"
            title="Import Webpage, PDF, ePub, or Text"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Add Content</span>
            <span className="sm:hidden">Add</span>
          </button>

          {/* Library Button */}
          <button
            onClick={onOpenLibrary}
            className="relative flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-semibold shadow-xs transition-colors"
            title="Open Offline Library"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Library</span>
            {libraryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                {libraryCount}
              </span>
            )}
          </button>

          {/* Bookmark Current Document */}
          <button
            onClick={onSaveCurrentDocument}
            className={`p-2 rounded-xl border transition-colors ${
              isSavedInLibrary
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
            }`}
            title={isSavedInLibrary ? 'Saved to Offline Library' : 'Save to Offline Library'}
          >
            {isSavedInLibrary ? (
              <BookmarkCheck className="w-4 h-4 fill-amber-500" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-800 mx-0.5 hidden sm:block" />

          {/* Voice Settings */}
          <button
            onClick={onOpenVoiceSettings}
            className="flex items-center gap-1 px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-medium transition-colors"
            title="Voice & Audio Engine Settings"
          >
            {voiceSettings.engine === 'gemini' ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            ) : voiceSettings.engine === 'edgetts' ? (
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            ) : voiceSettings.engine === 'openai' ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ) : voiceSettings.engine === 'elevenlabs' ? (
              <span className="w-2 h-2 rounded-full bg-purple-500" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
            )}
            <span className="hidden md:inline">
              {voiceSettings.engine === 'gemini'
                ? `Gemini ${voiceSettings.geminiVoice}`
                : voiceSettings.engine === 'edgetts'
                ? 'EdgeTTS (Free AI)'
                : voiceSettings.engine === 'openai'
                ? `OpenAI (${voiceSettings.openAIVoice || 'alloy'})`
                : voiceSettings.engine === 'elevenlabs'
                ? 'ElevenLabs'
                : 'Offline Voice'}
            </span>
          </button>

          {/* Appearance */}
          <button
            onClick={onOpenAppearance}
            className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl transition-colors"
            title="Customize Fonts & Theme"
          >
            <Type className="w-4 h-4" />
          </button>

          {/* Keyboard Shortcuts */}
          <button
            onClick={onOpenShortcuts}
            className="p-2 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-xl transition-colors hidden sm:block"
            title="Keyboard Shortcuts"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Online / Offline Status Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
            title={isOnline ? 'Online mode active' : 'Offline mode: Web Speech voices available'}
          >
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden lg:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-600" />
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
