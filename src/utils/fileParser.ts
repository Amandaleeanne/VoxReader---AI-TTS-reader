import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import {
  decodeHtmlAndNormalizeQuotes,
  parseTextIntoDocument,
  createDocumentFromParagraphs,
  tokenizeWords,
  protectNonSentencePeriods,
  unprotectPeriods,
  reconcileBrokenParagraphs,
} from './textParser';
import { ArticleDocument, ParagraphItem, SentenceItem, DocumentMetadataDetails, WordToken } from '../types';

// Configure pdfjs worker to a reliable CDN fallback or standard module worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ParsedFileResult {
  title: string;
  author?: string;
  content: string;
  fileType: 'pdf' | 'epub' | 'text' | 'markdown';
  paragraphs?: ParagraphItem[];
  metadataDetails?: DocumentMetadataDetails;
}

export interface BinaryFilePayload {
  isBinaryFile: boolean;
  fileType: 'pdf' | 'epub';
  fileName: string;
  url: string;
  domain?: string;
  base64?: string;
  proxyDownloadUrl?: string;
  contentType?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Process a binary PDF or ePub file response from the server,
 * parse its text/chapters/metadata, and return a complete ArticleDocument.
 */
export async function processBinaryFileResponse(data: BinaryFilePayload): Promise<ArticleDocument> {
  let arrayBuffer: ArrayBuffer;
  if (data.base64) {
    const binaryString = atob(data.base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    arrayBuffer = bytes.buffer;
  } else if (data.proxyDownloadUrl) {
    const res = await fetch(data.proxyDownloadUrl);
    if (!res.ok) throw new Error(`Failed to download ${data.fileType.toUpperCase()} file from server.`);
    arrayBuffer = await res.arrayBuffer();
  } else {
    throw new Error('No file payload found in server response.');
  }

  const mimeType = data.contentType || (data.fileType === 'pdf' ? 'application/pdf' : 'application/epub+zip');
  const file = new File([arrayBuffer], data.fileName, { type: mimeType });

  const parsedResult = data.fileType === 'pdf' ? await parsePdfFile(file) : await parseEpubFile(file);

  if (
    (!parsedResult.paragraphs || parsedResult.paragraphs.length === 0) &&
    (!parsedResult.content || parsedResult.content.trim().length === 0)
  ) {
    throw new Error(`No readable text could be extracted from this ${data.fileType.toUpperCase()} file.`);
  }

  if (parsedResult.paragraphs && parsedResult.paragraphs.length > 0) {
    return createDocumentFromParagraphs(parsedResult.paragraphs, {
      title: parsedResult.title || data.fileName.replace(/\.[^/.]+$/, ''),
      author: parsedResult.author,
      fileType: data.fileType,
      domain: data.domain,
      sourceUrl: data.url,
      metadataDetails: parsedResult.metadataDetails,
      rawContent: parsedResult.content,
    });
  }

  return parseTextIntoDocument(parsedResult.content, {
    title: parsedResult.title || data.fileName.replace(/\.[^/.]+$/, ''),
    author: parsedResult.author,
    fileType: data.fileType,
    domain: data.domain,
    sourceUrl: data.url,
  });
}

/**
 * Parse plain text or markdown file, preserving headings, lists, code fences, and blockquotes.
 */
export async function parseTextFile(file: File): Promise<ParsedFileResult> {
  const content = await file.text();
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const fileType: ArticleDocument['fileType'] = extension === 'md' ? 'markdown' : 'text';
  const doc = parseTextIntoDocument(content, {
    title: cleanTitle,
    fileType,
  });

  return {
    title: cleanTitle,
    content,
    fileType,
    paragraphs: doc.paragraphs,
    metadataDetails: {
      fileSizeFormatted: formatBytes(file.size),
    },
  };
}

interface PdfTextLine {
  text: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isCentered: boolean;
  minX: number;
  maxX: number;
  posY: number;
  hasParagraphChar?: boolean;
}

/**
 * Parse PDF document using pdfjs-dist with exact layout, page numbers,
 * heading hierarchy, and typography preserved.
 */
export async function parsePdfFile(file: File): Promise<ParsedFileResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const allParagraphs: ParagraphItem[] = [];
    const extractedTextParts: string[] = [];

    // Extract PDF metadata
    let docTitle = file.name.replace(/\.[^/.]+$/, '');
    let docAuthor = '';
    let pdfSubject = '';
    let pdfCreator = '';
    let pdfProducer = '';
    let creationDate = '';

    try {
      const meta = await pdf.getMetadata();
      const info = meta?.info as any;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim().length > 0) {
        docTitle = info.Title.trim();
      }
      if (info?.Author && typeof info.Author === 'string') {
        docAuthor = info.Author.trim();
      }
      if (info?.Subject && typeof info.Subject === 'string') {
        pdfSubject = info.Subject.trim();
      }
      if (info?.Creator && typeof info.Creator === 'string') {
        pdfCreator = info.Creator.trim();
      }
      if (info?.Producer && typeof info.Producer === 'string') {
        pdfProducer = info.Producer.trim();
      }
      if (info?.CreationDate) {
        creationDate = String(info.CreationDate);
      }
    } catch {
      // Ignore metadata parsing error
    }

