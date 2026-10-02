import { ParagraphItem, SentenceItem, WordToken, ArticleDocument } from '../types';

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

  return s;
}

/**
 * Remove paragraph symbols (Pilcrow ¶, section sign §, paragraph separator \u2029, \f, etc.)
 * while strictly preserving original punctuation, typography, quotes, and text formatting.
 */
export function removeParagraphCharacters(text: string): string {
  if (!text) return '';
  return text
    // Strip pilcrow, section, page break, and unicode paragraph/line separator characters
    .replace(/[¶§\u00B6\u00A7\u2029\u2028\f\uFEFF]/g, '')
    // Strip HTML pilcrow/section entities if unescaped
    .replace(/&(?:para|sect);/gi, '');
}

/**
 * Tokenize a sentence into words with start and end character offsets.
 * Preserves the full word with its punctuation (e.g., “Hello,” or world!)
 * for accurate visual display and reading, while keeping cleanWord for audio timing.
 */
export function tokenizeWords(sentenceText: string): WordToken[] {
  const words: WordToken[] = [];
  // Match word tokens: markdown links [text](url) or non-whitespace sequences
  const regex = /\[[^\]]+\]\([^\s)]+\)|\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sentenceText)) !== null) {
    const rawWord = match[0];
    const startIndex = match.index;
    const endIndex = startIndex + rawWord.length;

    // Clean word for audio timing calculation
    // If it's a markdown link, use the inner text for syllable estimation
    let cleanWord: string;
    const mdMatch = rawWord.match(/\[([^\]]+)\]/);
    if (mdMatch) {
      cleanWord = mdMatch[1].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    } else {
      cleanWord = rawWord.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    words.push({
      word: rawWord, // Preserves the exact punctuation and links
      cleanWord: cleanWord || rawWord,
      startIndex,
      endIndex,
    });
  }

  return words;
}

/**
 * Split text into paragraphs and natural sentences with robust protection
 * against false period splits (abbreviations, initials, decimals, domains, ellipses).
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
  } = {}
): ArticleDocument {
  // 1. Decode all HTML entities and normalize quotes/apostrophes
  const decodedText = decodeHtmlAndNormalizeQuotes(rawText);

  // 2. Clean paragraph characters while preserving formatting & punctuation
  const cleanedText = removeParagraphCharacters(decodedText);

  // Normalize line endings
  const normalized = cleanedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into paragraph blocks (preserving empty line paragraph breaks)
  const rawParagraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const paragraphs: ParagraphItem[] = [];
  let globalSentenceCounter = 0;
  let totalWordsCounter = 0;

  // Protect periods that should never cause sentence splits
  const protectNonSentencePeriods = (text: string): string => {
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
    );
  };

  const unprotectPeriods = (text: string): string => {
    return text.replace(/§DOT§/g, '.').replace(/§ELLIP§/g, '...');
  };

  rawParagraphs.forEach((rawP, pIndex) => {
    let isHeading = false;
    let headingLevel = 2;
    let pText = rawP;

    // Check if paragraph is markdown heading: # Heading, ## Heading, ### Heading
    const headingMatch = pText.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      isHeading = true;
      headingLevel = headingMatch[1].length;
      pText = headingMatch[2].trim();
    }

    // Discard any internal hyperlinks matching sourceUrl#... or #...
    // e.g. [Introduction](https://www.kernel.org/doc/html/v4.16/process/howto.html#introduction) -> Introduction
    // e.g. [Introduction](#introduction) -> Introduction
    if (metadata.sourceUrl) {
      const docBase = metadata.sourceUrl.split('#')[0].replace(/\/$/, '');
      pText = pText.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (full, label, url) => {
        const linkBase = url.split('#')[0].replace(/\/$/, '');
        const isInternal = url.startsWith('#') || (url.includes('#') && docBase === linkBase);
        if (isInternal) {
          if (full.trim() === rawP.trim()) {
            isHeading = true;
          }
          return label;
        }
        return full;
      });
    } else {
      pText = pText.replace(/\[([^\]]+)\]\(#[^)\s]+\)/g, (full, label) => {
        if (full.trim() === rawP.trim()) {
          isHeading = true;
        }
        return label;
      });
    }

    // Convert mailto: links and references into plain text e-mail addresses (no hyperlink)
    pText = pText
      .replace(/\[([^\]]+)\]\(mailto:[^)\s]+\)/gi, '$1')
      .replace(/\bmailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, '$1')
      .replace(/\bmailto:\s*/gi, '');

    // Protect abbreviations and decimals before sentence segmentation
    const protectedText = protectNonSentencePeriods(pText);

    // Split on true sentence boundaries:
    // Punctuation (. ! ?) followed by whitespace and an uppercase letter, quotation mark, or parenthesis
    const rawSentences = protectedText
      .split(/(?<=[.?!]["'”’)]?)\s+(?=[A-Z0-9"“'‘(\[])/)
      .map((s) => unprotectPeriods(s).trim())
      .filter((s) => s.length > 0);

    // Recombine any accidental micro-fragments (e.g. if a split occurred on a stray single character or punctuation)
    const consolidatedSentences: string[] = [];
    for (let i = 0; i < rawSentences.length; i++) {
      const current = rawSentences[i];
      if (consolidatedSentences.length > 0) {
        const prev = consolidatedSentences[consolidatedSentences.length - 1];
        // If current sentence is just 1 or 2 characters (e.g. stray initial or number), merge back
        if (current.length <= 2 && !/[.?!]$/.test(prev)) {
          consolidatedSentences[consolidatedSentences.length - 1] = `${prev} ${current}`;
          continue;
        }
      }
      consolidatedSentences.push(current);
    }

    const finalSentences =
      consolidatedSentences.length > 0
        ? consolidatedSentences
        : [unprotectPeriods(protectedText).trim()];

    const sentenceItems: SentenceItem[] = [];

    finalSentences.forEach((sText, sIndexInP) => {
      const words = tokenizeWords(sText);
      totalWordsCounter += words.length;

      const sentenceItem: SentenceItem = {
        id: `s-${globalSentenceCounter}`,
        globalIndex: globalSentenceCounter,
        paragraphIndex: pIndex,
        sentenceIndexInParagraph: sIndexInP,
        text: sText,
        words,
      };

      sentenceItems.push(sentenceItem);
      globalSentenceCounter++;
    });

    paragraphs.push({
      id: `p-${pIndex}`,
      paragraphIndex: pIndex,
      sentences: sentenceItems,
      rawText: pText,
      isHeading,
      headingLevel,
    });
  });

  const now = Date.now();
  const id = metadata.id || `doc-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const title = metadata.title || (rawParagraphs[0]?.slice(0, 60) ?? 'Untitled Article');

  return {
    id,
    title,
    author: metadata.author,
    domain: metadata.domain,
    sourceUrl: metadata.sourceUrl,
    fileType: metadata.fileType || 'manual',
    rawContent: rawText,
    paragraphs,
    totalSentences: globalSentenceCounter,
    totalWords: totalWordsCounter,
    createdAt: now,
    lastOpenedAt: now,
    lastReadSentenceIndex: 0,
    favorite: false,
    docNavigation: metadata.docNavigation,
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
