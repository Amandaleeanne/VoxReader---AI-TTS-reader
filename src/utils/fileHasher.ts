import { ArticleDocument } from '../types';

/**
 * Generates a fast, lightweight hash code based on the file name
 * and the amount of data (file size in bytes or content length).
 * Designed for rapid O(1) hash table lookup to prevent duplicate file loading.
 *
 * @param name File name or document title
 * @param dataAmount Amount of data (e.g. file size in bytes or text length)
 * @returns 8-character hex hash string (e.g. '7e2b10a4')
 */
export function generateFileHashCode(name: string, dataAmount: number): string {
  const normalizedName = (name || '').trim().toLowerCase();
  const normalizedSize = Math.max(0, Math.floor(dataAmount || 0));
  const payload = `${normalizedName}::size=${normalizedSize}`;

  // 32-bit FNV-1a hash algorithm: fast, uniform distribution, minimal collisions
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    // Math.imul for 32-bit integer multiplication
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Computes or retrieves the hash code for an ArticleDocument.
 */
export function getDocumentHashCode(doc: Partial<ArticleDocument>): string {
  if (doc.hashCode) {
    return doc.hashCode;
  }
  if (doc.metadataDetails?.hashCode) {
    return doc.metadataDetails.hashCode;
  }

  const name = doc.title || 'untitled';
  const size =
    doc.metadataDetails?.fileSizeBytes ??
    (doc.rawContent ? doc.rawContent.length : 0);

  return generateFileHashCode(name, size);
}

/**
 * Builds an O(1) hash table / dictionary of all existing documents in VoxReader.
 * Keys are the document hash codes; values are the ArticleDocument objects.
 */
export function buildDocumentHashTable(
  articles: ArticleDocument[]
): Map<string, ArticleDocument> {
  const table = new Map<string, ArticleDocument>();

  for (const article of articles) {
    if (!article) continue;
    const hash = getDocumentHashCode(article);
    // Associate the article with its hash
    if (!table.has(hash)) {
      table.set(hash, article);
    }
  }

  return table;
}

/**
 * Performs an O(1) hash table lookup to check if a document with
 * the same file hash code already exists in VoxReader.
 *
 * @param incomingDoc The newly parsed document attempting to load
 * @param hashTable Pre-built Map or list of existing articles
 * @returns The existing ArticleDocument if a duplicate hit is found, or null
 */
export function findDuplicateDocument(
  incomingDoc: ArticleDocument,
  articlesOrTable: ArticleDocument[] | Map<string, ArticleDocument>
): ArticleDocument | null {
  if (!incomingDoc) return null;

  const targetHash = getDocumentHashCode(incomingDoc);

  // If a Map hash table was passed in, perform direct O(1) lookup
  const table =
    articlesOrTable instanceof Map
      ? articlesOrTable
      : buildDocumentHashTable(articlesOrTable);

  const existing = table.get(targetHash);
  if (!existing) return null;

  // If it's the exact same document ID (e.g. re-opening the current document), not a duplicate conflict
  if (existing.id === incomingDoc.id) {
    return null;
  }

  return existing;
}

/**
 * Formats data size in bytes or character counts into human-readable text.
 */
export function formatDataSize(bytesOrChars: number, isBytes: boolean = true): string {
  if (!bytesOrChars || bytesOrChars <= 0) return '0 bytes';
  if (!isBytes) {
    return `${bytesOrChars.toLocaleString()} characters`;
  }
  if (bytesOrChars < 1024) return `${bytesOrChars} B`;
  if (bytesOrChars < 1024 * 1024) return `${(bytesOrChars / 1024).toFixed(1)} KB`;
  return `${(bytesOrChars / (1024 * 1024)).toFixed(1)} MB`;
}