    let paragraphCounter = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      // Insert Page Break Divider
      allParagraphs.push({
        id: `pdf-page-${pageNum}`,
        paragraphIndex: paragraphCounter++,
        sentences: [],
        rawText: `Page ${pageNum} of ${numPages}`,
        blockType: 'page-break',
        pageNumber: pageNum,
      });

      const rawItems = (textContent.items || []).filter(
        (item: any) => typeof item.str === 'string' && (item.str.trim().length > 0 || /[\u2029\f¶\u00B6]/.test(item.str))
      ) as any[];

      if (rawItems.length === 0) {
        try { page.cleanup(); } catch {}
        continue;
      }

      // Sort items top-to-bottom (PDF posY is inverted: highest Y is at top)
      rawItems.sort((a: any, b: any) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        // Group items on roughly the same baseline (within 3px)
        if (Math.abs(yA - yB) > 3) {
          return yB - yA; // top to bottom
        }
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB; // left to right
      });

      // Cluster items into lines
      const lines: PdfTextLine[] = [];
      let currentLineItems: any[] = [];
      let currentLineY: number | null = null;

      const flushLine = () => {
        if (currentLineItems.length === 0 || currentLineY === null) return;
        currentLineItems.sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));

        let lineText = '';
        let lastRight = -1;

        for (const item of currentLineItems) {
          const x = item.transform ? item.transform[4] : 0;
          if (lastRight > 0 && x - lastRight > 2.5) {
            lineText += ' ';
          }
          lineText += item.str;
          lastRight = x + (item.width || 0);
        }

        lineText = lineText.trim();
        if (lineText.length > 0) {
          const fontSizes = currentLineItems.map((i) => Math.abs((i.transform ? i.transform[3] : 0) || i.height || 12));
          const maxFontSize = Math.max(...fontSizes);
          const isBold = currentLineItems.some((i) =>
            /bold|black|heavy|semibold/i.test(i.fontName || '')
          );
          const isItalic = currentLineItems.some((i) =>
            /italic|oblique/i.test(i.fontName || '')
          );
          const minX = Math.min(...currentLineItems.map((i) => (i.transform ? i.transform[4] : 0)));
          const maxX = Math.max(...currentLineItems.map((i) => (i.transform ? i.transform[4] : 0) + (i.width || 0)));
          const lineWidth = maxX - minX;
          const isCentered =
            lineWidth > 40 &&
            Math.abs((viewport.width - lineWidth) / 2 - minX) < 35;

          const hasParaChar = /[\u2029\f¶\u00B6]/.test(lineText);
          const subParts = lineText.split(/[\u2029\f¶\u00B6]+/);
          if (subParts.length > 1) {
            for (const sp of subParts) {
              const trimmedSp = sp.trim();
              if (trimmedSp.length > 0) {
                lines.push({
                  text: trimmedSp,
                  fontSize: maxFontSize,
                  isBold,
                  isItalic,
                  isCentered,
                  minX,
                  maxX,
                  posY: currentLineY,
                  hasParagraphChar: true,
                });
              }
            }
          } else {
            lines.push({
              text: lineText,
              fontSize: maxFontSize,
              isBold,
              isItalic,
              isCentered,
              minX,
              maxX,
              posY: currentLineY,
              hasParagraphChar: hasParaChar,
            });
          }
        }

        currentLineItems = [];
        currentLineY = null;
      };

      for (const item of rawItems) {
        const y = item.transform ? item.transform[5] : 0;
        if (currentLineY === null || Math.abs(y - currentLineY) <= 3.5) {
          currentLineItems.push(item);
          currentLineY = y;
        } else {
          flushLine();
          currentLineItems.push(item);
          currentLineY = y;
        }
      }
      flushLine();

      if (lines.length === 0) {
        try { page.cleanup(); } catch {}
        continue;
      }

      // Calculate baseline body text font size for this page
      const sortedSizes = lines.map((l) => l.fontSize).sort((a, b) => a - b);
      const medianFontSize = sortedSizes[Math.floor(sortedSizes.length / 2)] || 12;

      // Group lines into semantic paragraphs, headings, and list items
      let currentParagraphLines: PdfTextLine[] = [];

      const flushParagraph = () => {
        if (currentParagraphLines.length === 0) return;

        const firstLine = currentParagraphLines[0];

        // Hyphenation repair across lines: e.g. "re-" + "search" -> "research"
        const repairedLineTexts: string[] = [];
        for (let li = 0; li < currentParagraphLines.length; li++) {
          let lText = currentParagraphLines[li].text;
          if (li < currentParagraphLines.length - 1 && /[-]\s*$/.test(lText)) {
            const nextL = currentParagraphLines[li + 1].text;
            const nextMatch = nextL.match(/^([a-zA-Z]+)(.*)$/);
            if (nextMatch) {
              const stem = lText.replace(/[-]\s*$/, '');
              repairedLineTexts.push(stem + nextMatch[1]);
              currentParagraphLines[li + 1].text = nextMatch[2].trim();
              continue;
            }
          }
          if (lText.length > 0) {
            repairedLineTexts.push(lText);
          }
        }

        const hadParagraphChar = currentParagraphLines.some((l) => l.hasParagraphChar || /[\u2029\f¶\u00B6]/.test(l.text));
        const combinedText = (repairedLineTexts.length > 0 ? repairedLineTexts : currentParagraphLines.map((l) => l.text))
          .join(' ')
          .replace(/[\u2029\f¶\u00B6]+/g, '')
          .trim();
        const maxFont = Math.max(...currentParagraphLines.map((l) => l.fontSize));
        const allCentered = currentParagraphLines.every((l) => l.isCentered);
        const hasBold = currentParagraphLines.some((l) => l.isBold);
        const hasItalic = currentParagraphLines.some((l) => l.isItalic);
        const indentPx = Math.max(0, Math.round(firstLine.minX - 45));

        let blockType: ParagraphItem['blockType'] = 'paragraph';
        let headingLevel: number | undefined;
        let isListItem = false;
        let listMarker: string | undefined;

        // Classify Heading Level
        if (maxFont >= medianFontSize * 1.5 || (maxFont >= medianFontSize * 1.3 && hasBold)) {
          blockType = 'heading';
          headingLevel = 1;
        } else if (maxFont >= medianFontSize * 1.25 || (maxFont >= medianFontSize * 1.15 && hasBold)) {
          blockType = 'heading';
          headingLevel = 2;
        } else if (maxFont >= medianFontSize * 1.1 && hasBold) {
          blockType = 'heading';
          headingLevel = 3;
        }

        // Check if List Item
        const listMatch = combinedText.match(/^([•–—*]|\d+[\.\)]|[a-zA-Z][\.\)])\s+(.+)$/);
        if (listMatch) {
          blockType = 'list-item';
          isListItem = true;
          listMarker = listMatch[1];
        }

        // Clean sentences with non-sentence period protection
        const cleanDecoded = decodeHtmlAndNormalizeQuotes(combinedText);
        const protectedText = protectNonSentencePeriods(cleanDecoded);
        const rawSentences = protectedText
          .split(/(?<=[.?!]["'”’)]?)\s+(?=[A-Z0-9"“'‘(\[])/)
          .map((s) => unprotectPeriods(s).trim())
          .filter((s) => s.length > 0);

        const finalSentences = rawSentences.length > 0 ? rawSentences : [unprotectPeriods(protectedText).trim()];
        const sentenceItems: SentenceItem[] = [];

        finalSentences.forEach((sText, sIdx) => {
          sentenceItems.push({
            id: `p-${paragraphCounter}-s-${sIdx}`,
            globalIndex: 0, // will be indexed by createDocumentFromParagraphs
            paragraphIndex: paragraphCounter,
            sentenceIndexInParagraph: sIdx,
            text: sText,
            words: tokenizeWords(sText, { isBold: hasBold, isItalic: hasItalic }),
          });
        });

        allParagraphs.push({
          id: `pdf-p-${paragraphCounter}`,
          paragraphIndex: paragraphCounter++,
          sentences: sentenceItems,
          rawText: combinedText,
          blockType,
          isHeading: blockType === 'heading',
          headingLevel,
          isListItem,
          listMarker,
          textAlign: 'left', // Document viewer prefers left adjustment for text
          isBold: hasBold,
          isItalic: hasItalic,
          pageNumber: pageNum,
          fontSizePt: Math.round(maxFont),
          indentPx: indentPx > 14 ? indentPx : undefined,
          preserveLineBreaks: isListItem || (currentParagraphLines.length > 1 && currentParagraphLines.length <= 4 && maxFont < medianFontSize * 1.1),
          hasExplicitParagraphBreak: hadParagraphChar,
        });

        extractedTextParts.push(combinedText);
        currentParagraphLines = [];
      };

      // Calculate page margins to detect indented starts and short paragraph terminal lines
      const regularLines = lines.filter((l) => !l.isCentered && l.text.length > 15);
      const pageLeftMargin = regularLines.length > 0 ? Math.min(...regularLines.map((l) => l.minX)) : 40;
      const pageRightMargin = regularLines.length > 0 ? Math.max(...regularLines.map((l) => l.maxX)) : 550;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (currentParagraphLines.length === 0) {
          currentParagraphLines.push(line);
          continue;
        }

        const prevLine = currentParagraphLines[currentParagraphLines.length - 1];
        const verticalGap = Math.abs(prevLine.posY - line.posY);
        const estLineHeight = Math.max(prevLine.fontSize, line.fontSize) * 1.25;

        const isHeadingLine =
          line.fontSize >= medianFontSize * 1.35 ||
          (line.fontSize >= medianFontSize * 1.2 && line.isBold);
        const prevWasHeading =
          prevLine.fontSize >= medianFontSize * 1.35 ||
          (prevLine.fontSize >= medianFontSize * 1.2 && prevLine.isBold);

        const isListLine = /^([•–—*]|\d+[\.\)]|[a-zA-Z][\.\)])\s+/.test(line.text.trim());

        // Check if prevLine has ended with terminal sentence punctuation
        const prevText = prevLine.text.trim();
        const prevEndedWithPeriod = /[.?!]["'”’)]?\s*$/.test(prevText) || /[:;]\s*$/.test(prevText);

        // 1. Enforce embedded paragraph character in the file's data (Pilcrow ¶, \u2029, \f)
        const hasEmbeddedParagraphChar =
          Boolean(prevLine.hasParagraphChar) ||
          Boolean(line.hasParagraphChar) ||
          /[\u2029\f¶\u00B6]/.test(prevText) ||
          /[\u2029\f¶\u00B6]/.test(line.text);

        // 2. Indentation check (first line of a new paragraph is indented relative to margin or prevLine)
        const firstLineInP = currentParagraphLines[0];
        const isIndented =
          (line.minX - prevLine.minX >= 6) ||
          (line.minX - pageLeftMargin >= 6) ||
          (firstLineInP && line.minX - firstLineInP.minX >= 6);

        // 3. Short line terminal check: In book/PDF layout, the last line of a paragraph stops before the right margin
        const prevWasShortLine = prevLine.maxX < pageRightMargin - 25;

        // Paragraph break rules:
        // - Enforce embedded paragraph character
        // - Heading boundary changed
        // - New line is an explicit list item
        // - When previous line completed with terminal punctuation (.?!):
        //   moderate vertical gap (> 1.08x line height), indentation, or short terminal line creates new paragraph
        // - Distinct visual block gap (> 1.4x line height) even without terminal punctuation
        // - If previous line has NOT hit a period yet and is normal margin overflow prose, keep in current paragraph!
        let shouldBreak = false;
        if (hasEmbeddedParagraphChar) {
          shouldBreak = true;
        } else if (isHeadingLine !== prevWasHeading) {
          shouldBreak = true;
        } else if (isListLine) {
          shouldBreak = true;
        } else if (prevEndedWithPeriod && (verticalGap > estLineHeight * 1.08 || isIndented || prevWasShortLine)) {
          shouldBreak = true;
        } else if (verticalGap > estLineHeight * 1.4) {
          shouldBreak = true;
        }

        if (shouldBreak) {
          flushParagraph();
          currentParagraphLines.push(line);
        } else {
          currentParagraphLines.push(line);
        }
      }
      flushParagraph();

      try {
        page.cleanup();
      } catch {
        // ignore cleanup error
      }
    }

    const reconciledParagraphs = reconcileBrokenParagraphs(allParagraphs);
    const fullContent = extractedTextParts.join('\n\n');

    return {
      title: docTitle,
      author: docAuthor,
      content: fullContent || 'No readable text could be extracted from this PDF.',
      fileType: 'pdf',
      paragraphs: reconciledParagraphs,
      metadataDetails: {
        pageCount: numPages,
        fileSizeFormatted: formatBytes(file.size),
        pdfCreator,
        pdfProducer,
        subject: pdfSubject,
        publicationDate: creationDate,
      },
    };
  } catch (err: any) {
    console.warn('PDF.js structured parsing failed, falling back to basic extraction:', err);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      content: 'Error parsing PDF. Please make sure the PDF has selectable text and not scanned images.',
      fileType: 'pdf',
    };
  }
}

