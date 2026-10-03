import React, { useEffect, useRef } from 'react';
import { ArticleDocument, DisplaySettings, SentenceItem, WordToken } from '../types';
import { tokenizeWords, decodeHtmlAndNormalizeQuotes, extractLinkFromToken } from '../utils/textParser';
import { ExternalLink, ChevronLeft, ChevronRight, BookOpen, FileText } from 'lucide-react';

interface ReaderViewProps {
  document: ArticleDocument;
  currentSentenceIndex: number;
  currentWordIndex: number | null;
  isPlaying: boolean;
  autoScroll: boolean;
  displaySettings: DisplaySettings;
  onSentenceClick: (sentenceIndex: number) => void;
  onNavigateToUrl?: (url: string) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  document,
  currentSentenceIndex,
  currentWordIndex,
  isPlaying,
  autoScroll,
  displaySettings,
  onSentenceClick,
  onNavigateToUrl,
}) => {
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null);

  // Auto-scroll to active sentence
  useEffect(() => {
    if (autoScroll && activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex, autoScroll]);

  // Typography styling classes based on displaySettings
  const getThemeClasses = () => {
    switch (displaySettings.theme) {
      case 'paper':
        return 'bg-[#fdfbf7] text-[#292524]';
      case 'light':
        return 'bg-white text-neutral-900';
      case 'dark':
        return 'bg-[#18181b] text-[#e4e4e7]';
      case 'midnight':
        return 'bg-black text-[#e2e8f0]';
      case 'forest':
        return 'bg-[#f4f7f4] text-[#1c3325]';
      default:
        return 'bg-[#fdfbf7] text-[#292524]';
    }
  };

  const getFontFamilyClass = () => {
    switch (displaySettings.fontFamily) {
      case 'serif':
        return 'font-serif';
      case 'sans':
        return 'font-sans';
      case 'dyslexic':
        return 'font-sans tracking-wide';
      case 'mono':
        return 'font-mono text-[92%]';
      default:
        return 'font-serif';
    }
  };

  const getFontSizeClass = () => {
    switch (displaySettings.fontSize) {
      case 'sm':
        return 'text-base sm:text-lg';
      case 'base':
        return 'text-lg sm:text-xl';
      case 'lg':
        return 'text-xl sm:text-2xl';
      case 'xl':
        return 'text-2xl sm:text-3xl';
      case '2xl':
        return 'text-3xl sm:text-4xl';
      default:
        return 'text-lg sm:text-xl';
    }
  };

  const getLineHeightClass = () => {
    switch (displaySettings.lineHeight) {
      case 'tight':
        return 'leading-snug';
      case 'normal':
        return 'leading-relaxed';
      case 'relaxed':
        return 'leading-loose';
      default:
        return 'leading-relaxed';
    }
  };

  // Helper for bionic reading formatting (preserves punctuation and formatting cleanly)
  const renderWordText = (word: string) => {
    if (!displaySettings.bionicReading || word.length <= 1) {
      return word;
    }
    const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u);
    if (!match) return word;
    const [, leading, core, trailing] = match;
    const midPoint = Math.max(1, Math.ceil(core.length * 0.45));
    const prefix = core.slice(0, midPoint);
    const suffix = core.slice(midPoint);
    return (
      <>
        {leading}
        <strong className="font-bold opacity-100">{prefix}</strong>
        <span>{suffix}</span>
        {trailing}
      </>
    );
  };

  return (
    <main
      className={`min-h-[calc(100vh-140px)] w-full py-8 sm:py-12 px-4 sm:px-8 transition-colors duration-200 ${getThemeClasses()}`}
    >
      <article className="max-w-3xl mx-auto pb-28">
        {/* Document Header */}
        <header className="mb-8 pb-6 border-b border-neutral-200/60 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              {document.fileType}
            </span>
            {document.domain && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                via {document.domain}
              </span>
            )}
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              • {document.totalWords.toLocaleString()} words • {document.totalSentences} sentences
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2 leading-tight">
            {document.title}
          </h1>

          {document.author && (
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
              By {document.author}
            </p>
          )}
        </header>

        {/* Content with Paragraphs, Sentences and Word-level Highlights */}
        <div
          className={`space-y-6 select-text transition-all ${getFontFamilyClass()} ${getFontSizeClass()} ${getLineHeightClass()}`}
        >
          {document.paragraphs.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 bg-neutral-50/50 dark:bg-neutral-900/30">
              <FileText className="w-12 h-12 mx-auto mb-3 text-neutral-300 dark:text-neutral-600" />
              <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300">
                Blank Document
              </h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-sm mx-auto">
                This document currently contains no text. You can paste text or add another file anytime.
              </p>
            </div>
          ) : (
            document.paragraphs.map((paragraph) => {
            const isHeading = paragraph.isHeading;
            const headingLevel = paragraph.headingLevel || 2;

            let paragraphContainerClass = "relative group text-justify sm:text-left";
            if (isHeading) {
              if (headingLevel === 1) {
                paragraphContainerClass = "relative group text-2xl sm:text-3xl font-extrabold tracking-tight mt-10 mb-4 pb-2 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-50";
              } else if (headingLevel === 2) {
                paragraphContainerClass = "relative group text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-3 pb-1.5 border-b border-neutral-100 dark:border-neutral-800/60 text-neutral-900 dark:text-neutral-50";
              } else {
                paragraphContainerClass = "relative group text-lg sm:text-xl font-bold tracking-tight mt-6 mb-2 text-neutral-900 dark:text-neutral-100";
              }
            }

            return (
              <div key={paragraph.id} className={paragraphContainerClass}>
                {paragraph.sentences.map((sentence) => {
                  const isCurrentSentence = sentence.globalIndex === currentSentenceIndex;
                  const isSentencePast = sentence.globalIndex < currentSentenceIndex;

                  // Focus mode opacity
                  const opacityClass =
                    displaySettings.focusMode && !isCurrentSentence
                      ? 'opacity-35 hover:opacity-85 transition-opacity duration-200'
                      : 'opacity-100';

                  // Sentence highlight theme styles
                  let sentenceHighlightStyle = '';
                  if (isCurrentSentence) {
                    if (displaySettings.theme === 'paper') {
                      sentenceHighlightStyle = 'bg-amber-100/90 text-amber-950 shadow-sm ring-2 ring-amber-300/80';
                    } else if (displaySettings.theme === 'light') {
                      sentenceHighlightStyle = 'bg-amber-100 text-neutral-900 ring-2 ring-amber-300';
                    } else if (displaySettings.theme === 'dark') {
                      sentenceHighlightStyle = 'bg-amber-950/50 text-white ring-1 ring-amber-500/70';
                    } else if (displaySettings.theme === 'midnight') {
                      sentenceHighlightStyle = 'bg-indigo-950/70 text-indigo-100 ring-1 ring-indigo-500';
                    } else if (displaySettings.theme === 'forest') {
                      sentenceHighlightStyle = 'bg-emerald-100/90 text-emerald-950 ring-2 ring-emerald-400';
                    }
                  }

                  return (
                    <span
                      key={sentence.id}
                      ref={isCurrentSentence ? activeSentenceRef : null}
                      onClick={() => onSentenceClick(sentence.globalIndex)}
                      className={`inline rounded-md px-1 py-0.5 mx-0.5 cursor-pointer transition-all duration-150 relative ${opacityClass} ${
                        isCurrentSentence
                          ? `${sentenceHighlightStyle} font-medium`
                          : 'hover:bg-amber-50 dark:hover:bg-neutral-800/60'
                      }`}
                      title={`Click to read: "${sentence.text.slice(0, 40)}..."`}
                    >
                      {(() => {
                        const hasEntities = /&(?:#\s*\d+|#x[0-9a-f]+|[a-z]+);?|822[01];?|821[67];?/i.test(sentence.text);
                        const hasTextPunctuation = /[.?!]/.test(sentence.text);
                        const wordsMissingPunctuation =
                          !sentence.words ||
                          sentence.words.length === 0 ||
                          hasEntities ||
                          (hasTextPunctuation && !sentence.words.some((w) => /[.?!]/.test(w.word)));

                        const effectiveWords =
                          wordsMissingPunctuation && sentence.text
                            ? tokenizeWords(decodeHtmlAndNormalizeQuotes(sentence.text))
                            : sentence.words;

                        return effectiveWords.map((wordToken, wIdx) => {
                          const isCurrentWord = isCurrentSentence && currentWordIndex === wIdx;
                          const isLastWord = wIdx === effectiveWords.length - 1;

                          let wordToDisplay = decodeHtmlAndNormalizeQuotes(wordToken.word);
                          // Strip mailto: prefix so e-mail addresses render cleanly as plain text
                          if (/^mailto:/i.test(wordToDisplay)) {
                            wordToDisplay = wordToDisplay.replace(/^mailto:\s*/i, '');
                          }
                          // Guaranteed period display: If sentence.text has ending punctuation (. ! ? ...) missing from wordToDisplay, append it
                          if (isLastWord && sentence.text && !isHeading) {
                            const cleanText = decodeHtmlAndNormalizeQuotes(sentence.text).trim();
                            const trailingMatch = cleanText.match(/([.?!]+["'”’)]*)$/);
                            if (trailingMatch && !/[.?!]["'”’)]*$/.test(wordToDisplay)) {
                              wordToDisplay = wordToDisplay + trailingMatch[1];
                            }
                          }

                          // Active Word Highlighting - flat inline highlight, darker than sentence, zero scaling or layout shift
                          let wordHighlightStyle = '';
                          if (isCurrentWord) {
                            if (displaySettings.theme === 'paper') {
                              wordHighlightStyle = 'bg-amber-300 text-amber-950 rounded-xs px-0.5';
                            } else if (displaySettings.theme === 'light') {
                              wordHighlightStyle = 'bg-amber-300 text-neutral-950 rounded-xs px-0.5';
                            } else if (displaySettings.theme === 'dark') {
                              wordHighlightStyle = 'bg-amber-500 text-neutral-950 rounded-xs px-0.5';
                            } else if (displaySettings.theme === 'midnight') {
                              wordHighlightStyle = 'bg-indigo-600 text-white rounded-xs px-0.5';
                            } else if (displaySettings.theme === 'forest') {
                              wordHighlightStyle = 'bg-emerald-300 text-emerald-950 rounded-xs px-0.5';
                            }
                          }

                          // Check if this token is or contains an external hyperlink (internal hyperlinks are discarded)
                          const linkInfo = isHeading ? null : extractLinkFromToken(wordToDisplay, document.sourceUrl);

                          if (linkInfo) {
                            return (
                              <span
                                key={`${sentence.id}-w-${wIdx}`}
                                className={`inline relative ${isCurrentWord ? wordHighlightStyle : ''}`}
                              >
                                <a
                                  href={linkInfo.url}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onNavigateToUrl?.(linkInfo.url);
                                  }}
                                  onDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onNavigateToUrl?.(linkInfo.url);
                                  }}
                                  title={`Click or double-click to load in reader: ${linkInfo.url}`}
                                  className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 underline underline-offset-3 decoration-sky-400 dark:decoration-sky-500 font-medium hover:bg-sky-100/70 dark:hover:bg-sky-950/60 rounded px-1 -mx-0.5 transition-colors cursor-pointer inline-flex items-center gap-0.5 group/link"
                                >
                                  <span>{renderWordText(linkInfo.displayText)}</span>
                                  <ExternalLink className="w-3 h-3 opacity-60 group-hover/link:opacity-100 shrink-0 inline ml-0.5 text-sky-500" />
                                </a>{' '}
                              </span>
                            );
                          }

                          return (
                            <span
                              key={`${sentence.id}-w-${wIdx}`}
                              className={isCurrentWord ? wordHighlightStyle : ''}
                            >
                              {renderWordText(wordToDisplay)}{' '}
                            </span>
                          );
                        });
                      })()}
                    </span>
                  );
                })}
              </div>
            );
          }))}

          {/* Documentation Navigation (Next / Previous Article buttons) */}
          {document.docNavigation && (document.docNavigation.next || document.docNavigation.prev) && (
            <div className="mt-12 pt-8 border-t border-neutral-200/80 dark:border-neutral-800">
              <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                <BookOpen className="w-4 h-4 text-amber-500" />
                <span>Documentation Guide</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {document.docNavigation.prev ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToUrl?.(document.docNavigation!.prev!.url)}
                    className="flex flex-col items-start p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/40 hover:bg-amber-50/60 dark:hover:bg-neutral-800/80 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-left group shadow-xs cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      <ChevronLeft className="w-4 h-4" /> Previous Article
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-white line-clamp-2">
                      {document.docNavigation.prev.title}
                    </span>
                  </button>
                ) : (
                  <div />
                )}

                {document.docNavigation.next && (
                  <button
                    type="button"
                    onClick={() => onNavigateToUrl?.(document.docNavigation!.next!.url)}
                    className="flex flex-col items-end p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/40 hover:bg-amber-50/60 dark:hover:bg-neutral-800/80 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-right group shadow-xs cursor-pointer sm:col-start-2"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                      Next Article <ChevronRight className="w-4 h-4" />
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-white line-clamp-2">
                      {document.docNavigation.next.title}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </main>
  );
};
