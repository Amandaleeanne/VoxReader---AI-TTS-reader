import React from 'react';
import {
  Type,
  Sun,
  Moon,
  Eye,
  X,
  AlignLeft,
  Sparkles,
} from 'lucide-react';
import { DisplaySettings } from '../types';

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: DisplaySettings;
  onUpdateSettings: (newSettings: DisplaySettings) => void;
}

const THEMES: { id: DisplaySettings['theme']; label: string; bg: string; text: string }[] = [
  { id: 'paper', label: 'Paperback', bg: 'bg-[#fdfbf7]', text: 'text-amber-950 border-amber-300' },
  { id: 'light', label: 'Crisp Light', bg: 'bg-white', text: 'text-neutral-900 border-neutral-300' },
  { id: 'dark', label: 'Charcoal Dark', bg: 'bg-[#18181b]', text: 'text-neutral-100 border-neutral-700' },
  { id: 'midnight', label: 'Midnight OLED', bg: 'bg-black', text: 'text-indigo-200 border-indigo-900' },
  { id: 'forest', label: 'Forest Sage', bg: 'bg-[#f4f7f4]', text: 'text-[#1c3325] border-emerald-300' },
];

export const AppearanceModal: React.FC<AppearanceModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Type className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Reader Appearance
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
          {/* Themes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Color Theme
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => onUpdateSettings({ ...settings, theme: th.id })}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-xs font-semibold ${th.bg} ${th.text} ${
                    settings.theme === th.id
                      ? 'ring-2 ring-amber-500 shadow-md scale-[1.02]'
                      : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-current shadow-inner" />
                  <span>{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Typography / Font Family */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Typeface
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'serif', label: 'Crimson Serif (Book)', fontClass: 'font-serif' },
                { id: 'sans', label: 'Inter Sans (Clean)', fontClass: 'font-sans' },
                { id: 'dyslexic', label: 'Dyslexic Friendly', fontClass: 'font-sans tracking-wide' },
                { id: 'mono', label: 'JetBrains Mono', fontClass: 'font-mono' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ ...settings, fontFamily: f.id as any })}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${f.fontClass} ${
                    settings.fontFamily === f.id
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                      : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Text Size
            </label>
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
              {[
                { id: 'sm', label: 'A-', title: 'Small' },
                { id: 'base', label: 'A', title: 'Normal' },
                { id: 'lg', label: 'A+', title: 'Large' },
                { id: 'xl', label: 'A++', title: 'Extra Large' },
                { id: '2xl', label: 'A+++', title: 'Huge' },
              ].map((sz) => (
                <button
                  key={sz.id}
                  onClick={() => onUpdateSettings({ ...settings, fontSize: sz.id as any })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settings.fontSize === sz.id
                      ? 'bg-white dark:bg-neutral-700 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  title={sz.title}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Line Spacing */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Line Spacing
            </label>
            <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
              {[
                { id: 'tight', label: 'Compact' },
                { id: 'normal', label: 'Comfortable' },
                { id: 'relaxed', label: 'Spacious' },
              ].map((lh) => (
                <button
                  key={lh.id}
                  onClick={() => onUpdateSettings({ ...settings, lineHeight: lh.id as any })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    settings.lineHeight === lh.id
                      ? 'bg-white dark:bg-neutral-700 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cognitive & Focus Toggles */}
          <div className="space-y-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            {/* Focus Mode */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Focus Mode
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Dims non-active sentences to minimize distractions
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.focusMode}
                onChange={(e) => onUpdateSettings({ ...settings, focusMode: e.target.checked })}
                className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
            </div>

            {/* Bionic Reading */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Bionic Visual Fixation
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Bolds the first letters of each word for faster reading flow
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.bionicReading}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, bionicReading: e.target.checked })
                }
                className="w-5 h-5 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