function extractStyledTokensFromEpubElement(element: Element): WordToken[] {
  const tokens: WordToken[] = [];

  function traverse(
    n: Node,
    activeStyles: {
      isBold: boolean;
      isItalic: boolean;
      isCode: boolean;
      isUnderline: boolean;
      isStrikethrough: boolean;
      linkUrl?: string;
    }
  ) {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = decodeHtmlAndNormalizeQuotes(n.textContent || '');
      if (!text.trim()) return;

      const regex = /\S+/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        const raw = m[0];
        tokens.push({
          word: raw,
          cleanWord: raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || raw,
          startIndex: m.index,
          endIndex: m.index + raw.length,
          isBold: activeStyles.isBold,
          isItalic: activeStyles.isItalic,
          isCode: activeStyles.isCode,
          isUnderline: activeStyles.isUnderline,
          isStrikethrough: activeStyles.isStrikethrough,
          linkUrl: activeStyles.linkUrl,
          hasLineBreakAfter: false,
        });
      }
    } else if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        if (tokens.length > 0) {
          tokens[tokens.length - 1].hasLineBreakAfter = true;
        }
        return;
      }
      const style = (el.getAttribute('style') || '').toLowerCase();
      const nextStyles = {
        isBold:
          activeStyles.isBold ||
          tag === 'strong' ||
          tag === 'b' ||
          style.includes('font-weight: bold') ||
          style.includes('font-weight: 700') ||
          style.includes('font-weight: 600'),
        isItalic:
          activeStyles.isItalic ||
          tag === 'em' ||
          tag === 'i' ||
          style.includes('font-style: italic'),
        isCode:
          activeStyles.isCode ||
          tag === 'code' ||
          tag === 'tt' ||
          tag === 'kbd' ||
          tag === 'samp',
        isUnderline:
          activeStyles.isUnderline ||
          tag === 'u' ||
          style.includes('text-decoration: underline'),
        isStrikethrough:
          activeStyles.isStrikethrough ||
          tag === 's' ||
          tag === 'del' ||
          tag === 'strike',
        linkUrl:
          activeStyles.linkUrl || (tag === 'a' ? el.getAttribute('href') || undefined : undefined),
      };
      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i], nextStyles);
      }
    }
  }

  traverse(element, {
    isBold: false,
    isItalic: false,
    isCode: false,
    isUnderline: false,
    isStrikethrough: false,
  });
  return tokens;
}

