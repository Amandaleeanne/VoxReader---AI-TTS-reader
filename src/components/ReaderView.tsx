import React, { useEffect, useRef } from 'react';
import { ArticleDocument, DisplaySettings, SentenceItem, WordToken } from '../types';
import { tokenizeWords, decodeHtmlAndNormalizeQuotes, extractLinkFromToken } from '../utils/textParser';
import {
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  FileText,
  FileCode,
  Layers,
  Calendar,
  Building2,
  HardDrive,
  Clock,
  Quote,
  Terminal,
  Check,
} from 'lucide-react';

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

function renderCellMarkdown(text: string, onNavigate?: (url: string) => void): React.ReactNode {
  if (!text) return '';
  const decoded = decodeHtmlAndNormalizeQuotes(text);

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(decoded)) !== null) {
    if (match.index > lastIdx) {
      parts.push(decoded.slice(lastIdx, match.index));
    }

    if (match[2] && match[3]) {
      const label = match[2];
      const url = match[3];
      parts.push(
        <a
          key={`l-${match.index}`}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            onNavigate?.(url);
          }}
          className="text-sky-600 dark:text-sky-400 hover:underline font-medium inline-flex items-center gap-0.5"
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 inline opacity-70" />
        </a>
      );
    } else if (match[4] || match[5]) {
      parts.push(<strong key={`b-${match.index}`} className="font-bold">{match[4] || match[5]}</strong>);
    } else if (match[6]) {
      parts.push(
        <code key={`c-${match.index}`} className="font-mono text-[88%] bg-neutral-200/60 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded border border-neutral-300/60 dark:border-neutral-700/60">
          {match[6]}
        </code>
      );
    } else if (match[7] || match[8]) {
      parts.push(<em key={`i-${match.index}`} className="italic">{match[7] || match[8]}</em>);
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < decoded.length) {
    parts.push(decoded.slice(lastIdx));
  }

  return parts.length > 0 ? parts : decoded;
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

  // Render a sentence span with word tracking, clicking, and highlights
  const renderSentenceSpan = (sentence: SentenceItem, isHeadingContext: boolean = false) => {
    const isCurrentSentence = sentence.globalIndex === currentSentenceIndex;

    const opacityClass =
      displaySettings.focusMode && !isCurrentSentence
        ? 'opacity-35 hover:opacity-85 transition-opacity duration-200'
        : 'opacity-100';

    let sentenceHighlightStyle = '';
    if (isCurrentSentence) {
      if (displaySettings.theme === 'paper') {
        sentenceHighlightStyle = 'bg-amber-100/90 text-amber-950 shadow-xs ring-2 ring-amber-300/80';
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
        {effectiveWords.map((wordToken, wIdx) => {
          const isCurrentWord = isCurrentSentence && currentWordIndex === wIdx;
          const isLastWord = wIdx === effectiveWords.length - 1;

          let wordToDisplay = decodeHtmlAndNormalizeQuotes(wordToken.word);
          if (/^mailto:/i.test(wordToDisplay)) {
            wordToDisplay = wordToDisplay.replace(/^mailto:\s*/i, '');
          }
          if (isLastWord && sentence.text && !isHeadingContext) {
            const cleanText = decodeHtmlAndNormalizeQuotes(sentence.text).trim();
            const trailingMatch = cleanText.match(/([.?!]+["'”’)]*)$/);
            if (trailingMatch && !/[.?!]["'”’)]*$/.test(wordToDisplay)) {
              wordToDisplay = wordToDisplay + trailingMatch[1];
            }
          }

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

          const linkInfo = isHeadingContext ? null : extractLinkFromToken(wordToDisplay, document.sourceUrl);

          let wordNode: React.ReactNode = renderWordText(wordToDisplay);

          if (wordToken.isCode) {
            wordNode = (
              <code className="font-mono text-[88%] bg-neutral-150 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded border border-neutral-300/60 dark:border-neutral-700/60 select-text">
                {wordNode}
              </code>
            );
          }
          if (wordToken.isBold) {
            wordNode = <strong className="font-bold">{wordNode}</strong>;
          }
          if (wordToken.isItalic) {
            wordNode = <em className="italic">{wordNode}</em>;
          }
          if (wordToken.isUnderline) {
            wordNode = <span className="underline underline-offset-2">{wordNode}</span>;
          }
          if (wordToken.isStrikethrough) {
            wordNode = <span className="line-through opacity-75">{wordNode}</span>;
          }

          if (linkInfo) {
            return (
              <React.Fragment key={`${sentence.id}-w-${wIdx}`}>
                <span
                  className={`inline relative ${isCurrentWord ? wordHighlightStyle : ''}`}
                >
                  <a
                    href={linkInfo.url}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onNavigateToUrl?.(linkInfo.url);
                    }}
                    title={`Click to load in reader: ${linkInfo.url}`}
                    className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 underline underline-offset-3 decoration-sky-400 dark:decoration-sky-500 font-medium hover:bg-sky-100/70 dark:hover:bg-sky-950/60 rounded px-1 -mx-0.5 transition-colors cursor-pointer inline-flex items-center gap-0.5 group/link"
                  >
                    <span>{renderWordText(linkInfo.displayText)}</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover/link:opacity-100 shrink-0 inline ml-0.5 text-sky-500" />
                  </a>
                </span>
                {wordToken.hasLineBreakAfter ? <br className="select-none" /> : ' '}
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={`${sentence.id}-w-${wIdx}`}>
              <span
                className={isCurrentWord ? wordHighlightStyle : ''}
              >
                {wordNode}
              </span>
              {wordToken.hasLineBreakAfter ? <br className="select-none" /> : ' '}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  const getFormatBadge = () => {
    switch (document.fileType) {
      case 'pdf':
        return {
          label: 'PDF Document',
          icon: <FileText className="w-3 h-3 text-rose-500" />,
          classes: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
        };
      case 'epub':
        return {
          label: 'EPUB Book',
          icon: <BookOpen className="w-3 h-3 text-indigo-500" />,
          classes: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60',
        };
      case 'text':
        return {
          label: 'Formatted Text',
          icon: <FileCode className="w-3 h-3 text-teal-500" />,
          classes: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900/60',
        };
      case 'webpage':
        return {
          label: 'Web Article',
          icon: <ExternalLink className="w-3 h-3 text-amber-500" />,
          classes: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
        };
      default:
        return {
          label: 'Reader Document',
          icon: <FileText className="w-3 h-3 text-neutral-500" />,
          classes: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700',
        };
    }
  };

  const formatBadge = getFormatBadge();
  const estReadTime = Math.max(1, Math.round(document.totalWords / 200));

  return (
    <main
      className={`min-h-[calc(100vh-140px)] w-full py-8 sm:py-12 px-4 sm:px-8 transition-colors duration-200 ${getThemeClasses()}`}
    >
      <article className="max-w-3xl mx-auto pb-28">
        {/* Document Header with Rich File Metadata */}
        <header className="mb-10 pb-6 border-b border-neutral-200/60 dark:border-neutral-800">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold uppercase tracking-wider border ${formatBadge.classes}`}>
              {formatBadge.icon}
              {formatBadge.label}
            </span>

            {document.domain && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                via {document.domain}
              </span>
            )}

            {/* PDF Page Count */}
            {document.metadataDetails?.pageCount && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium bg-neutral-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded">
                <Layers className="w-3 h-3 text-neutral-400" />
                {document.metadataDetails.pageCount} Pages
              </span>
            )}

            {/* EPUB Chapters */}
            {document.metadataDetails?.chapters && document.metadataDetails.chapters.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium bg-neutral-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded">
                <BookOpen className="w-3 h-3 text-indigo-400" />
                {document.metadataDetails.chapters.length} Chapters
              </span>
            )}

            {/* File Size */}
            {document.metadataDetails?.fileSizeFormatted && (
              <span className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                <HardDrive className="w-3 h-3" />
                {document.metadataDetails.fileSizeFormatted}
              </span>
            )}

            {/* Reading Time */}
            <span className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
              <Clock className="w-3 h-3" />
              {estReadTime} min read · {document.totalWords.toLocaleString()} words
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2 leading-tight">
            {document.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-neutral-600 dark:text-neutral-300">
            {document.author && (
              <p>By <span className="text-neutral-900 dark:text-neutral-100 font-semibold">{document.author}</span></p>
            )}
            {document.metadataDetails?.publisher && (
              <p className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-xs">
                <Building2 className="w-3.5 h-3.5" />
                {document.metadataDetails.publisher}
              </p>
            )}
            {document.metadataDetails?.publicationDate && (
              <p className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                {document.metadataDetails.publicationDate.slice(0, 10)}
              </p>
            )}
          </div>
        </header>

        {/* Content with Paragraphs, Sentences, and Exact File-Type Formatting */}
        <div
          className={`space-y-6 select-text transition-all text-left ${getFontFamilyClass()} ${getFontSizeClass()} ${getLineHeightClass()}`}
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
              // 1. PDF Page Break
              if (paragraph.blockType === 'page-break') {
                return (
                  <div
                    key={paragraph.id}
                    className="my-10 flex items-center justify-center gap-3 select-none"
                  >
                    <div className="h-px bg-neutral-200/80 dark:bg-neutral-800 flex-1" />
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-semibold tracking-wider uppercase border border-neutral-200/70 dark:border-neutral-700 shadow-2xs">
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span>
                        Page {paragraph.pageNumber}{' '}
                        {document.metadataDetails?.pageCount ? `of ${document.metadataDetails.pageCount}` : ''}
                      </span>
                    </div>
                    <div className="h-px bg-neutral-200/80 dark:bg-neutral-800 flex-1" />
                  </div>
                );
              }

              // 2. Horizontal Divider / Scene Break
              if (paragraph.blockType === 'divider') {
                return (
                  <div
                    key={paragraph.id}
                    className="my-8 flex items-center justify-center gap-3 select-none text-neutral-300 dark:text-neutral-700"
                  >
                    <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1 max-w-xs" />
                    <span className="text-sm tracking-widest font-serif opacity-80">✦ ✦ ✦</span>
                    <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1 max-w-xs" />
                  </div>
                );
              }

              // Table Block (Markdown, EPUB, or PDF tables)
              if (paragraph.blockType === 'table' && paragraph.tableData) {
                const { headers, rows, alignments } = paragraph.tableData;
                const getColAlign = (idx: number) => {
                  const al = alignments?.[idx];
                  if (al === 'center') return 'text-center';
                  if (al === 'right') return 'text-right';
                  return 'text-left';
                };

                return (
                  <div
                    key={paragraph.id}
                    className="my-8 overflow-hidden rounded-xl border border-neutral-200/90 dark:border-neutral-800 shadow-xs bg-white/80 dark:bg-neutral-900/70"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        {headers.length > 0 && (
                          <thead className="bg-neutral-100/90 dark:bg-neutral-800/90 text-xs uppercase font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200/80 dark:border-neutral-700/80">
                            <tr>
                              {headers.map((h, hIdx) => (
                                <th key={hIdx} className={`px-4 py-3 font-semibold tracking-wider ${getColAlign(hIdx)}`}>
                                  {renderCellMarkdown(h, onNavigateToUrl)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
                          {rows.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-amber-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                            >
                              {row.map((cell, cIdx) => (
                                <td key={cIdx} className={`px-4 py-2.5 text-neutral-800 dark:text-neutral-200 ${getColAlign(cIdx)}`}>
                                  {renderCellMarkdown(cell, onNavigateToUrl)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {paragraph.sentences.length > 0 && (
                      <div className="p-3 bg-neutral-50/90 dark:bg-neutral-900/90 border-t border-neutral-200/70 dark:border-neutral-800 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest text-[10px] mr-1 select-none">
                          Table Audio:
                        </span>
                        {paragraph.sentences.map((sentence) => renderSentenceSpan(sentence, false))}
                      </div>
                    )}
                  </div>
                );
              }

              // 3. EPUB Chapter Header (Prefers Left adjustment)
              if (paragraph.blockType === 'chapter-header') {
                const chapterAlignClass = displaySettings.textAlign === 'center' ? 'text-center' : 'text-left';
                return (
                  <div
                    key={paragraph.id}
                    className={`my-12 pt-4 pb-6 ${chapterAlignClass} border-b border-amber-200/60 dark:border-amber-900/40`}
                  >
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/40 mb-3">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{paragraph.chapterTitle || 'Chapter'}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
                      {paragraph.sentences.map((s) => renderSentenceSpan(s, true))}
                    </h2>
                  </div>
                );
              }

              // 4. Blockquote
              if (paragraph.blockType === 'blockquote') {
                return (
                  <blockquote
                    key={paragraph.id}
                    className="my-6 pl-5 pr-4 py-3.5 border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 rounded-r-xl italic text-neutral-800 dark:text-neutral-200 shadow-2xs relative group"
                  >
                    <Quote className="w-4 h-4 text-amber-400 dark:text-amber-600 mb-1 opacity-70" />
                    <div className="text-left">
                      {paragraph.sentences.map((s) => renderSentenceSpan(s, false))}
                    </div>
                  </blockquote>
                );
              }

              // 5. Code Block (Preformatted text)
              if (paragraph.blockType === 'code') {
                return (
                  <div
                    key={paragraph.id}
                    className="my-6 rounded-xl bg-neutral-900 dark:bg-black p-4 font-mono text-xs sm:text-sm text-emerald-400 dark:text-emerald-300 overflow-x-auto border border-neutral-800 shadow-inner"
                  >
                    <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-semibold mb-2 pb-1 border-b border-neutral-800 select-none">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Code Block</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono">
                      {paragraph.sentences.map((s) => renderSentenceSpan(s, false))}
                    </pre>
                  </div>
                );
              }

              // 6. List Item (Markdown bullet points, numbered lists, task lists)
              if (paragraph.blockType === 'list-item') {
                const isTask = paragraph.listMarker === '[ ]' || paragraph.listMarker === '[x]';
                const isChecked = paragraph.listMarker === '[x]';
                const isOrdered = Boolean(paragraph.listMarker && /^\d+[\.\)]|[a-zA-Z][\.\)]/.test(paragraph.listMarker));
                const indentLevel = Math.min(Math.floor((paragraph.indentPx || 0) / 16), 4);
                const indentClass =
                  indentLevel === 1 ? 'pl-6 sm:pl-8' :
                  indentLevel === 2 ? 'pl-10 sm:pl-12' :
                  indentLevel >= 3 ? 'pl-14 sm:pl-16' :
                  'pl-2 sm:pl-4';

                return (
                  <div key={paragraph.id} className={`flex items-start gap-3 my-2.5 ${indentClass} group`}>
                    {isTask ? (
                      isChecked ? (
                        <span className="w-4 h-4 rounded bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5 select-none shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="w-4 h-4 rounded border-2 border-neutral-300 dark:border-neutral-600 flex items-center justify-center shrink-0 mt-0.5 select-none bg-white/70 dark:bg-neutral-800/70" />
                      )
                    ) : isOrdered ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400 select-none shrink-0 min-w-[1.25rem] text-right font-mono text-xs pt-0.5">
                        {paragraph.listMarker}
                      </span>
                    ) : indentLevel === 0 ? (
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0 mt-2 select-none shadow-2xs" />
                    ) : indentLevel === 1 ? (
                      <span className="w-2 h-2 rounded-full border-2 border-amber-500 dark:border-amber-400 shrink-0 mt-2 select-none" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-xs bg-amber-600 dark:bg-amber-300 shrink-0 mt-2 select-none" />
                    )}
                    <div className="flex-1 text-left min-w-0">
                      {paragraph.sentences.map((s) => renderSentenceSpan(s, false))}
                    </div>
                  </div>
                );
              }

              // 7. Standard Heading or Paragraph with Alignment, Indentation & Weight
              // Document viewer strictly prefers left adjustment instead of center adjustment for text
              const isHeading = paragraph.isHeading;
              const headingLevel = paragraph.headingLevel || 2;

              let alignClass = 'text-left';
              if (displaySettings.textAlign === 'center') {
                alignClass = 'text-center';
              } else if (displaySettings.textAlign === 'justify') {
                alignClass = 'text-justify';
              } else if (displaySettings.textAlign === 'left') {
                alignClass = 'text-left';
              } else if (paragraph.textAlign === 'right') {
                alignClass = 'text-right';
              } else if (paragraph.textAlign === 'justify') {
                alignClass = 'text-justify';
              } else {
                // When paragraph.textAlign is 'center' or undefined: document viewer prefers left adjustment!
                alignClass = 'text-left';
              }

              let weightClass = paragraph.isBold ? 'font-semibold' : '';
              let italicClass = paragraph.isItalic || paragraph.isPoemOrVerse ? 'italic' : '';
              let preClass = paragraph.preserveLineBreaks ? 'whitespace-pre-line' : '';
              const indentStyle =
                paragraph.indentPx && paragraph.indentPx > 10
                  ? { paddingLeft: `${Math.min(paragraph.indentPx, 48)}px` }
                  : undefined;

              let paragraphContainerClass = `relative group ${alignClass} ${weightClass} ${italicClass} ${preClass}`;
              if (isHeading) {
                if (headingLevel === 1) {
                  paragraphContainerClass = `relative group text-2xl sm:text-3xl font-extrabold tracking-tight mt-10 mb-4 pb-2 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-50 ${alignClass}`;
                } else if (headingLevel === 2) {
                  paragraphContainerClass = `relative group text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-3 pb-1.5 border-b border-neutral-100 dark:border-neutral-800/60 text-neutral-900 dark:text-neutral-50 ${alignClass}`;
                } else if (headingLevel === 3) {
                  paragraphContainerClass = `relative group text-lg sm:text-xl font-bold tracking-tight mt-6 mb-2 text-neutral-900 dark:text-neutral-100 ${alignClass}`;
                } else {
                  paragraphContainerClass = `relative group text-base sm:text-lg font-bold tracking-tight mt-5 mb-2 text-neutral-800 dark:text-neutral-200 ${alignClass}`;
                }
              }

              return (
                <div key={paragraph.id} className={paragraphContainerClass} style={indentStyle}>
                  {paragraph.sentences.map((sentence) => renderSentenceSpan(sentence, Boolean(isHeading)))}
                </div>
              );
            })
          )}

          {/* Documentation Navigation (Next / Previous Article buttons) */}
          {document.docNavigation && (document.docNavigation.prev || document.docNavigation.next) && (
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
                    className="flex flex-col items-start p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/40 hover:bg-amber-50/60 dark:hover:bg-neutral-800/80 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-left group shadow-2xs cursor-pointer"
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
                    className="flex flex-col items-end p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-800/40 hover:bg-amber-50/60 dark:hover:bg-neutral-800/80 hover:border-amber-400 dark:hover:border-amber-500/60 transition-all text-right group shadow-2xs cursor-pointer sm:col-start-2"
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
