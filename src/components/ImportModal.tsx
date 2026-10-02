import React, { useState } from 'react';
import {
  Globe,
  Upload,
  FileText,
  BookOpen,
  Sparkles,
  X,
  Loader2,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import { parseEpubFile, parsePdfFile, parseTextFile } from '../utils/fileParser';
import { parseTextIntoDocument } from '../utils/textParser';
import { ArticleDocument } from '../types';
import { SAMPLE_ARTICLES } from '../data/sampleArticles';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentLoaded: (doc: ArticleDocument) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onDocumentLoaded,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'file' | 'paste'>('url');

  // Webpage state
  const [webpageUrl, setWebpageUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  // File upload state
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Paste text state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Webpage URL submission
  const handleFetchUrl = async (urlToFetch?: string) => {
    const targetUrl = (urlToFetch || webpageUrl).trim();
    if (!targetUrl) {
      setUrlError('Please enter a valid website URL.');
      return;
    }

    setIsFetchingUrl(true);
    setUrlError(null);

    try {
      const res = await fetch('/api/extract-webpage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Failed to extract webpage.`);
      }

      const data = await res.json();
      if (!data.content || data.content.trim().length === 0) {
        throw new Error('No readable article text found at this address.');
      }

      const doc = parseTextIntoDocument(data.content, {
        title: data.title || 'Webpage Article',
        domain: data.domain,
        sourceUrl: data.url,
        fileType: 'webpage',
        docNavigation: data.docNavigation,
      });

      onDocumentLoaded(doc);
      onClose();
    } catch (err: any) {
      setUrlError(err.message || 'Failed to fetch webpage.');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Handle Sample selection
  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_ARTICLES.find((s) => s.id === sampleId);
    if (!sample) return;

    const doc = parseTextIntoDocument(sample.content, {
      title: sample.title,
      author: sample.author,
      fileType: 'manual',
    });

    onDocumentLoaded(doc);
    onClose();
  };

  // Handle File processing
  const handleFile = async (file: File) => {
    setIsParsingFile(true);
    setFileError(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let result;

      if (extension === 'pdf') {
        result = await parsePdfFile(file);
      } else if (extension === 'epub') {
        result = await parseEpubFile(file);
      } else if (['txt', 'md', 'text', 'rtf'].includes(extension || '')) {
        result = await parseTextFile(file);
      } else {
        throw new Error('Unsupported format. Please upload a PDF, ePub, TXT, or MD file.');
      }

      if (!result.content || result.content.trim().length === 0) {
        throw new Error('File did not contain any readable text.');
      }

      const doc = parseTextIntoDocument(result.content, {
        title: result.title,
        author: result.author,
        fileType: result.fileType,
      });

      onDocumentLoaded(doc);
      onClose();
    } catch (err: any) {
      setFileError(err.message || 'Failed to parse file.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Paste submission
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) {
      setPasteError('Please enter some text to read.');
      return;
    }

    const doc = parseTextIntoDocument(pasteContent.trim(), {
      title: pasteTitle.trim() || undefined,
      fileType: 'manual',
    });

    onDocumentLoaded(doc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              Add Content to Read
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-800 px-6 pt-2 bg-neutral-50/50 dark:bg-neutral-900/50">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'url'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            Webpage URL
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'file'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            PDF / ePub / Text
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'paste'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Paste Text
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: WEBPAGE URL */}
          {activeTab === 'url' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Webpage or Article Link
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="w-4 h-4 absolute left-3 top-3.5 text-neutral-400" />
                    <input
                      type="url"
                      placeholder="https://en.wikipedia.org/wiki/Speed_reading or news article"
                      value={webpageUrl}
                      onChange={(e) => setWebpageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={() => handleFetchUrl()}
                    disabled={isFetchingUrl || !webpageUrl.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
                  >
                    {isFetchingUrl ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load Article</span>
                    )}
                  </button>
                </div>

                {urlError && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{urlError}</span>
                  </div>
                )}
              </div>

              {/* Sample Articles Section */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                <span className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 mb-3">
                  Or test immediately with a curated sample:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SAMPLE_ARTICLES.map((sample) => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectSample(sample.id)}
                      className="text-left p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-amber-400 dark:hover:border-amber-500 bg-white dark:bg-neutral-800/60 hover:bg-amber-50/50 dark:hover:bg-neutral-800 transition-all group"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                        {sample.category}
                      </span>
                      <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 line-clamp-2 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                        {sample.title}
                      </h4>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-colors flex flex-col items-center justify-center gap-3 ${
                  dragActive
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-neutral-800/80'
                    : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/40 hover:border-amber-400'
                }`}
              >
                {isParsingFile ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                      Extracting text and formatting sentences...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                        Drag and drop your document here, or browse
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Supports PDF (.pdf), ePub books (.epub), Text (.txt), and Markdown (.md)
                      </p>
                    </div>

                    <input
                      type="file"
                      id="file-input"
                      accept=".pdf,.epub,.txt,.md,.text"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-input"
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-black dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-neutral-950 rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-all"
                    >
                      <FileCheck className="w-4 h-4" />
                      Browse Files
                    </label>
                  </>
                )}
              </div>

              {fileError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PASTE TEXT */}
          {activeTab === 'paste' && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chapter 1: The Beginning"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                  Text Content
                </label>
                <textarea
                  rows={8}
                  placeholder="Paste or write anything here to read aloud with synchronized highlights..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white resize-none"
                />
              </div>

              {pasteError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!pasteContent.trim()}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md transition-all active:scale-95"
                >
                  Start Reading
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
