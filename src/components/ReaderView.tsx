import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ArticleDocument, DisplaySettings, SentenceItem, WordToken, TocItem, ParagraphItem } from '../types';
import { tokenizeWords, decodeHtmlAndNormalizeQuotes, extractLinkFromToken } from '../utils/textParser';
import { isTruthValueToken } from '../utils/tableDetector';
import { MathView } from './MathView';
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
  ListTree,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Table as TableIcon,
  Copy,
  Volume2,
  Image as ImageIcon,
  FileImage,
  Eye,
  Hash,
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
  onTogglePageBreaks?: () => void;
}

function renderCellMarkdown(text: string, onNavigate?: (url: string) => void): React.ReactNode {
  if (!text) return '';
  const decoded = decodeHtmlAndNormalizeQuotes(text);
  const trimmed = decoded.trim();

  // Boolean Truth Value styling for truth table cells
  if (/^(t|true|1|v|⊤|✓)$/i.test(trimmed)) {
    return (
      <span className="inline-flex items-center justify-center font-bold font-mono text-xs px-2.5 py-0.5 rounded-md bg-emerald-100/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-2xs">
        {trimmed.toUpperCase() === 'T' ? 'T' : trimmed}
      </span>
    );
  }
  if (/^(f|false|0|⊥|✗)$/i.test(trimmed)) {
    return (
      <span className="inline-flex items-center justify-center font-bold font-mono text-xs px-2.5 py-0.5 rounded-md bg-rose-100/90 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300/80 dark:border-rose-700/60 shadow-2xs">
        {trimmed.toUpperCase() === 'F' ? 'F' : trimmed}
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  // Match links, math ($$...$$ or $...$), checkboxes ([x]/[ ]), bold, italic, code, line breaks
  const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))([^$\n]+?)(?<!\s)\$|\[([ xX])\]|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|<br\s*\/?>)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(decoded)) !== null) {
    if (match.index > lastIdx) {
      parts.push(decoded.slice(lastIdx, match.index));
    }

    if (match[2] && match[3]) {
      // Link: [label](url)
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
      // Display Math: $$...$$ or \[...\]
      const latex = (match[4] || match[5]).trim();
      parts.push(
        <MathView key={`m-${match.index}`} latex={latex} displayMode={true} className="my-1" />
      );
    } else if (match[6] || match[7]) {
      // Inline Math: \(...\) or $...$
      const latex = (match[6] || match[7]).trim();
      parts.push(
        <MathView key={`m-${match.index}`} latex={latex} displayMode={false} className="mx-0.5 inline-block" />
      );
    } else if (match[8] !== undefined) {
      // Checkbox: [x] or [ ]
      const isChecked = match[8].toLowerCase() === 'x';
      parts.push(
        isChecked ? (
          <span key={`chk-${match.index}`} className="inline-flex items-center justify-center w-3.5 h-3.5 rounded bg-amber-500 text-white text-[10px] mr-1 font-bold select-none">
            ✓
          </span>
        ) : (
          <span key={`chk-${match.index}`} className="inline-block w-3.5 h-3.5 rounded border border-neutral-400 dark:border-neutral-500 mr-1 align-middle select-none bg-white/70 dark:bg-neutral-800/70" />
        )
      );
    } else if (match[9] || match[10]) {
      // Bold
      parts.push(<strong key={`b-${match.index}`} className="font-bold">{match[9] || match[10]}</strong>);
    } else if (match[11]) {
      // Code
      parts.push(
        <code key={`c-${match.index}`} className="font-mono text-[88%] bg-neutral-200/60 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-400 px-1 py-0.5 rounded border border-neutral-300/60 dark:border-neutral-700/60 select-text">
          {match[11]}
        </code>
      );
    } else if (match[12] || match[13]) {
      // Italic
      parts.push(<em key={`i-${match.index}`} className="italic">{match[12] || match[13]}</em>);
    } else if (match[0].startsWith('<br')) {
      // Line break
      parts.push(<br key={`br-${match.index}`} />);
    }

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < decoded.length) {
    parts.push(decoded.slice(lastIdx));
  }

  return parts.length > 0 ? parts : decoded;
}

