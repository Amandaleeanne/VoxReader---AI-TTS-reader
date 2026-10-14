import React, { useEffect } from 'react';
import {
  Copy,
  ArrowRightCircle,
  X,
  FileText,
  Clock,
  HardDrive,
  Hash,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { ArticleDocument } from '../types';
import { formatDataSize } from '../utils/fileHasher';

interface DuplicateFileDialogProps {
  isOpen: boolean;
  incomingDoc: ArticleDocument | null;
  existingDoc: ArticleDocument | null;
  onSwitchToExisting: (doc: ArticleDocument) => void;
  onMakeDuplicateCopy: (doc: ArticleDocument) => void;
  onCancel: () => void;
}

export const DuplicateFileDialog: React.FC<DuplicateFileDialogProps> = ({
  isOpen,
  incomingDoc,
  existingDoc,
  onSwitchToExisting,
  onMakeDuplicateCopy,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && existingDoc) {
        onSwitchToExisting(existingDoc);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, existingDoc, onCancel, onSwitchToExisting]);

  if (!isOpen || !incomingDoc || !existingDoc) return null;

  const hashCode = incomingDoc.hashCode || existingDoc.hashCode || 'unknown';
  const sizeBytes =
    incomingDoc.metadataDetails?.fileSizeBytes ||
    existingDoc.metadataDetails?.fileSizeBytes ||
    incomingDoc.rawContent?.length ||
    0;

  const progressPercent =
    existingDoc.totalSentences > 0 && existingDoc.lastReadSentenceIndex > 0
      ? Math.round(
          (existingDoc.lastReadSentenceIndex / existingDoc.totalSentences) * 100
        )
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="duplicate-dialog-title"
                className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white"
              >
                File Already Exists
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                A document with matching content already exists in your library
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Details */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 line-clamp-1">
                  {existingDoc.title}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 shrink-0">
                <Hash className="w-3 h-3 text-neutral-400" />
                {hashCode}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5" />
                {formatDataSize(sizeBytes)}
              </span>
              <span>•</span>
              <span>
                {existingDoc.totalWords.toLocaleString()} words
              </span>
              <span>•</span>
              <span className="capitalize">{existingDoc.fileType}</span>

              {progressPercent > 0 && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {progressPercent}% read
                  </span>
                </>
              )}
            </div>

            {existingDoc.metadataDetails?.pageCount && (
              <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                <span>
                  {existingDoc.metadataDetails.pageCount} pages in original file
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            VoxReader detected an identical document using an instant hash table lookup.
            Would you like to switch to your existing copy, make a duplicate copy, or cancel?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-neutral-50/80 dark:bg-neutral-850/80 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="order-3 sm:order-1 px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onMakeDuplicateCopy(incomingDoc)}
            className="order-2 px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center justify-center gap-1.5"
            title="Import this file as a new duplicate copy"
          >
            <Copy className="w-3.5 h-3.5 text-neutral-500" />
            <span>Make a Duplicate Copy</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchToExisting(existingDoc)}
            className="order-1 sm:order-3 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all flex items-center justify-center gap-1.5"
            title="Switch to the existing document in your library"
          >
            <ArrowRightCircle className="w-3.5 h-3.5" />
            <span>Switch to Existing Document</span>
          </button>
        </div>
      </div>
    </div>
  );
};
