import { ParagraphItem, SentenceItem, WordToken, ArticleDocument, TocItem } from '../types';
import { latexToSpokenText, containsMath } from './mathUtils';
import {
  detectTruthTableFromLines,
  detectGeneralTableFromLines,
  detectMashedTruthTableInParagraphText,
  formatTruthTableRowSpeech,
} from './tableDetector';

/**
 * Fully decode HTML entities (decimal, hex, named, double-encoded) and normalize
 * quotation marks and apostrophes (curly or straight) so they never display as raw entity codes
 * like &#8220;, 8220;, &#8221, or &#8217;.
 */
export function decodeHtmlAndNormalizeQuotes(text: string): string {
  if (!text) return '';
  let s = text;

  // 1. Resolve double-encoded entities: e.g. &amp;#8220; -> &#8220;
  s = s.replace(/&amp;(#[0-9a-zA-Z]+;?|[a-zA-Z]+;?)/gi, '&$1');

  // 2. Specific quotation and apostrophe entities (curly & straight, decimal, hex, named)
  // Handles with/without trailing semicolon and optional space after &#
  s = s
    // Left double quote: &#8220; &#147; &#x201c; &ldquo;
    .replace(/&(?:#\s*8220|#\s*147|#x201c|ldquo);?/gi, '“')
    // Right double quote: &#8221; &#148; &#x201d; &rdquo;
    .replace(/&(?:#\s*8221|#\s*148|#x201d|rdquo);?/gi, '”')
    // Left single quote: &#8216; &#145; &#x2018; &lsquo;
    .replace(/&(?:#\s*8216|#\s*145|#x2018|lsquo);?/gi, '‘')
    // Right single quote / apostrophe: &#8217; &#146; &#x2019; &rsquo;
    .replace(/&(?:#\s*8217|#\s*146|#x2019|rsquo);?/gi, '’')
    // Straight double quote: &#34; &#x22; &quot;
    .replace(/&(?:#\s*34|#x22|quot);?/gi, '"')
    // Straight single quote / apostrophe: &#39; &#x27; &apos;
    .replace(/&(?:#\s*39|#x27|apos);?/gi, "'")
    // French/Guillemets: &laquo; &raquo;
    .replace(/&(?:#\s*171|#xab|laquo);?/gi, '«')
    .replace(/&(?:#\s*187|#xbb|raquo);?/gi, '»')
    // Low quotation marks: &#8218; &#8222;
    .replace(/&(?:#\s*8218|#x201a|sbquo);?/gi, '‚')
    .replace(/&(?:#\s*8222|#x201e|bdquo);?/gi, '„');

  // 3. Catch orphaned numeric entity codes where &# was stripped/corrupted
  // e.g. "8220;Hello" or "8221;" or "&#8221" or "8217;"
  s = s
    .replace(/(?:^|\b|\s)8220;/g, ' “')
    .replace(/8220;/g, '“')
    .replace(/8221;?/g, '”')
    .replace(/8216;/g, '‘')
    .replace(/8217;?/g, '’');

  // 4. Other typographical symbols
  s = s
    // Em dash: &#8212; &mdash;
    .replace(/&(?:#\s*8212|#x2014|mdash);?/gi, '—')
    // En dash: &#8211; &ndash;
    .replace(/&(?:#\s*8211|#x2013|ndash);?/gi, '–')
    // Ellipsis: &#8230; &hellip;
    .replace(/&(?:#\s*8230|#x2026|hellip);?/gi, '…')
    // Non-breaking space: &#160; &nbsp;
    .replace(/&(?:#\s*160|#xa0|nbsp);?/gi, ' ')
    // Angle brackets & ampersand
    .replace(/&(?:#\s*60|#x3c|lt);?/gi, '<')
    .replace(/&(?:#\s*62|#x3e|gt);?/gi, '>')
    .replace(/&(?:#\s*38|#x26|amp);?/gi, '&');

  // 5. General decimal entities (e.g. &#169; for ©, &#8226; for •)
  s = s.replace(/&#\s*(\d+);?/g, (_, codeStr) => {
    try {
      const code = parseInt(codeStr, 10);
      return code >= 32 && code !== 127 ? String.fromCodePoint(code) : '';
    } catch {
      return '';
    }
  });

  // 6. General hex entities (e.g. &#x20ac; for €)
  s = s.replace(/&#x\s*([0-9a-fA-F]+);?/g, (_, hexStr) => {
    try {
      const code = parseInt(hexStr, 16);
      return code >= 32 && code !== 127 ? String.fromCodePoint(code) : '';
    } catch {
      return '';
    }
  });

  // 7. PDF and TeX math font encoding artifacts (equals, parentheses, plus, negation)
  s = s
    .replace(/¼/g, '=')
    .replace(/ð/g, '(')
    .replace(/Þ/g, ')')
    .replace(/þ/g, '+');

  return s;
}

/**
 * Enforces paragraph characters embedded in file data (Pilcrow ¶, U+00B6,
 * Unicode Paragraph Separator \u2029, Form Feed \f, and HTML entities like &para;)
 * to determine explicit paragraph breaks rather than stripping them away.
 */
export function enforceParagraphCharacters(text: string): string {
  if (!text) return '';
  return text
    // Replace HTML pilcrow entities with paragraph character
    .replace(/&(?:para|#182|#x00b6);/gi, '¶')
    // Enforce embedded paragraph characters into explicit double-newline paragraph breaks
    .replace(/[\u2029\f¶\u00B6]+/g, '\n\n')
    // Normalize line separator \u2028 and zero-width characters
    .replace(/[\u2028]/g, '\n')
    .replace(/[\uFEFF]/g, '');
}

/**
 * Cleans any leftover stray paragraph symbols from word tokens or rendered text.
 */
export function cleanParagraphCharacters(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2029\f¶\u00B6\uFEFF]/g, '')
    .replace(/&(?:para|#182|#x00b6);/gi, '');
}

export const removeParagraphCharacters = cleanParagraphCharacters;

/**
 * Tokenize a sentence into words with start and end character offsets.
 * Preserves the full word with its punctuation for accurate visual display and reading,
 * while keeping cleanWord for audio timing and extracting inline formatting
 * (bold, italic, code, underline, strikethrough, links, line breaks).
 */
export function tokenizeWords(
  sentenceText: string,
  defaultFormatting?: Partial<WordToken>
): WordToken[] {
  const words: WordToken[] = [];
  // Match word tokens: markdown links [text](url), display math $$...$$, inline math $...$, \(...\), or non-whitespace sequences
  const regex = /\[[^\]]+\]\([^\s)]+\)|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))[^$\n]+?(?<!\s)\$|\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sentenceText)) !== null) {
    const rawWord = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + rawWord.length;

    // Check if whitespace immediately following this word contains a newline
    const followingSlice = sentenceText.slice(endIndex);
    const nextNewline = followingSlice.search(/\n/);
    const nextNonWs = followingSlice.search(/\S/);
    const hasLineBreak =
      defaultFormatting?.hasLineBreakAfter ??
      (nextNewline !== -1 && (nextNonWs === -1 || nextNewline < nextNonWs));

    // Check if token is a LaTeX math expression
    const isBlockMath = rawWord.startsWith('$$') || rawWord.startsWith('\\[');
    const isInlineMath =
      !isBlockMath &&
      ((rawWord.startsWith('$') && rawWord.endsWith('$') && rawWord.length > 2) ||
        (rawWord.startsWith('\\(') && rawWord.endsWith('\\)')));
    const punctMathMatch =
      !isBlockMath && !isInlineMath
        ? rawWord.match(/^([(\["']?)(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))[^$\n]+?(?<!\s)\$)([)\]"',.;:!?]?)$/)
        : null;

    if (isBlockMath || isInlineMath || punctMathMatch) {
      const mathBody = punctMathMatch ? punctMathMatch[2] : rawWord;
      const cleanLatex = mathBody
        .replace(/^\$\$|\$\$$|^\\\[|\\\]$|^\$|\$$|^\\\(|\\\)$/g, '')
        .trim();
      const spoken = latexToSpokenText(cleanLatex);
      words.push({
        word: rawWord,
        cleanWord: spoken || cleanLatex,
        startIndex,
        endIndex,
        isMath: true,
        mathLatex: cleanLatex,
        mathDisplayMode: isBlockMath,
        spokenMath: spoken,
        hasLineBreakAfter: hasLineBreak,
      });
      continue;
    }

    let cleanWord: string;
    let isBold = defaultFormatting?.isBold ?? false;
    let isItalic = defaultFormatting?.isItalic ?? false;
    let isCode = defaultFormatting?.isCode ?? false;
    let isStrikethrough = defaultFormatting?.isStrikethrough ?? false;
    let linkUrl = defaultFormatting?.linkUrl;
    let displayWord = rawWord.replace(/[\u2029\f¶\u00B6\uFEFF]/g, '');
    if (!displayWord) continue;

    // Check markdown link: [text](url)
    const mdLinkMatch = rawWord.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
    if (mdLinkMatch) {
      displayWord = mdLinkMatch[1];
      linkUrl = mdLinkMatch[2];
      cleanWord = displayWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    } else {
      // Check inline code: `code`
      if (/^`[^`]+`$/.test(displayWord)) {
        isCode = true;
        displayWord = displayWord.slice(1, -1);
      }
      // Check bold-italic: ***word*** or ___word___
      if (/^(\*\*\*|___)[^*_]+(\*\*\*|___)$/.test(displayWord)) {
        isBold = true;
        isItalic = true;
        displayWord = displayWord.slice(3, -3);
      } else if (/^(\*\*|__)[^*_]+(\*\*|__)$/.test(displayWord)) {
        // Bold: **word** or __word__
        isBold = true;
        displayWord = displayWord.slice(2, -2);
      } else if (/^(\*|_)[^*_]+(\*|_)$/.test(displayWord)) {
        // Italic: *word* or _word_
        isItalic = true;
        displayWord = displayWord.slice(1, -1);
      } else if (/^~~[^~]+~~$/.test(displayWord)) {
        // Strikethrough: ~~word~~
        isStrikethrough = true;
        displayWord = displayWord.slice(2, -2);
      }

      cleanWord = displayWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    words.push({
      word: displayWord,
      cleanWord: cleanWord || displayWord,
      startIndex,
      endIndex,
      isBold,
      isItalic,
      isCode,
      isUnderline: defaultFormatting?.isUnderline ?? false,
      isStrikethrough,
      linkUrl,
      hasLineBreakAfter: hasLineBreak,
    });
  }

  return words;
}

/**
 * Protect periods that should never cause sentence splits (honorifics, abbreviations, decimals, domains).
 */
export function protectNonSentencePeriods(text: string): string {
  if (!text) return '';
  return (
    text
      // Common honorifics and titles: Dr., Mr., Mrs., Ms., Prof., etc.
      .replace(
        /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|Rev|Hon|Gov|Sen|Rep|Pres|Amb|Gen|Col|Capt|Lt|Sgt|Maj)\./gi,
        '$1§DOT§'
      )
      // Common Latin and everyday abbreviations: etc., e.g., i.e., vs., al., approx., dept., etc.
      .replace(
        /\b(etc|e\.g|i\.e|vs|v|al|approx|dept|govt|corp|inc|ltd|co|fig|figs|no|nos|vol|vols|pp|p|ed|eds)\./gi,
        '$1§DOT§'
      )
      // Common address & geography: St., Ave., Rd., Blvd., U.S., U.K., E.U., D.C.
      .replace(/\b(St|Ave|Rd|Blvd|Ct|Dr|Ln|Pl|Hwy|U\.S|U\.K|E\.U|D\.C)\./gi, '$1§DOT§')
      // Single letter initials: e.g. "J. K. Rowling" -> "J§DOT§ K§DOT§ Rowling"
      .replace(/\b([A-Z])\.\s*(?=[A-Z])/g, '$1§DOT§ ')
      // Decimals and currency numbers: 3.14, $19.99, 0.05
      .replace(/(\d+)\.(\d+)/g, '$1§DOT§$2')
      // Domain names & extensions: google.com, example.org
      .replace(/\b([a-z0-9_-]+)\.(com|org|net|edu|gov|io|ai|co|app|info|dev|tech)\b/gi, '$1§DOT§$2')
      // Ellipses: ... or …
      .replace(/\.{2,}/g, '§ELLIP§')
      .replace(/…/g, '§ELLIP§')
      // Protect periods inside math expressions
      .replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$(?!\s|\d+(?:\.\d+)?(?:\s|$))[^$\n]+?(?<!\s)\$)/g, (m) =>
        m.replace(/\./g, '§DOT§')
      )
  );
}

/**
 * Restore protected periods and ellipses.
 */
export function unprotectPeriods(text: string): string {
  if (!text) return '';
  return text.replace(/§DOT§/g, '.').replace(/§ELLIP§/g, '...');
}

/**
 * Reconciles prematurely broken paragraphs and sentences across margin overflows,
 * line wraps, and page boundaries.
 * If a paragraph does not end with terminal sentence punctuation (. ? !), and the subsequent
 * paragraph begins with continuation text (e.g. lowercase letter or non-heading fragment),
 * merges the broken fragment into the current paragraph so the sentence is complete and not
 * broken into an isolated paragraph.
 */
export function reconcileBrokenParagraphs(paragraphs: ParagraphItem[]): ParagraphItem[] {
  if (paragraphs.length <= 1) return paragraphs;

  const result: ParagraphItem[] = [];

  const isTerminalPunctuation = (text: string): boolean => {
    const trimmed = text.trim();
    return /[.?!]["'”’)]?\s*$/.test(trimmed) || /[:;]\s*$/.test(trimmed);
  };

  const isHeadingOrStructural = (p: ParagraphItem): boolean => {
    return (
      p.blockType === 'heading' ||
      p.blockType === 'chapter-header' ||
      p.blockType === 'code' ||
      p.blockType === 'table' ||
      p.blockType === 'figure' ||
      p.blockType === 'math' ||
      p.blockType === 'divider' ||
      p.blockType === 'list-item' ||
      Boolean(p.isListItem)
    );
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const current = paragraphs[i];

    // If current is a page break or structural block, keep as is
    if (current.blockType === 'page-break') {
      result.push(current);
      continue;
    }

    // Check if current paragraph represents a mashed Truth Table
    if (current.blockType === 'paragraph' && !current.tableData) {
      const mashedTable = detectMashedTruthTableInParagraphText(current.rawText);
      if (mashedTable && mashedTable.rows.length >= 2) {
        if (mashedTable.textBefore && mashedTable.textBefore.trim().length > 0) {
          result.push({
            ...current,
            id: `${current.id}-pre`,
            rawText: mashedTable.textBefore.trim(),
            sentences: [
              {
                id: `${current.id}-pre-s-0`,
                globalIndex: 0,
                paragraphIndex: current.paragraphIndex,
                sentenceIndexInParagraph: 0,
                text: mashedTable.textBefore.trim(),
                words: tokenizeWords(mashedTable.textBefore.trim()),
              },
            ],
          });
        }

        const tableSpeech = mashedTable.rows
          .map((r, rIdx) => formatTruthTableRowSpeech(r, mashedTable.headers, rIdx))
          .join('. ');

        const rowSentences: SentenceItem[] = mashedTable.rows.map((row, rIdx) => {
          const rowSpeech = formatTruthTableRowSpeech(row, mashedTable.headers, rIdx);
          return {
            id: `${current.id}-tbl-s-${rIdx}`,
            globalIndex: 0,
            paragraphIndex: current.paragraphIndex,
            sentenceIndexInParagraph: rIdx,
            text: rowSpeech,
            words: tokenizeWords(rowSpeech),
          };
        });

        result.push({
          ...current,
          id: `${current.id}-tbl`,
          blockType: 'table',
          tableData: {
            headers: mashedTable.headers,
            rows: mashedTable.rows,
            alignments: mashedTable.alignments,
            isTruthTable: true,
          },
          rawText: tableSpeech,
          sentences: rowSentences,
        });

        continue;
      }
    }

    if (result.length > 0) {
      // Find the last non-page-break paragraph in result
      let prevTextIdx = result.length - 1;
      while (prevTextIdx >= 0 && result[prevTextIdx].blockType === 'page-break') {
        prevTextIdx--;
      }

      if (prevTextIdx >= 0) {
        const prev = result[prevTextIdx];
        const prevRaw = prev.rawText.trim();
        const currentRaw = current.rawText.trim();

        // If either previous or current paragraph was created with an explicit paragraph character
        // or intentional markdown break, enforce the separation and do NOT merge
        if (prev.hasExplicitParagraphBreak || current.hasExplicitParagraphBreak) {
          result.push(current);
          continue;
        }

        // Check if previous paragraph did NOT hit a period yet
        const prevHitPeriod = isTerminalPunctuation(prevRaw);
        const currentIsStructural = isHeadingOrStructural(current);

        // Conditions to stitch overflowing/broken sentence into previous paragraph:
        // 1. Neither paragraph has an explicit paragraph break (enforced above)
        // 2. Previous paragraph did not hit terminal sentence punctuation
        // 3. Current paragraph is regular prose (not heading, list-item, table, code, divider)
        // 4. Current starts with lowercase or continuation word, previous ended with hyphen/connector,
        //    or previous was an unfinished overflowing sentence
        const currentStartsWithLower = /^[a-z0-9]/.test(currentRaw);
        const prevEndsWithHyphen = /[-–—]\s*$/.test(prevRaw);
        const prevEndsWithConnecting = /(?:,|\b(and|or|but|that|which|who|whom|whose|with|without|in|on|at|to|for|of|from|by|as|into|through|during|before|after|above|below|between|under|again|well|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must|not|it's|what's|that's|there's|they're|we're|you're))\s*$/i.test(prevRaw);
        const prevIsUnfinishedProse =
          prevRaw.split(/\s+/).length >= 3 &&
          !prevHitPeriod &&
          !isHeadingOrStructural(prev);

        const shouldMerge =
          !prevHitPeriod &&
          !currentIsStructural &&
          !isHeadingOrStructural(prev) &&
          (currentStartsWithLower || prevEndsWithHyphen || prevEndsWithConnecting || prevIsUnfinishedProse);

        if (shouldMerge) {
          // Merge current into prev
          let joinedText = prev.rawText;
          if (prevEndsWithHyphen) {
            // Check if hyphen was breaking a single word
            const stem = prev.rawText.replace(/[-–—]\s*$/, '');
            const nextMatch = current.rawText.match(/^([a-zA-Z]+)([\s\S]*)$/);
            if (nextMatch) {
              joinedText = `${stem}${nextMatch[1]}${nextMatch[2]}`;
            } else {
              joinedText = `${stem}${current.rawText}`;
            }
          } else {
            joinedText = `${prev.rawText.trim()} ${current.rawText.trim()}`;
          }

          prev.rawText = joinedText;
          // Clean decoded & protected sentence segmentation
          const cleanDecoded = decodeHtmlAndNormalizeQuotes(joinedText);
          const protectedText = protectNonSentencePeriods(cleanDecoded);
          const rawSentences = protectedText
            .split(/(?<=[.?!]["'”’)]?)\s+(?=[A-Z0-9"“'‘(\[])/)
            .map((s) => unprotectPeriods(s).trim())
            .filter((s) => s.length > 0);

          const finalSentences = rawSentences.length > 0 ? rawSentences : [unprotectPeriods(protectedText).trim()];

          prev.sentences = finalSentences.map((sText, sIdx) => ({
            id: `${prev.id}-s-${sIdx}`,
            globalIndex: 0,
            paragraphIndex: prev.paragraphIndex,
            sentenceIndexInParagraph: sIdx,
            text: sText,
            words: tokenizeWords(sText, {
              isBold: prev.isBold,
              isItalic: prev.isItalic,
            }),
          }));

          continue; // Successfully merged!
        }
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Splits table cells by pipe, ignoring pipes inside inline math or backticks.
 */
export function splitTableCells(rowStr: string): string[] {
  let trimmed = rowStr.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  let inMath = false;
  let inCode = false;

  for (let c = 0; c < trimmed.length; c++) {
    const char = trimmed[c];
    if (char === '`') inCode = !inCode;
    else if (char === '$' && !inCode) inMath = !inMath;
    else if (char === '|' && !inMath && !inCode) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parses HTML <table> markup into structured headers, rows, and alignments.
 */
export function parseHtmlTable(html: string): {
  headers: string[];
  rows: string[][];
  alignments?: ('left' | 'center' | 'right')[];
  tableSpeech: string;
} | null {
  const rowMatches = html.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rowMatches || rowMatches.length === 0) return null;

  const allRows: string[][] = [];
  const alignments: ('left' | 'center' | 'right')[] = [];

  for (const rowHtml of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowHtml.match(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi);
    if (!cellMatches) continue;

    for (let c = 0; c < cellMatches.length; c++) {
      const cellHtml = cellMatches[c];
      const matchTag = cellHtml.match(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/i);
      if (!matchTag) continue;
      const attrs = matchTag[2];
      const inner = matchTag[3]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (alignments.length <= c) {
        if (/align=["']center["']|text-center/i.test(attrs)) alignments.push('center');
        else if (/align=["']right["']|text-right/i.test(attrs)) alignments.push('right');
        else alignments.push('left');
      }

      cells.push(decodeHtmlAndNormalizeQuotes(inner));
    }
    if (cells.length > 0) allRows.push(cells);
  }

  if (allRows.length === 0) return null;

  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const speechParts: string[] = [];
  dataRows.forEach((row, rIdx) => {
    const rowDesc = row
      .map((c, cIdx) => {
        const h = headers[cIdx] ? `${headers[cIdx]}: ` : '';
        return `${h}${latexToSpokenText(c)}`;
      })
      .filter((s) => s.length > 0)
      .join(', ');
    if (rowDesc) {
      speechParts.push(`Row ${rIdx + 1}. ${rowDesc}`);
    }
  });

  return {
    headers,
    rows: dataRows,
    alignments,
    tableSpeech: speechParts.length > 0 ? speechParts.join('. ') : headers.join(', '),
  };
}

/**
 * Split text into paragraphs and natural sentences with robust protection
 * against false period splits (abbreviations, initials, decimals, domains, ellipses),
 * and full first-class support for Markdown bullet points, task lists, nested lists, and tables.
 */
export function parseTextIntoDocument(
  rawText: string,
  metadata: {
    title?: string;
    author?: string;
    domain?: string;
    sourceUrl?: string;
    fileType?: ArticleDocument['fileType'];
    id?: string;
    docNavigation?: ArticleDocument['docNavigation'];
    metadataDetails?: ArticleDocument['metadataDetails'];
  } = {}
): ArticleDocument {
  // 1. Decode all HTML entities and normalize quotes/apostrophes
  const decodedText = decodeHtmlAndNormalizeQuotes(rawText);

  // 2. Enforce paragraph characters embedded in file data (¶, \u2029, \f, etc.) as explicit paragraph breaks
  const enforcedText = enforceParagraphCharacters(decodedText);

  // Normalize line endings
  const normalized = enforcedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into paragraph blocks, handling code fences, blockquotes, lists, tables, and headers
  const rawParagraphs: {
    text: string;
    blockType: ParagraphItem['blockType'];
    headingLevel?: number;
    listMarker?: string;
    indentPx?: number;
    tableData?: ParagraphItem['tableData'];
    mathData?: {
      rawLatex: string;
      displayMode: boolean;
      spokenText?: string;
    };
    preserveLineBreaks?: boolean;
    hasExplicitParagraphBreak?: boolean;
  }[] = [];

  const lines = normalized.split('\n');
  let currentProseLines: string[] = [];

  const flushProse = () => {
    if (currentProseLines.length === 0) return;
    const blockText = currentProseLines.join('\n').trim();
    const hasMultipleManualLines = currentProseLines.length > 1;
    currentProseLines = [];
    if (!blockText) return;

    rawParagraphs.push({
      text: blockText,
      blockType: 'paragraph',
      preserveLineBreaks: hasMultipleManualLines,
      hasExplicitParagraphBreak: true,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Fenced Code Block (``` or ~~~)
    if (/^```|^~~~/.test(trimmed)) {
      flushProse();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```|^~~~/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // skip closing fence
      rawParagraphs.push({
        text: codeLines.join('\n'),
        blockType: 'code',
      });
      continue;
    }

    // 2. Empty line separates blocks
    if (trimmed.length === 0) {
      flushProse();
      i++;
      continue;
    }

    // 3. Horizontal Divider (---, ***, ___)
    if (/^(?:[-*_]){3,}\s*$/.test(trimmed)) {
      flushProse();
      rawParagraphs.push({ text: '✦ ✦ ✦', blockType: 'divider' });
      i++;
      continue;
    }

    // 4. Mathematical Display Block ($$...$$ or \[...\] or \begin{equation}...\end{equation})
    if (/^(\$\$|\\\[|\\begin\{(?:equation|align|gather|matrix|pmatrix|bmatrix)\})/.test(trimmed)) {
      flushProse();
      const mathLines: string[] = [];
      const isSingleLine =
        (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 2) ||
        (trimmed.startsWith('\\[') && trimmed.endsWith('\\]') && trimmed.length > 2) ||
        (trimmed.startsWith('\\begin{') && trimmed.includes('\\end{'));

      if (isSingleLine) {
        mathLines.push(trimmed);
        i++;
      } else {
        mathLines.push(line);
        i++;
        while (i < lines.length) {
          const nextL = lines[i];
          mathLines.push(nextL);
          i++;
          if (/\$\$|\\\]|\\end\{(?:equation|align|gather|matrix|pmatrix|bmatrix)\}/.test(nextL.trim())) {
            break;
          }
        }
      }

      const fullMathBlock = mathLines.join('\n').trim();
      const cleanLatex = fullMathBlock
        .replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '')
        .trim();
      const spokenMath = latexToSpokenText(cleanLatex);

      rawParagraphs.push({
        text: spokenMath || 'Mathematical expression',
        blockType: 'math',
        mathData: {
          rawLatex: cleanLatex,
          displayMode: true,
          spokenText: spokenMath,
        },
      });
      continue;
    }

    // 5. HTML Table: <table ...>...</table>
    if (/<table\b/i.test(trimmed)) {
      flushProse();
      const tableLines: string[] = [];
      while (i < lines.length) {
        tableLines.push(lines[i]);
        if (/<\/table>/i.test(lines[i])) {
          i++;
          break;
        }
        i++;
      }
      const htmlTableStr = tableLines.join('\n');
      const parsedTable = parseHtmlTable(htmlTableStr);
      if (parsedTable) {
        rawParagraphs.push({
          text: parsedTable.tableSpeech,
          blockType: 'table',
          tableData: {
            headers: parsedTable.headers,
            rows: parsedTable.rows,
            alignments: parsedTable.alignments,
          },
        });
        continue;
      }
    }

    // 6. Markdown Table
    // A table starts with a row containing pipes, followed by a delimiter row: | --- | :---: | ---: |
    const isPotentialTableHeader = trimmed.includes('|');
    const nextLineTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
    const isDelimiterRow =
      nextLineTrimmed.includes('|') &&
      /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(nextLineTrimmed);

    if (isPotentialTableHeader && isDelimiterRow) {
      flushProse();
      const headerLine = trimmed;
      const delimiterLine = nextLineTrimmed;
      i += 2; // skip header and delimiter

      // Parse headers with robust cell splitting
      const headers = splitTableCells(headerLine);

      // Parse alignments from delimiter
      const rawDelimiterCells = splitTableCells(delimiterLine);
      const alignments: ('left' | 'center' | 'right')[] = rawDelimiterCells.map((d) => {
        const dTrim = d.trim();
        if (dTrim.startsWith(':') && dTrim.endsWith(':')) return 'center';
        if (dTrim.endsWith(':')) return 'right';
        return 'left';
      });

      // Parse data rows
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim().length > 0) {
        const rowLine = lines[i].trim();
        const cells = splitTableCells(rowLine);
        // Pad cells if fewer than headers
        while (cells.length < headers.length) {
          cells.push('');
        }
        rows.push(cells);
        i++;
      }

      // Generate readable speech text for table
      const speechParts: string[] = [];
      rows.forEach((row, rIdx) => {
        const rowDesc = row
          .map((c, cIdx) => {
            const h = headers[cIdx] ? `${headers[cIdx]}: ` : '';
            return `${h}${latexToSpokenText(c)}`;
          })
          .filter((s) => s.length > 0)
          .join(', ');
        if (rowDesc) {
          speechParts.push(`Row ${rIdx + 1}. ${rowDesc}`);
        }
      });

      const tableSpeech =
        speechParts.length > 0
          ? speechParts.join('. ')
          : headers.join(', ');

      rawParagraphs.push({
        text: tableSpeech,
        blockType: 'table',
        tableData: {
          headers,
          rows,
          alignments,
        },
      });
      continue;
    }

    // 6b. Delimiterless Truth Table from lines (e.g. plain text or PDF lines)
    const truthTableCheck = detectTruthTableFromLines(lines, i);
    if (truthTableCheck && truthTableCheck.table.rows.length >= 2) {
      flushProse();
      const { table, consumedCount } = truthTableCheck;
      if (table.title) {
        rawParagraphs.push({
          text: table.title,
          blockType: 'heading',
          headingLevel: 3,
        });
      }

      const tableSpeech = table.rows
        .map((r, rIdx) => formatTruthTableRowSpeech(r, table.headers, rIdx))
        .join('. ');

      rawParagraphs.push({
        text: tableSpeech,
        blockType: 'table',
        tableData: {
          headers: table.headers,
          rows: table.rows,
          alignments: table.alignments,
          isTruthTable: true,
          title: table.title,
        },
      });
      i += consumedCount;
      continue;
    }

    // 6c. Delimiterless general table (pipe or multi-space columns)
    const genTableCheck = detectGeneralTableFromLines(lines, i);
    if (genTableCheck && genTableCheck.table.rows.length >= 2) {
      flushProse();
      const { table, consumedCount } = genTableCheck;
      const tableSpeech = table.rows
        .map((r, rIdx) => formatTruthTableRowSpeech(r, table.headers, rIdx))
        .join('. ');

      rawParagraphs.push({
        text: tableSpeech,
        blockType: 'table',
        tableData: {
          headers: table.headers,
          rows: table.rows,
          alignments: table.alignments,
          isTruthTable: table.isTruthTable,
        },
      });
      i += consumedCount;
      continue;
    }

    // 7. Headings: # Heading 1 to ###### Heading 6
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushProse();
      rawParagraphs.push({
        text: headingMatch[2].trim(),
        blockType: 'heading',
        headingLevel: headingMatch[1].length,
      });
      i++;
      continue;
    }

    // 6. Blockquote (> ...)
    if (/^\s*>\s*/.test(line)) {
      flushProse();
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s*/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      rawParagraphs.push({
        text: quoteLines.join(' ').trim(),
        blockType: 'blockquote',
      });
      continue;
    }

    // 7. Markdown Bullet Points and Numbered Lists
    // Matches:
    // - bullet item
    // * bullet item
    // + bullet item
    // • bullet item
    // 1. numbered item
    // - [ ] task item unchecked
    // - [x] task item checked
    const listMatch = line.match(/^(\s*)(?:([-*+•–—]|\d+[\.\)]|[a-zA-Z][\.\)]))\s+(?:\[([ xX])\]\s+)?(.*)$/);
    if (listMatch) {
      flushProse();
      const leadingSpaces = listMatch[1].replace(/\t/g, '    ').length;
      const rawMarker = listMatch[2];
      const taskChar = listMatch[3];
      const itemFirstLineText = listMatch[4];

      let listMarker = rawMarker;
      if (taskChar !== undefined) {
        listMarker = taskChar.toLowerCase() === 'x' ? '[x]' : '[ ]';
      }

      const indentPx = Math.round(leadingSpaces * 10);
      const itemLines: string[] = [itemFirstLineText];
      i++;

      // Check if subsequent lines are continuation of this bullet point
      while (i < lines.length) {
        const nextL = lines[i];
        const nextTrim = nextL.trim();
        if (nextTrim.length === 0) break; // blank line breaks list item
        if (/^```|^~~~/.test(nextTrim)) break; // code block
        if (/^(?:[-*_]){3,}\s*$/.test(nextTrim)) break; // divider
        if (/^\s*(#{1,6})\s+/.test(nextL)) break; // heading
        if (nextTrim.includes('|') && i + 1 < lines.length && lines[i + 1].trim().includes('|') && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(lines[i + 1].trim())) break; // table
        if (/^(\s*)(?:([-*+•–—]|\d+[\.\)]|[a-zA-Z][\.\)]))\s+/.test(nextL)) break; // new bullet item!

        // If indented continuation line or flowing sentence:
        itemLines.push(nextTrim);
        i++;
      }

      rawParagraphs.push({
        text: itemLines.join(' ').trim(),
        blockType: 'list-item',
        listMarker,
        indentPx: indentPx > 0 ? indentPx : undefined,
      });
      continue;
    }

    // 8. Regular Prose Line
    currentProseLines.push(line);
    i++;
  }

  flushProse();

  const rawParagraphItems: ParagraphItem[] = [];

  rawParagraphs.forEach((rawP, pIndex) => {
    let pText = rawP.text;
    const isHeading = rawP.blockType === 'heading' || rawP.blockType === 'chapter-header';
    const headingLevel = rawP.headingLevel || 2;

    // Discard any internal hyperlinks matching sourceUrl#... or #...
    if (metadata.sourceUrl) {
      const docBase = metadata.sourceUrl.split('#')[0].replace(/\/$/, '');
      pText = pText.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label, url) => {
        const linkBase = url.split('#')[0].replace(/\/$/, '');
        const isInternal = url.startsWith('#') || (url.includes('#') && docBase === linkBase);
        if (isInternal) {
          return label;
        }
        return full;
      });
    } else {
      pText = pText.replace(/\[([^\]]+)\]\(#[^)\s]+\)/g, (_, label) => label);
    }

    // Convert mailto: links and references into plain text e-mail addresses
    pText = pText
      .replace(/\[([^\]]+)\]\(mailto:[^)\s]+\)/gi, '$1')
      .replace(/\bmailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, '$1')
      .replace(/\bmailto:\s*/gi, '');

    // For code blocks, math blocks, headings, or dividers, keep sentences as single full block
    let finalSentences: string[];
    if (
      rawP.blockType === 'code' ||
      rawP.blockType === 'divider' ||
      rawP.blockType === 'math' ||
      rawP.blockType === 'heading' ||
      rawP.blockType === 'chapter-header'
    ) {
      finalSentences = [pText];
    } else if (rawP.blockType === 'table') {
      if (rawP.tableData && rawP.tableData.rows.length > 0) {
        finalSentences = rawP.tableData.rows.map((row, rIdx) => {
          const rowDesc = row
            .map((c, cIdx) => {
              const h = rawP.tableData?.headers[cIdx] ? `${rawP.tableData.headers[cIdx]}: ` : '';
              return `${h}${latexToSpokenText(c)}`;
            })
            .filter((s) => s.length > 0)
            .join(', ');
          return `Row ${rIdx + 1}. ${rowDesc}`;
        });
      } else {
        finalSentences = [pText];
      }
    } else {
      // Protect abbreviations and decimals before sentence segmentation
      const protectedText = protectNonSentencePeriods(pText);

      // Split on true sentence boundaries
      const rawSentences = protectedText
        .split(/(?<=[.?!]["'”’)]?)\s+(?=[A-Z0-9"“'‘(\[])/)
        .map((s) => unprotectPeriods(s).trim())
        .filter((s) => s.length > 0);

      const consolidatedSentences: string[] = [];
      for (let sI = 0; sI < rawSentences.length; sI++) {
        const current = rawSentences[sI];
        if (consolidatedSentences.length > 0) {
          const prev = consolidatedSentences[consolidatedSentences.length - 1];
          if (current.length <= 2 && !/[.?!]$/.test(prev)) {
            consolidatedSentences[consolidatedSentences.length - 1] = `${prev} ${current}`;
            continue;
          }
        }
        consolidatedSentences.push(current);
      }

      finalSentences =
        consolidatedSentences.length > 0
          ? consolidatedSentences
          : [unprotectPeriods(protectedText).trim()];
    }

    const sentenceItems: SentenceItem[] = [];

    finalSentences.forEach((sText, sIndexInP) => {
      let words = tokenizeWords(sText);
      if (rawP.blockType === 'math' && rawP.mathData) {
        words = [
          {
            word: rawP.mathData.rawLatex,
            cleanWord: rawP.mathData.spokenText || latexToSpokenText(rawP.mathData.rawLatex),
            startIndex: 0,
            endIndex: sText.length,
            isMath: true,
            mathLatex: rawP.mathData.rawLatex,
            mathDisplayMode: true,
            spokenMath: rawP.mathData.spokenText,
          },
        ];
      }

      const sentenceItem: SentenceItem = {
        id: `p-${pIndex}-s-${sIndexInP}`,
        globalIndex: 0,
        paragraphIndex: pIndex,
        sentenceIndexInParagraph: sIndexInP,
        text: sText,
        words,
        hasMath: words.some((w) => w.isMath) || rawP.blockType === 'math',
      };

      sentenceItems.push(sentenceItem);
    });

    rawParagraphItems.push({
      id: `p-${pIndex}`,
      paragraphIndex: pIndex,
      sentences: sentenceItems,
      rawText: pText,
      isHeading,
      headingLevel: isHeading ? headingLevel : undefined,
      blockType: rawP.blockType,
      isListItem: rawP.blockType === 'list-item',
      listMarker: rawP.listMarker,
      indentPx: rawP.indentPx,
      tableData: rawP.tableData,
      mathData: rawP.mathData,
      preserveLineBreaks: rawP.preserveLineBreaks,
      hasExplicitParagraphBreak: rawP.hasExplicitParagraphBreak,
    });
  });

  const title = metadata.title || (rawParagraphs[0]?.text.slice(0, 60) ?? 'Untitled Article');

  return createDocumentFromParagraphs(rawParagraphItems, {
    ...metadata,
    title,
    rawContent: rawText,
  });
}

/**
 * Creates an ArticleDocument from pre-parsed paragraphs (e.g. structured PDF pages or EPUB chapters)
 * while ensuring seamless global sentence re-indexing and metadata preservation.
 * Automatically reconciles broken sentences and orphaned margin-overflow fragments.
 */
export function createDocumentFromParagraphs(
  paragraphs: ParagraphItem[],
  metadata: {
    title?: string;
    author?: string;
    domain?: string;
    sourceUrl?: string;
    fileType?: ArticleDocument['fileType'];
    id?: string;
    docNavigation?: ArticleDocument['docNavigation'];
    metadataDetails?: ArticleDocument['metadataDetails'];
    rawContent?: string;
    tableOfContents?: TocItem[];
  } = {}
): ArticleDocument {
  // Reconcile prematurely broken paragraphs and sentences across page boundaries or margin overflows
  const reconciled = reconcileBrokenParagraphs(paragraphs);

  let globalSentenceCounter = 0;
  let totalWordsCounter = 0;

  const normalizedParagraphs = reconciled.map((p, pIndex) => {
    const updatedSentences = p.sentences.map((s, sIndexInP) => {
      const words = s.words && s.words.length > 0 ? s.words : tokenizeWords(s.text);
      totalWordsCounter += words.length;
      const updatedSentence: SentenceItem = {
        ...s,
        id: `s-${globalSentenceCounter}`,
        globalIndex: globalSentenceCounter,
        paragraphIndex: pIndex,
        sentenceIndexInParagraph: sIndexInP,
        words,
      };
      globalSentenceCounter++;
      return updatedSentence;
    });

    return {
      ...p,
      id: `p-${pIndex}`,
      paragraphIndex: pIndex,
      sentences: updatedSentences,
    };
  });

  const now = Date.now();
  const id = metadata.id || `doc-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const title = metadata.title || 'Untitled Document';

  // If table of contents provided, ensure targetSentenceIndex is resolved if targetParagraphIndex exists
  let finalToc: TocItem[] | undefined = metadata.tableOfContents?.map((item) => {
    if (item.targetParagraphIndex !== undefined && normalizedParagraphs[item.targetParagraphIndex]) {
      const targetP = normalizedParagraphs[item.targetParagraphIndex];
      const sIdx = targetP.sentences[0]?.globalIndex;
      return {
        ...item,
        targetSentenceIndex: sIdx !== undefined ? sIdx : item.targetSentenceIndex,
      };
    }
    return item;
  });

  // If no explicit TOC was provided, build TOC from headings or chapter headers if multiple exist
  if (!finalToc || finalToc.length === 0) {
    const headingToc: TocItem[] = [];
    normalizedParagraphs.forEach((p, pIdx) => {
      if ((p.isHeading || p.blockType === 'chapter-header') && p.rawText.trim().length > 0) {
        const cleanHeading = (p.chapterTitle || p.rawText).replace(/^#+\s*/, '').trim();
        if (cleanHeading.length > 0 && cleanHeading.length < 120) {
          headingToc.push({
            id: `toc-${pIdx}`,
            title: cleanHeading,
            targetParagraphIndex: pIdx,
            targetSentenceIndex: p.sentences[0]?.globalIndex,
            level: p.headingLevel || 1,
            pageNumber: p.pageNumber,
          });
        }
      }
    });
    if (headingToc.length >= 2) {
      finalToc = headingToc;
    }
  }

  return {
    id,
    title,
    author: metadata.author,
    domain: metadata.domain,
    sourceUrl: metadata.sourceUrl,
    fileType: metadata.fileType || 'manual',
    rawContent: metadata.rawContent || '',
    paragraphs: normalizedParagraphs,
    totalSentences: globalSentenceCounter,
    totalWords: totalWordsCounter,
    createdAt: now,
    lastOpenedAt: now,
    lastReadSentenceIndex: 0,
    favorite: false,
    docNavigation: metadata.docNavigation,
    metadataDetails: metadata.metadataDetails,
    tableOfContents: finalToc && finalToc.length > 0 ? finalToc : undefined,
  };
}

/**
 * Detects if a word token represents an external hyperlink (Markdown [text](url) or absolute URL).
 * If the link is an internal hyperlink (#hash or pointing to currentDocUrl#hash), it is discarded.
 * Returns the url and clean display label if found.
 */
export function extractLinkFromToken(
  rawToken: string,
  currentDocUrl?: string
): { url: string; displayText: string } | null {
  if (!rawToken) return null;

  // mailto: e-mail addresses should be parsed as plain text and not a hyperlink
  if (/^mailto:/i.test(rawToken)) {
    return null;
  }

  const isExcluded = (url: string): boolean => {
    if (/^mailto:/i.test(url)) return true;
    if (url.startsWith('#')) return true;
    if (currentDocUrl && url.includes('#')) {
      const docBase = currentDocUrl.split('#')[0].replace(/\/$/, '');
      const urlBase = url.split('#')[0].replace(/\/$/, '');
      if (docBase === urlBase) return true;
    }
    return false;
  };

  // Markdown format: [Anchor Text](https://example.com)
  const mdMatch = rawToken.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
  if (mdMatch) {
    const url = mdMatch[2];
    if (isExcluded(url)) {
      return null; // DISCARD INTERNAL OR MAILTO HYPERLINK
    }
    return {
      displayText: mdMatch[1],
      url,
    };
  }

  // Standard absolute URL: http://... or https://...
  const urlMatch = rawToken.match(/(https?:\/\/[^\s<>"'()[\]]+)/i);
  if (urlMatch) {
    let cleanUrl = urlMatch[1];
    const trailingPunct = cleanUrl.match(/[.,;:!?)]+$/);
    if (trailingPunct) {
      cleanUrl = cleanUrl.slice(0, -trailingPunct[0].length);
    }
    if (isExcluded(cleanUrl)) {
      return null; // DISCARD INTERNAL OR MAILTO HYPERLINK
    }
    return {
      displayText: rawToken,
      url: cleanUrl,
    };
  }

  return null;
}