interface ReaderTableBlockProps {
  paragraph: ParagraphItem;
  currentSentenceIndex: number;
  isPlaying: boolean;
  activeSentenceRef: React.RefObject<HTMLElement | null>;
  onSentenceClick: (sentenceIndex: number) => void;
  onNavigateToUrl?: (url: string) => void;
  defaultTableDisplay?: 'pdf' | 'table' | 'both';
}

const ReaderTableBlock: React.FC<ReaderTableBlockProps> = ({
  paragraph,
  currentSentenceIndex,
  isPlaying,
  activeSentenceRef,
  onSentenceClick,
  onNavigateToUrl,
  defaultTableDisplay = 'both',
}) => {
  const tableData = paragraph.tableData;
  if (!tableData) return null;

  const { headers, rows, alignments, isTruthTable, title: tableTitle, imageUrl } = tableData;
  const isTruth =
    isTruthTable ||
    (rows.length >= 2 && rows.every((r) => r.length >= 2 && r.every((c) => isTruthValueToken(c))));

  const initialMode: 'pdf' | 'table' | 'both' = imageUrl
    ? (defaultTableDisplay || 'both')
    : 'table';
  const [viewMode, setViewMode] = useState<'pdf' | 'table' | 'both'>(initialMode);

  // Update default view mode when setting changes
  useEffect(() => {
    if (imageUrl && defaultTableDisplay) {
      setViewMode(defaultTableDisplay);
    }
  }, [defaultTableDisplay, imageUrl]);
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const getColAlign = (idx: number) => {
    const al = alignments?.[idx];
    if (al === 'center' || isTruth) return 'text-center';
    if (al === 'right') return 'text-right';
    return 'text-left';
  };

  const activeSentenceInTable = paragraph.sentences.find(
    (s) => s.globalIndex === currentSentenceIndex
  );
  const isTableActive = Boolean(activeSentenceInTable);

  const handleCopyMarkdown = () => {
    let md = '';
    if (tableTitle) md += `### ${tableTitle}\n\n`;
    if (headers.length > 0) {
      md += `| ${headers.join(' | ')} |\n`;
      md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    }
    for (const r of rows) {
      md += `| ${r.join(' | ')} |\n`;
    }
    navigator.clipboard?.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      id={paragraph.id}
      className={`my-8 overflow-hidden rounded-2xl border transition-all shadow-xs ${
        isTableActive
          ? isTruth
            ? 'border-emerald-400 dark:border-emerald-600 bg-white dark:bg-neutral-900 ring-2 ring-emerald-400/30'
            : 'border-amber-400 dark:border-amber-600 bg-white dark:bg-neutral-900 ring-2 ring-amber-400/30'
          : 'border-neutral-200/90 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/80'
      }`}
    >
      {/* Table Header Bar */}
      <div className="px-4 py-2.5 bg-neutral-50/90 dark:bg-neutral-850 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 select-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
            <TableIcon className={`w-3.5 h-3.5 ${isTruth ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span>{isTruth ? 'Truth Table' : 'Structured Table'}</span>
          </span>
          {tableTitle && (
            <>
              <span>•</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{tableTitle}</span>
            </>
          )}
          <span>•</span>
          <span>
            {rows.length} {rows.length === 1 ? 'row' : 'rows'}
          </span>
          {headers.length > 0 && <span>({headers.length} columns)</span>}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {imageUrl && (
            <div className="flex items-center bg-neutral-200/60 dark:bg-neutral-800 p-0.5 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  viewMode === 'pdf'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title="View original table crop from the PDF"
              >
                <FileImage className="w-3 h-3" />
                <span>PDF View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title="View interactive formatted data table"
              >
                <TableIcon className="w-3 h-3" />
                <span>Data Table</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
                  viewMode === 'both'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-2xs font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
                title="View both PDF original and interactive table"
              >
                <Layers className="w-3 h-3" />
                <span>Both</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1"
            title="Copy Table as Markdown"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* PDF View (Original Cropped Image from PDF) */}
      {(viewMode === 'pdf' || viewMode === 'both') && imageUrl && (
        <div className="p-4 bg-white dark:bg-neutral-950/30 flex flex-col items-center justify-center border-b border-neutral-100 dark:border-neutral-850">
          <div className="relative group/crop max-w-full overflow-hidden rounded-xl border border-neutral-200/70 dark:border-neutral-800 bg-white p-2 shadow-2xs">
            <img
              src={imageUrl}
              alt={tableTitle || 'Table in PDF'}
              className={`max-w-full object-contain mx-auto transition-all ${
                isZoomed ? 'max-h-[800px] scale-105' : 'max-h-[500px]'
              }`}
            />
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-neutral-900/75 hover:bg-neutral-900 text-white opacity-0 group-hover/crop:opacity-100 transition-opacity text-xs flex items-center gap-1 shadow-sm"
              title="Toggle Zoom"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isZoomed ? 'Reset' : 'Zoom'}</span>
            </button>
          </div>
          {viewMode === 'pdf' && (
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className="mt-3 text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              <TableIcon className="w-3 h-3" />
              <span>Show Interactive Data Table & TTS Reader</span>
            </button>
          )}
        </div>
      )}

      {/* Interactive Formatted Data Table */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            {headers.length > 0 && (
              <thead className="bg-neutral-100/90 dark:bg-neutral-800/90 text-xs font-semibold text-neutral-700 dark:text-neutral-300 border-b border-neutral-200/80 dark:border-neutral-700/80">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className={`px-4 py-3 tracking-wider ${getColAlign(hIdx)}`}>
                      {renderCellMarkdown(h, onNavigateToUrl)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800">
              {rows.map((row, rIdx) => {
                const rowSentence = paragraph.sentences[rIdx];
                const isCurrentRow = rowSentence
                  ? rowSentence.globalIndex === currentSentenceIndex
                  : false;

                return (
                  <tr
                    key={rIdx}
                    id={rowSentence ? `sentence-${rowSentence.globalIndex}` : undefined}
                    ref={isCurrentRow ? (el) => { if (activeSentenceRef.current !== undefined) activeSentenceRef.current = el; } : null}
                    onClick={() => {
                      if (rowSentence) {
                        onSentenceClick(rowSentence.globalIndex);
                      }
                    }}
                    className={`transition-colors cursor-pointer group/row ${
                      isCurrentRow
                        ? 'bg-amber-100/80 dark:bg-amber-950/60 font-medium text-neutral-950 dark:text-neutral-50 shadow-xs'
                        : 'hover:bg-amber-50/50 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200'
                    }`}
                    title={
                      rowSentence
                        ? `Click to read row aloud: Row ${rIdx + 1}`
                        : undefined
                    }
                  >
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className={`px-4 py-3 ${getColAlign(cIdx)} relative`}>
                        {cIdx === 0 && isCurrentRow && isPlaying && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-ping align-middle" />
                        )}
                        {renderCellMarkdown(cell, onNavigateToUrl)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Row Readout */}
      {isTableActive && activeSentenceInTable && (
        <div className="px-4 py-2 bg-amber-50/70 dark:bg-amber-950/30 border-t border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 flex items-center justify-between">
          <span className="italic truncate">"{activeSentenceInTable.text}"</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-widest shrink-0 ml-2 font-bold">
            Reading Row Aloud
          </span>
        </div>
      )}
    </div>
  );
};

interface ReaderFigureBlockProps {
  paragraph: ParagraphItem;
  currentSentenceIndex: number;
  activeSentenceRef: React.RefObject<HTMLElement | null>;
  onSentenceClick: (sentenceIndex: number) => void;
}

const ReaderFigureBlock: React.FC<ReaderFigureBlockProps> = ({
  paragraph,
  currentSentenceIndex,
  activeSentenceRef,
  onSentenceClick,
}) => {
  const fig = paragraph.figureData;
  const sentence = paragraph.sentences[0];
  const isCurrentSentence = sentence ? sentence.globalIndex === currentSentenceIndex : false;
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <figure
      id={paragraph.id}
      className={`my-8 overflow-hidden rounded-2xl border transition-all shadow-xs ${
        isCurrentSentence
          ? 'border-amber-400 dark:border-amber-600 bg-white dark:bg-neutral-900 ring-2 ring-amber-400/30'
          : 'border-neutral-200/90 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/80'
      }`}
    >
      {/* Figure Top Bar */}
      <div className="px-4 py-2.5 bg-neutral-50/90 dark:bg-neutral-850 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 select-none">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-300">
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>{fig?.figureNumber || 'Figure'}</span>
          </span>
          {paragraph.pageNumber && (
            <>
              <span>•</span>
              <span>Page {paragraph.pageNumber}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {fig?.imageUrl && (
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1 text-[11px]"
              title="Toggle zoom"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isZoomed ? 'Reset' : 'Zoom'}</span>
            </button>
          )}
          {sentence && (
            <button
              type="button"
              onClick={() => onSentenceClick(sentence.globalIndex)}
              className="hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors text-[11px]"
              title="Read figure caption aloud"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Read Caption</span>
            </button>
          )}
        </div>
      </div>

      {/* Cropped Image from PDF */}
      {fig?.imageUrl ? (
        <div className="p-4 bg-white dark:bg-neutral-950/40 flex justify-center items-center overflow-x-auto">
          <img
            src={fig.imageUrl}
            alt={fig.caption || 'Figure diagram'}
            className={`max-w-full object-contain rounded-lg shadow-2xs border border-neutral-200/60 dark:border-neutral-800 transition-all ${
              isZoomed ? 'max-h-[800px] scale-105' : 'max-h-[500px]'
            }`}
          />
        </div>
      ) : null}

      {/* Caption */}
      <figcaption
        id={sentence ? `sentence-${sentence.globalIndex}` : undefined}
        ref={isCurrentSentence ? (el) => { if (activeSentenceRef.current !== undefined) activeSentenceRef.current = el; } : null}
        onClick={() => sentence && onSentenceClick(sentence.globalIndex)}
        className={`px-5 py-3 border-t border-neutral-200/60 dark:border-neutral-800 text-xs sm:text-sm text-center font-medium cursor-pointer transition-colors ${
          isCurrentSentence
            ? 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-950 dark:text-amber-100 font-semibold'
            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
        }`}
      >
        {fig?.caption || paragraph.rawText}
      </figcaption>
    </figure>
  );
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  document,
  currentSentenceIndex,
  currentWordIndex,
  isPlaying,
  autoScroll,
  displaySettings,
  onSentenceClick,
  onNavigateToUrl,
  onTogglePageBreaks,
}) => {
  const activeSentenceRef = useRef<HTMLElement | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [tocSearch, setTocSearch] = useState('');
  const [isTocDrawerOpen, setIsTocDrawerOpen] = useState(false);

  // Jump directly to a Table of Contents entry
  const handleTocClick = (item: TocItem) => {
    let targetSentence = item.targetSentenceIndex;
    if (targetSentence === undefined && item.targetParagraphIndex !== undefined) {
      const p = document.paragraphs[item.targetParagraphIndex];
      if (p && p.sentences.length > 0) {
        targetSentence = p.sentences[0].globalIndex;
      }
    }

    if (targetSentence !== undefined) {
      onSentenceClick(targetSentence);
      setTimeout(() => {
        const sentenceEl = window.document.getElementById(`sentence-${targetSentence}`);
        if (sentenceEl) {
          sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      setIsTocDrawerOpen(false);
      return;
    }

    if (item.targetParagraphIndex !== undefined) {
      const p = document.paragraphs[item.targetParagraphIndex];
      if (p) {
        const pEl = window.document.getElementById(p.id);
        if (pEl) {
          pEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
    setIsTocDrawerOpen(false);
  };

  // Identify currently active TOC section
  const activeTocIndex = useMemo(() => {
    if (!document.tableOfContents || document.tableOfContents.length === 0) return -1;
    let foundIdx = -1;
    for (let i = 0; i < document.tableOfContents.length; i++) {
      const item = document.tableOfContents[i];
      let sIdx = item.targetSentenceIndex;
      if (sIdx === undefined && item.targetParagraphIndex !== undefined) {
        sIdx = document.paragraphs[item.targetParagraphIndex]?.sentences[0]?.globalIndex;
      }
      if (sIdx !== undefined && sIdx <= currentSentenceIndex) {
        foundIdx = i;
      } else if (sIdx !== undefined && sIdx > currentSentenceIndex) {
        break;
      }
    }
    return foundIdx;
  }, [document.tableOfContents, currentSentenceIndex, document.paragraphs]);

  // Filtered TOC list
  const filteredToc = useMemo(() => {
    if (!document.tableOfContents) return [];
    return document.tableOfContents
      .map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter((item) =>
        tocSearch ? item.title.toLowerCase().includes(tocSearch.toLowerCase()) : true
      );
  }, [document.tableOfContents, tocSearch]);

  // Check if document has pages or page break blocks
  const hasPageBreaks = useMemo(() => {
    return Boolean(
      (document.metadataDetails?.pageCount && document.metadataDetails.pageCount > 1) ||
      document.paragraphs.some((p) => p.blockType === 'page-break' || p.pageNumber !== undefined)
    );
  }, [document]);

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
        id={`sentence-${sentence.globalIndex}`}
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

          // Check for LaTeX math in token or surrounding punctuation
          const punctMathMatch =
            !wordToken.isMath && !isHeadingContext
              ? wordToDisplay.match(/^([(\["']?)(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))[^$\n]+?(?<!\s)\$)([)\]"',.;:!?]?)$/)
              : null;

          if (wordToken.isMath && wordToken.mathLatex) {
            wordNode = (
              <MathView
                latex={wordToken.mathLatex}
                displayMode={Boolean(wordToken.mathDisplayMode)}
                className="inline-block align-baseline mx-0.5"
              />
            );
          } else if (punctMathMatch) {
            const prefix = punctMathMatch[1];
            const mathStr = punctMathMatch[2];
            const suffix = punctMathMatch[3];
            const latex = mathStr.replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '').trim();
            const isDisplay = mathStr.startsWith('$$') || mathStr.startsWith('\\[');
            wordNode = (
              <span>
                {prefix}
                <MathView
                  latex={latex}
                  displayMode={isDisplay}
                  className="inline-block align-baseline mx-0.5"
                />
                {suffix}
              </span>
            );
          } else {
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

            {/* Seamless Mode vs Page Break Mode Quick Toggle */}
            {hasPageBreaks && onTogglePageBreaks && (
              <button
                type="button"
                onClick={onTogglePageBreaks}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-md border transition-all cursor-pointer ${
                  displaySettings.showPageBreaks
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 shadow-2xs'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title={
                  displaySettings.showPageBreaks
                    ? 'Page Break Mode active (showing dividers). Click for Seamless Mode'
                    : 'Seamless Mode active (hiding page dividers). Click for Page Break Mode'
                }
              >
                <FileText className="w-3 h-3 text-amber-500" />
                <span>{displaySettings.showPageBreaks ? 'Page Breaks: On' : 'Seamless Mode'}</span>
              </button>
            )}

            {/* Table of Contents Shortcut Badge */}
            {document.tableOfContents && document.tableOfContents.length > 0 && (
              <button
                type="button"
                onClick={() => setIsTocOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                  isTocOpen
                    ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                    : 'border-neutral-200 dark:border-neutral-700 bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400'
                }`}
                title="Toggle Table of Contents"
              >
                <ListTree className="w-3 h-3 text-indigo-500" />
                <span>{document.tableOfContents.length} Sections</span>
                {isTocOpen ? <ChevronUp className="w-2.5 h-2.5 opacity-60" /> : <ChevronDown className="w-2.5 h-2.5 opacity-60" />}
              </button>
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

            {/* Document File Hash Code */}
            {document.hashCode && (
              <span
                className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 font-mono bg-neutral-100/80 dark:bg-neutral-800/80 px-2 py-0.5 rounded"
                title={`File Hash Code: #${document.hashCode}`}
              >
                <Hash className="w-3 h-3 text-neutral-400" />
                #{document.hashCode}
              </span>
            )}
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

        {/* Interactive Table of Contents for PDFs, ePubs & Structured Documents */}
        {document.tableOfContents && document.tableOfContents.length > 0 && (
          <section className="mb-10 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/70 backdrop-blur-xs shadow-xs overflow-hidden">
            <div
              onClick={() => setIsTocOpen(!isTocOpen)}
              className="flex items-center justify-between px-5 py-3.5 bg-neutral-50/80 dark:bg-neutral-800/50 cursor-pointer hover:bg-neutral-100/70 dark:hover:bg-neutral-800/80 transition-colors select-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  <ListTree className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <span>Table of Contents</span>
                    <span className="text-[11px] font-semibold px-2 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                      {document.tableOfContents.length} {document.tableOfContents.length === 1 ? 'entry' : 'sections'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Click any chapter or section to jump and begin reading
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {isTocOpen ? 'Hide' : 'Show All'}
                </span>
                {isTocOpen ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                )}
              </div>
            </div>

            {isTocOpen && (
              <div className="p-4 border-t border-neutral-200/60 dark:border-neutral-800">
                {document.tableOfContents.length > 8 && (
                  <div className="relative mb-3">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Filter contents / chapters..."
                      value={tocSearch}
                      onChange={(e) => setTocSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                )}

                <div className="max-h-80 overflow-y-auto space-y-1 pr-1 divide-y divide-neutral-100 dark:divide-neutral-850">
                  {filteredToc.map((item, idx) => {
                    const isActive = activeTocIndex === item.originalIndex;
                    const levelIndent =
                      item.level && item.level > 1
                        ? item.level === 2
                          ? 'pl-5'
                          : 'pl-8'
                        : 'pl-2';

                    return (
                      <button
                        key={item.id || idx}
                        type="button"
                        onClick={() => handleTocClick(item)}
                        className={`w-full flex items-center justify-between text-left py-2 px-2.5 rounded-lg text-xs transition-colors group cursor-pointer ${levelIndent} ${
                          isActive
                            ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold shadow-2xs'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isActive
                                ? 'bg-amber-500 ring-2 ring-amber-300'
                                : 'bg-neutral-300 dark:bg-neutral-600 group-hover:bg-amber-400'
                            }`}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>

                        {item.pageNumber && (
                          <span className="shrink-0 ml-2 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            p. {item.pageNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

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
                if (!displaySettings.showPageBreaks) {
                  return null;
                }
                return (
                  <div
                    key={paragraph.id}
                    id={paragraph.id}
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

              // Math Display Block ($$...$$ or \[...\])
              if (paragraph.blockType === 'math' && paragraph.mathData) {
                const latex = paragraph.mathData.rawLatex;
                const spoken = paragraph.mathData.spokenText;
                const sentence = paragraph.sentences[0];
                const isCurrentSentence = sentence ? sentence.globalIndex === currentSentenceIndex : false;

                return (
                  <div
                    key={paragraph.id}
                    id={paragraph.id}
                    onClick={() => sentence && onSentenceClick(sentence.globalIndex)}
                    className={`my-8 p-6 rounded-2xl border transition-all cursor-pointer group ${
                      isCurrentSentence
                        ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-md ring-2 ring-amber-400/40'
                        : 'bg-white/90 dark:bg-neutral-900/80 border-neutral-200/90 dark:border-neutral-800 hover:border-amber-300 dark:hover:border-neutral-700 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100 dark:border-neutral-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono font-medium text-[11px] bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          <span className="font-serif italic font-bold">∑</span> Mathematical Expression
                        </span>
                        {isCurrentSentence && isPlaying && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                            <Volume2 className="w-3.5 h-3.5" /> Reading formula aloud
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(latex);
                        }}
                        className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors p-1 px-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1 text-[11px]"
                        title="Copy LaTeX formula"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copy LaTeX</span>
                      </button>
                    </div>

                    <div className="py-2 overflow-x-auto text-center select-text">
                      {sentence ? (
                        <span
                          id={`sentence-${sentence.globalIndex}`}
                          ref={isCurrentSentence ? activeSentenceRef : null}
                          className="inline-block"
                        >
                          <MathView latex={latex} displayMode={true} className="text-lg sm:text-xl md:text-2xl" />
                        </span>
                      ) : (
                        <MathView latex={latex} displayMode={true} className="text-lg sm:text-xl md:text-2xl" />
                      )}
                    </div>

                    {spoken && (
                      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-neutral-500 dark:text-neutral-400 italic text-center font-serif">
                        "{spoken}"
                      </div>
                    )}
                  </div>
                );
              }

              // Table Block (Markdown, EPUB, or PDF tables)
              if (paragraph.blockType === 'table' && paragraph.tableData) {
                return (
                  <ReaderTableBlock
                    key={paragraph.id}
                    paragraph={paragraph}
                    currentSentenceIndex={currentSentenceIndex}
                    isPlaying={isPlaying}
                    activeSentenceRef={activeSentenceRef}
                    onSentenceClick={onSentenceClick}
                    onNavigateToUrl={onNavigateToUrl}
                    defaultTableDisplay={displaySettings.defaultTableDisplay || 'both'}
                  />
                );
              }

              // Figure Block (PDF circuit diagrams, schematics, illustrations, screenshots)
              if (paragraph.blockType === 'figure') {
                return (
                  <ReaderFigureBlock
                    key={paragraph.id}
                    paragraph={paragraph}
                    currentSentenceIndex={currentSentenceIndex}
                    activeSentenceRef={activeSentenceRef}
                    onSentenceClick={onSentenceClick}
                  />
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

      {/* Floating Quick Jump TOC Button & Drawer */}
      {document.tableOfContents && document.tableOfContents.length > 0 && (
        <>
          <div className="fixed bottom-24 left-6 z-20">
            <button
              type="button"
              onClick={() => setIsTocDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border border-neutral-200/90 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 hover:scale-105 transition-all text-xs font-semibold cursor-pointer"
              title="Quick Jump Table of Contents"
            >
              <ListTree className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Contents</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                {document.tableOfContents.length}
              </span>
            </button>
          </div>

          {isTocDrawerOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center sm:justify-start sm:p-6 bg-black/50 backdrop-blur-xs animate-fadeIn"
              onClick={() => setIsTocDrawerOpen(false)}
            >
              <div
                className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[85vh] m-4 sm:m-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <ListTree className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                      Table of Contents
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                      {document.tableOfContents.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTocDrawerOpen(false)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 border-b border-neutral-100 dark:border-neutral-800">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search sections / chapters..."
                      value={tocSearch}
                      onChange={(e) => setTocSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 overflow-y-auto space-y-1 divide-y divide-neutral-100 dark:divide-neutral-850 flex-1">
                  {filteredToc.map((item, idx) => {
                    const isActive = activeTocIndex === item.originalIndex;
                    const levelIndent =
                      item.level && item.level > 1
                        ? item.level === 2
                          ? 'pl-4'
                          : 'pl-7'
                        : 'pl-1.5';

                    return (
                      <button
                        key={item.id || idx}
                        type="button"
                        onClick={() => handleTocClick(item)}
                        className={`w-full flex items-center justify-between text-left py-2 px-2.5 rounded-lg text-xs transition-colors cursor-pointer ${levelIndent} ${
                          isActive
                            ? 'bg-amber-100/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isActive ? 'bg-amber-500 ring-2 ring-amber-300' : 'bg-neutral-300 dark:bg-neutral-600'
                            }`}
                          />
                          <span className="truncate">{item.title}</span>
                        </div>
                        {item.pageNumber && (
                          <span className="shrink-0 ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                            p. {item.pageNumber}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};
