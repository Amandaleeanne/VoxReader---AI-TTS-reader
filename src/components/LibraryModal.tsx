import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Search,
  Trash2,
  BookOpen,
  X,
  ExternalLink,
  Sparkles,
  Download,
  Upload,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ArticleDocument } from '../types';
import {
  getAllArticlesFromStorage,
  deleteArticleFromStorage,
  toggleArticleFavorite,
  saveArticleToStorage,
} from '../utils/storage';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentArticleId?: string;
  onSelectArticle: (article: ArticleDocument, startSentenceIndex?: number) => void;
  onArticlesChange?: (articles: ArticleDocument[]) => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  currentArticleId,
  onSelectArticle,
  onArticlesChange,
}) => {
  const [articles, setArticles] = useState<ArticleDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  // Load articles - only display loading screen on initial open when list is empty
  const loadArticles = async (showSpinner = false) => {
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const list = await getAllArticlesFromStorage();
      setArticles(list);
      onArticlesChange?.(list);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      if (showSpinner) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadArticles(articles.length === 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle favorite optimistically without flashing or reloading
  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setArticles((prev) => {
      const updated = prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a));
      onArticlesChange?.(updated);
      return updated;
    });

    try {
      await toggleArticleFavorite(id);
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      loadArticles(false);
    }
  };

  // Delete article optimistically and seamlessly - removes instantly without full reload
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (deletingId === id) {
      // Optimistic instant removal from UI
      setArticles((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        onArticlesChange?.(updated);
        return updated;
      });
      setDeletingId(null);

      try {
        await deleteArticleFromStorage(id);
      } catch (err) {
        console.error('Failed to delete article:', err);
        // Rollback on error
        loadArticles(false);
      }
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId((curr) => (curr === id ? null : curr)), 4000);
    }
  };

  // Export Library
  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(articles, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `voxread-library-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Library
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportMessage(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          for (const doc of imported) {
            if (doc.id && doc.paragraphs) {
              await saveArticleToStorage(doc);
            }
          }
          await loadArticles();
          setImportMessage(`Imported ${imported.length} articles successfully.`);
        }
      } catch (err) {
        setImportMessage('Invalid library backup file format.');
      }
    };
    reader.readAsText(file);
  };

  // Filtered list
  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorites ? a.favorite : true;
    return matchesSearch && matchesFav;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                Offline Reading Library
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {articles.length} article{articles.length === 1 ? '' : 's'} saved locally for 100% offline listening
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Message Banner */}
        {importMessage && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
            <span>{importMessage}</span>
            <button onClick={() => setImportMessage(null)} className="p-0.5 text-amber-600 hover:text-amber-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 bg-neutral-50/70 dark:bg-neutral-800/40 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search title, author, domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                filterFavorites
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${filterFavorites ? 'fill-current' : ''}`} />
              <span>Favorites Only</span>
            </button>

            <button
              onClick={handleExport}
              disabled={articles.length === 0}
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-40"
              title="Backup / Export Library as JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <label
              className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-pointer"
              title="Import Library Backup"
            >
              <Upload className="w-4 h-4" />
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Article List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-neutral-400">Loading library...</div>
          ) : filteredArticles.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <BookOpen className="w-10 h-10 text-neutral-300 dark:text-neutral-700" />
              <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
                {searchQuery || filterFavorites ? 'No matching articles found.' : 'No saved articles yet.'}
              </p>
              <p className="text-xs text-neutral-400">
                Save any article or book while reading to access it offline anytime.
              </p>
            </div>
          ) : (
            filteredArticles.map((article) => {
              const progress =
                article.totalSentences > 0
                  ? Math.round(((article.lastReadSentenceIndex || 0) / article.totalSentences) * 100)
                  : 0;

              const isCurrentlyOpen = article.id === currentArticleId;

              return (
                <div
                  key={article.id}
                  onClick={() => {
                    onSelectArticle(article, article.lastReadSentenceIndex || 0);
                    onClose();
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${
                    isCurrentlyOpen
                      ? 'border-amber-400 bg-amber-50/50 dark:bg-neutral-800 dark:border-amber-500'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/40 hover:border-amber-300 dark:hover:border-neutral-700 hover:shadow-sm'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {article.fileType}
                      </span>
                      {article.domain && (
                        <span className="text-[11px] text-neutral-400 truncate max-w-[150px]">
                          {article.domain}
                        </span>
                      )}
                      {isCurrentlyOpen && (
                        <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                          (Currently Reading)
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {article.title}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1">
                      <span>{article.totalWords.toLocaleString()} words</span>
                      <span>•</span>
                      <span>{article.totalSentences} sentences</span>
                      <span>•</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {progress}% completed
                      </span>
                    </div>
                  </div>

                  {/* Actions & Resume Button */}
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={(e) => handleToggleFavorite(e, article.id)}
                      className="p-1.5 text-neutral-400 hover:text-amber-500 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                      title={article.favorite ? 'Remove Favorite' : 'Mark Favorite'}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          article.favorite ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                    </button>

                    <button
                      onClick={(e) => handleDelete(e, article.id)}
                      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        deletingId === article.id
                          ? 'bg-red-500 text-white text-xs font-semibold px-2.5'
                          : 'text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                      title={deletingId === article.id ? 'Click to permanently delete' : 'Delete from Library'}
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === article.id && <span>Confirm?</span>}
                    </button>

                    <button className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-black dark:bg-amber-400 dark:hover:bg-amber-300 text-white dark:text-neutral-950 rounded-xl text-xs font-semibold shadow-sm transition-all group-hover:scale-105">
                      <span>Resume</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
