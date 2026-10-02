import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', desc: 'Play / Pause speech' },
  { key: '← / J', desc: 'Jump to previous sentence' },
  { key: '→ / K', desc: 'Jump to next sentence' },
  { key: 'R', desc: 'Replay current sentence' },
  { key: 'Click Sentence', desc: 'Instantly jump reading to that sentence' },
  { key: '+ / -', desc: 'Increase / decrease speech speed' },
  { key: 'L', desc: 'Open offline library' },
  { key: 'V', desc: 'Open voice & model settings' },
  { key: 'A', desc: 'Open appearance & theme settings' },
  { key: 'Esc', desc: 'Close any open modal or panel' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-6 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
          {SHORTCUTS.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between py-2.5 text-xs">
              <span className="text-neutral-600 dark:text-neutral-300 font-medium">
                {s.desc}
              </span>
              <kbd className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 font-mono font-bold shadow-xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-50 dark:bg-neutral-800/80 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