/**
 * Parse ePub file using JSZip and browser DOMParser, preserving book chapters,
 * headings, blockquotes, lists, tables, and formatting.
 */
export async function parseEpubFile(file: File): Promise<ParsedFileResult> {
  const zip = await JSZip.loadAsync(file);

  // 1. Locate container.xml
  const containerFile = zip.file('META-INF/container.xml');
  let opfPath = 'OEBPS/content.opf';

  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const rootfileMatch = containerXml.match(/full-path=["']([^"']+\.opf)["']/i);
    if (rootfileMatch && rootfileMatch[1]) {
      opfPath = rootfileMatch[1];
    }
  }

  // 2. Read OPF
  let opfFile = zip.file(opfPath);
  if (!opfFile) {
    const opfEntry = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
    if (opfEntry) {
      opfFile = zip.file(opfEntry);
      opfPath = opfEntry;
    }
  }

  let bookTitle = file.name.replace(/\.[^/.]+$/, '');
  let bookAuthor = '';
  let bookPublisher = '';
  let bookDate = '';
  let bookLanguage = '';
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const htmlFilePaths: string[] = [];

  if (opfFile) {
    const opfXml = await opfFile.async('text');

    const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
    if (titleMatch?.[1]) {
      bookTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const creatorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
    if (creatorMatch?.[1]) {
      bookAuthor = creatorMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const pubMatch = opfXml.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
    if (pubMatch?.[1]) {
      bookPublisher = pubMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const dateMatch = opfXml.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i);
    if (dateMatch?.[1]) {
      bookDate = dateMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    const langMatch = opfXml.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
    if (langMatch?.[1]) {
      bookLanguage = langMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Manifest items
    const manifestItems: Record<string, string> = {};
    const itemRegex = /<item\s+[^>]*id=["']([^"']+)["'][^>]*href=["']([^"']+)["'][^>]*media-type=["']([^"']+)["'][^>]*\/?>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(opfXml)) !== null) {
      const id = itemMatch[1];
      const href = itemMatch[2];
      const mediaType = itemMatch[3];
      if (mediaType.includes('xhtml') || mediaType.includes('html')) {
        manifestItems[id] = opfDir + href;
      }
    }

    // Spine reading order
    const spineRegex = /<itemref\s+[^>]*idref=["']([^"']+)["'][^>]*\/?>/gi;
    let spineMatch;
    while ((spineMatch = spineRegex.exec(opfXml)) !== null) {
      const idref = spineMatch[1];
      if (manifestItems[idref]) {
        htmlFilePaths.push(manifestItems[idref]);
      }
    }
  }

  // If spine not found, collect all .xhtml and .html files sorted
  if (htmlFilePaths.length === 0) {
    Object.keys(zip.files)
      .filter((name) => (name.endsWith('.xhtml') || name.endsWith('.html')) && !name.includes('toc'))
      .sort()
      .forEach((name) => htmlFilePaths.push(name));
  }

  // 3. Extract chapters and format preserved blocks using DOMParser
  const allParagraphs: ParagraphItem[] = [];
  const chaptersFound: string[] = [];
  let paragraphCounter = 0;

  for (let chapterIdx = 0; chapterIdx < htmlFilePaths.length; chapterIdx++) {
    const rawPath = htmlFilePaths[chapterIdx];
    const cleanPath = decodeURIComponent(rawPath.replace(/^\//, ''));
    const docFile = zip.file(cleanPath) || zip.file(rawPath);
    if (!docFile) continue;

    const htmlContent = await docFile.async('text');
    let doc: Document | null = null;
    try {
      doc = new DOMParser().parseFromString(htmlContent, 'text/html');
    } catch {
      continue;
    }
    if (!doc || !doc.body) continue;

    // Detect chapter title from document <title> or first <h1>/<h2>
    let detectedChapterTitle = '';
    const h1 = doc.querySelector('h1, h2, title');
    if (h1 && h1.textContent?.trim()) {
      detectedChapterTitle = h1.textContent.trim();
    } else {
      detectedChapterTitle = `Chapter ${chapterIdx + 1}`;
    }

    chaptersFound.push(detectedChapterTitle);

    // Insert Chapter Header Block
    allParagraphs.push({
      id: `epub-chap-${chapterIdx}`,
      paragraphIndex: paragraphCounter++,
      sentences: [
        {
          id: `epub-chap-s-${chapterIdx}`,
          globalIndex: 0,
          paragraphIndex: paragraphCounter,
          sentenceIndexInParagraph: 0,
          text: detectedChapterTitle,
          words: tokenizeWords(detectedChapterTitle),
        },
      ],
      rawText: detectedChapterTitle,
      blockType: 'chapter-header',
      chapterTitle: detectedChapterTitle,
      headingLevel: 1,
    });

    // Walk body elements
    const blockNodes = doc.body.querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol, hr, table'
    );

    blockNodes.forEach((node) => {
      const tagName = node.tagName.toLowerCase();

      // Divider
      if (tagName === 'hr') {
        allParagraphs.push({
          id: `epub-div-${paragraphCounter}`,
          paragraphIndex: paragraphCounter++,
          sentences: [],
          rawText: '✦ ✦ ✦',
          blockType: 'divider',
        });
        return;
      }

      // Tables
      if (tagName === 'table') {
        const ths = Array.from(node.querySelectorAll('th')).map((th) =>
          decodeHtmlAndNormalizeQuotes(th.textContent || '').trim()
        );
        const trs = Array.from(node.querySelectorAll('tr'));
        let headers = ths;
        let startRowIdx = 0;
        if (headers.length === 0 && trs.length > 0) {
          headers = Array.from(trs[0].querySelectorAll('td')).map((td) =>
            decodeHtmlAndNormalizeQuotes(td.textContent || '').trim()
          );
          startRowIdx = 1;
        }
        const rows: string[][] = [];
        for (let r = startRowIdx; r < trs.length; r++) {
          const cells = Array.from(trs[r].querySelectorAll('td, th')).map((td) =>
            decodeHtmlAndNormalizeQuotes(td.textContent || '').trim()
          );
          if (cells.some((c) => c.length > 0)) {
            rows.push(cells);
          }
        }
        if (headers.length > 0 || rows.length > 0) {
          const tableSpeech = [
            headers.join(', '),
            ...rows.map((r) => r.join(' | ')),
          ]
            .filter(Boolean)
            .join('. ');

          const sentenceItems: SentenceItem[] = [
            {
              id: `epub-tbl-s-${paragraphCounter}`,
              globalIndex: 0,
              paragraphIndex: paragraphCounter,
              sentenceIndexInParagraph: 0,
              text: tableSpeech,
              words: tokenizeWords(tableSpeech),
            },
          ];

          allParagraphs.push({
            id: `epub-tbl-${paragraphCounter}`,
            paragraphIndex: paragraphCounter++,
            sentences: sentenceItems,
            rawText: tableSpeech,
            blockType: 'table',
            tableData: { headers, rows },
            chapterTitle: detectedChapterTitle,
          });
          return;
        }
      }

      // Lists
      if (tagName === 'ul' || tagName === 'ol') {
        const items = node.querySelectorAll('li');
        items.forEach((li, liIdx) => {
          const text = decodeHtmlAndNormalizeQuotes(li.textContent || '').trim();
          if (text.length === 0) return;

          const marker = tagName === 'ol' ? `${liIdx + 1}.` : '•';
          const styledTokens = extractStyledTokensFromEpubElement(li);
          allParagraphs.push({
            id: `epub-li-${paragraphCounter}`,
            paragraphIndex: paragraphCounter++,
            sentences: [
              {
                id: `epub-li-s-${paragraphCounter}`,
                globalIndex: 0,
                paragraphIndex: paragraphCounter,
                sentenceIndexInParagraph: 0,
                text,
                words: styledTokens.length > 0 ? styledTokens : tokenizeWords(text),
              },
            ],
            rawText: text,
            blockType: 'list-item',
            isListItem: true,
            listMarker: marker,
          });
        });
        return;
      }

      const text = decodeHtmlAndNormalizeQuotes(node.textContent || '').trim();
      if (text.length === 0) return;

      let blockType: ParagraphItem['blockType'] = 'paragraph';
      let headingLevel: number | undefined;

      if (tagName === 'h1') {
        blockType = 'heading';
        headingLevel = 1;
      } else if (tagName === 'h2') {
        blockType = 'heading';
        headingLevel = 2;
      } else if (tagName === 'h3') {
        blockType = 'heading';
        headingLevel = 3;
      } else if (tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
        blockType = 'heading';
        headingLevel = 4;
      } else if (tagName === 'blockquote') {
        blockType = 'blockquote';
      } else if (tagName === 'pre') {
        blockType = 'code';
      }

      // Alignment and Verse check (prefer left adjustment for text)
      const inlineStyle = (node.getAttribute('style') || '').toLowerCase();
      const className = (node.getAttribute('class') || '').toLowerCase();
      let textAlign: ParagraphItem['textAlign'] = 'left';
      if (inlineStyle.includes('text-align: right') || className.includes('right')) {
        textAlign = 'right';
      } else if (inlineStyle.includes('text-align: justify') || className.includes('justify')) {
        textAlign = 'justify';
      } else {
        textAlign = 'left';
      }

      const hasBr = node.querySelector('br') !== null || className.includes('verse') || className.includes('poem');
      const styledTokens = extractStyledTokensFromEpubElement(node);

      // Sentences
      const rawSentences = text
        .split(/(?<=[.?!]["'”’)]?)\s+(?=[A-Z0-9"“'‘(\[])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const finalSentences = rawSentences.length > 0 ? rawSentences : [text];
      const sentenceItems: SentenceItem[] = [];

      finalSentences.forEach((sText, sIdx) => {
        // If we have extracted styled tokens matching the sentence length, use them
        const words = styledTokens.length > 0 && finalSentences.length === 1
          ? styledTokens
          : tokenizeWords(sText);

        sentenceItems.push({
          id: `epub-p-${paragraphCounter}-s-${sIdx}`,
          globalIndex: 0,
          paragraphIndex: paragraphCounter,
          sentenceIndexInParagraph: sIdx,
          text: sText,
          words,
        });
      });

      allParagraphs.push({
        id: `epub-p-${paragraphCounter}`,
        paragraphIndex: paragraphCounter++,
        sentences: sentenceItems,
        rawText: text,
        blockType,
        isHeading: blockType === 'heading',
        headingLevel,
        textAlign,
        chapterTitle: detectedChapterTitle,
        preserveLineBreaks: hasBr,
        isPoemOrVerse: hasBr,
        hasExplicitParagraphBreak: true,
      });
    });
  }

  const fullContent = allParagraphs.map((p) => p.rawText).join('\n\n');

  return {
    title: bookTitle,
    author: bookAuthor,
    content: fullContent || 'Could not extract text from ePub.',
    fileType: 'epub',
    paragraphs: allParagraphs,
    metadataDetails: {
      publisher: bookPublisher,
      publicationDate: bookDate,
      language: bookLanguage,
      chapters: chaptersFound,
      fileSizeFormatted: formatBytes(file.size),
    },
  };
}
