import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sliders,
  Sparkles,
  WifiOff,
  Radio,
  Plus,
  Minus,
} from 'lucide-react';
import { VoiceSettings } from '../types';

interface PlaybackBarProps {
  isPlaying: boolean;
  isBuffering: boolean;
  currentIndex: number;
  totalSentences: number;
  totalWords: number;
  settings: VoiceSettings;
  onTogglePlay: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onReplay: () => void;
  onSpeedChange: (speed: number) => void;
  onOpenVoiceSettings: () => void;
  onScrub: (index: number) => void;
}

export const PlaybackBar: React.FC<PlaybackBarProps> = ({
  isPlaying,
  isBuffering,
  currentIndex,
  totalSentences,
  totalWords,
  settings,
  onTogglePlay,
  onSkipForward,
  onSkipBackward,
  onReplay,
  onSpeedChange,
  onOpenVoiceSettings,
  onScrub,
}) => {
  const progressPercent = totalSentences > 0 ? Math.round(((currentIndex + 1) / totalSentences) * 100) : 0;
  
  // Estimate reading time remaining based on remaining fraction and average 180 wpm / rate
  const remainingFraction = totalSentences > 0 ? (totalSentences - (currentIndex + 1)) / totalSentences : 0;
  const remainingWords = Math.round(totalWords * remainingFraction);
  const wordsPerMinute = 180 * settings.rate;
  const remainingMinutes = Math.max(1, Math.ceil(remainingWords / wordsPerMinute));

  const handleStepDown = () => {
    const next = Math.max(0.5, Math.round((settings.rate - 0.05) * 100) / 100);
    onSpeedChange(next);
  };

  const handleStepUp = () => {
    const next = Math.min(3.0, Math.round((settings.rate + 0.05) * 100) / 100);
    onSpeedChange(next);
  };

  const getEngineBadge = () => {
    if (settings.engine === 'gemini') {
      return (
        <>
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Gemini ({settings.geminiVoice})</span>
        </>
      );
    }
    if (settings.engine === 'edgetts') {
      return (
        <>
          <Radio className="w-3.5 h-3.5 text-cyan-500" />
          <span>EdgeTTS (Free AI)</span>
        </>
      );
    }
    if (settings.engine === 'openai') {
      return (
        <>
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>OpenAI ({settings.openAIVoice || 'alloy'})</span>
        </>
      );
    }
    if (settings.engine === 'elevenlabs') {
      return (
        <>
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>ElevenLabs</span>
        </>
      );
    }
    return (
      <>
        <WifiOff className="w-3.5 h-3.5 text-emerald-500" />
        <span>Offline Speech</span>
      </>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl transition-colors duration-200">
      {/* Interactive scrubbing progress bar */}
      <div className="relative group w-full h-2 bg-neutral-200 dark:bg-neutral-800 cursor-pointer">
        <div
          className="h-full bg-amber-500 dark:bg-amber-400 transition-all duration-150 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(0, totalSentences - 1)}
          value={currentIndex}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title={`Jump to sentence ${currentIndex + 1} of ${totalSentences}`}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Position & Time Info */}
        <div className="flex items-center gap-3 w-full sm:w-1/3 justify-between sm:justify-start">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Sentence {totalSentences > 0 ? currentIndex + 1 : 0} of {totalSentences}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                {progressPercent}%
              </span>
            </div>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              ~{remainingMinutes} min left at {settings.rate}x
            </span>
          </div>

          {/* Quick Voice / Engine Indicator Badge */}
          <button
            onClick={onOpenVoiceSettings}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:border-amber-400 dark:hover:border-amber-500 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors"
            title="Click to change voice, engine, or API keys"
          >
            {getEngineBadge()}
          </button>
        </div>

        {/* Center: Main Playback Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Replay Current */}
          <button
            onClick={onReplay}
            disabled={totalSentences === 0}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-40"
            title="Replay Current Sentence (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Skip Back */}
          <button
            onClick={onSkipBackward}
            disabled={currentIndex <= 0}
            className="p-2 text-neutral-700 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-40"
            title="Previous Sentence (Left Arrow / J)"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            onClick={onTogglePlay}
            disabled={totalSentences === 0}
            className={`relative flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-transform active:scale-95 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-neutral-900 hover:bg-black dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-neutral-950 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isBuffering ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Skip Forward */}
          <button
            onClick={onSkipForward}
            disabled={currentIndex >= totalSentences - 1}
            className="p-2 text-neutral-700 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-40"
            title="Next Sentence (Right Arrow / K)"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Incremental Speed Slider & Settings */}
        <div className="flex items-center gap-2 w-full sm:w-1/3 justify-end">
          {/* Incremental Speed Slider */}
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/90 rounded-xl px-2.5 py-1 border border-neutral-200/80 dark:border-neutral-700">
            <button
              onClick={handleStepDown}
              disabled={settings.rate <= 0.5}
              className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 transition-colors"
              title="Decrease speed by 0.05x (-)"
            >
              <Minus className="w-3 h-3 stroke-[2.5]" />
            </button>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.05}
                value={settings.rate}
                onChange={(e) => onSpeedChange(Math.round(Number(e.target.value) * 100) / 100)}
                className="w-16 sm:w-20 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-lg appearance-none cursor-pointer accent-amber-500"
                title={`Playback Speed: ${settings.rate}x`}
              />
              <button
                onClick={() => onSpeedChange(1.0)}
                className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors min-w-[38px] text-right"
                title="Click to reset to 1.0x"
              >
                {settings.rate.toFixed(2)}x
              </button>
            </div>

            <button
              onClick={handleStepUp}
              disabled={settings.rate >= 3.0}
              className="p-1 text-neutral-500 dark:text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-30 transition-colors"
              title="Increase speed by 0.05x (+)"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          {/* Voice Settings Button */}
          <button
            onClick={onOpenVoiceSettings}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
            title="Custom Voice, Engine & API Key Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
