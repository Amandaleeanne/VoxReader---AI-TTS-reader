import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { decodeHtmlAndNormalizeQuotes } from './textParser';

// Configure pdfjs worker to a reliable CDN fallback or standard module worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ParsedFileResult {
  title: string;
  author?: string;
  content: string;
  fileType: 'pdf' | 'epub' | 'text';
}

/**
 * Parse plain text or markdown file.
 */
export async function parseTextFile(file: File): Promise<ParsedFileResult> {
  const content = await file.text();
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
  return {
    title: cleanTitle,
    content,
    fileType: 'text',
  };
}

/**
 * Parse PDF document using pdfjs-dist.
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
    let fullText = '';
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageStrings = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0);

      if (pageStrings.length > 0) {
        fullText += (pageNum > 1 ? '\n\n' : '') + pageStrings.join(' ');
      }
    }

    // Try extracting PDF metadata
    let docTitle = file.name.replace(/\.[^/.]+$/, '');
    let docAuthor = '';
    try {
      const meta = await pdf.getMetadata();
      if ((meta?.info as any)?.Title) {
        docTitle = (meta.info as any).Title;
      }
      if ((meta?.info as any)?.Author) {
        docAuthor = (meta.info as any).Author;
      }
    } catch {
      // Ignore metadata error
    }

    return {
      title: docTitle,
      author: docAuthor,
      content: fullText.trim() || 'No readable text could be extracted from this PDF.',
      fileType: 'pdf',
    };
  } catch (err: any) {
    console.warn('PDF.js failed, attempting fallback extraction:', err);
    // Fallback: extract any ASCII / UTF-8 strings from raw ArrayBuffer if worker failed
    const textDecoder = new TextDecoder('utf-8', { fatal: false });
    const rawString = textDecoder.decode(new Uint8Array(arrayBuffer));
    const extractedBlocks: string[] = [];
    const textBlockRegex = /\(([^)]+)\)\s*Tj/g;
    let m;
    while ((m = textBlockRegex.exec(rawString)) !== null) {
      if (m[1].length > 1) extractedBlocks.push(m[1]);
    }
    
    const fallbackText = extractedBlocks.length > 10 
      ? extractedBlocks.join(' ') 
      : 'Error parsing PDF. Please make sure the PDF has selectable text and not scanned images.';

    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      content: fallbackText,
      fileType: 'pdf',
    };
  }
}

/**
 * Parse ePub file using JSZip (ePub is an open zip container).
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
    // Search for any .opf file in the zip
    const opfEntry = Object.keys(zip.files).find((p) => p.endsWith('.opf'));
    if (opfEntry) {
      opfFile = zip.file(opfEntry);
      opfPath = opfEntry;
    }
  }

  let bookTitle = file.name.replace(/\.[^/.]+$/, '');
  let bookAuthor = '';
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const htmlFilePaths: string[] = [];

  if (opfFile) {
    const opfXml = await opfFile.async('text');

    // Title
    const titleMatch = opfXml.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
    if (titleMatch?.[1]) {
      bookTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Author
    const creatorMatch = opfXml.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
    if (creatorMatch?.[1]) {
      bookAuthor = creatorMatch[1].replace(/<[^>]+>/g, '').trim();
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

  // 3. Extract text from each chapter
  const chaptersText: string[] = [];

  for (const path of htmlFilePaths) {
    // Normalize path separators / decoded URI
    const cleanPath = decodeURIComponent(path.replace(/^\//, ''));
    const docFile = zip.file(cleanPath) || zip.file(path);
    if (!docFile) continue;

    const htmlContent = await docFile.async('text');

    // Clean text while preserving paragraph breaks and punctuation
    const rawClean = htmlContent
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<(?:p|h1|h2|h3|h4|blockquote|li)[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:para|sect);/gi, '')
      .replace(/[¶§\u00B6\u00A7\u2029\u2028\f]/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();

    const cleanText = decodeHtmlAndNormalizeQuotes(rawClean);

    if (cleanText.length > 30) {
      chaptersText.push(cleanText);
    }
  }

  return {
    title: bookTitle,
    author: bookAuthor,
    content: chaptersText.join('\n\n') || 'Could not extract text from ePub.',
    fileType: 'epub',
  };
}
