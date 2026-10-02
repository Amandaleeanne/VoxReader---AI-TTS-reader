import { ArticleDocument } from '../types';
import { tokenizeWords, decodeHtmlAndNormalizeQuotes } from './textParser';

const DB_NAME = 'voxread_db';
const DB_VERSION = 1;
const STORE_NAME = 'articles';
const SETTINGS_KEY = 'voxread_voice_settings';
const DISPLAY_KEY = 'voxread_display_settings';
const ACTIVE_DOC_ID_KEY = 'voxread_active_doc_id';

/**
 * Ensures any article loaded from storage has full punctuation on all word tokens,
 * and fixes any HTML entities or broken quote codes (e.g. 8220;, &#8221, &#8217;).
 */
export function sanitizeStoredArticle(doc: ArticleDocument): ArticleDocument {
  if (!doc || !doc.paragraphs) return doc;
  let changed = false;

  const rawCleanTitle = decodeHtmlAndNormalizeQuotes(doc.title || '');
  if (rawCleanTitle !== doc.title) {
    doc.title = rawCleanTitle;
    changed = true;
  }

  if (doc.rawContent) {
    const rawCleanContent = decodeHtmlAndNormalizeQuotes(doc.rawContent);
    if (rawCleanContent !== doc.rawContent) {
      doc.rawContent = rawCleanContent;
      changed = true;
    }
  }

  const updatedParagraphs = doc.paragraphs.map((p) => {
    let isHeading = p.isHeading;
    let headingLevel = p.headingLevel;
    const headingMatch = p.rawText?.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch && !isHeading) {
      isHeading = true;
      headingLevel = headingMatch[1].length;
      changed = true;
    }

    return {
      ...p,
      isHeading,
      headingLevel,
      sentences: p.sentences.map((s) => {
        let currentSentenceText = s.text;
        const textHasMailto = /\bmailto:/i.test(currentSentenceText);
        if (textHasMailto) {
          currentSentenceText = currentSentenceText
            .replace(/\bmailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi, '$1')
            .replace(/\bmailto:\s*/gi, '');
          changed = true;
        }

        const textHasEntities = /&(?:#\s*\d+|#x[0-9a-f]+|[a-z]+);?|822[01];?|821[67];?/i.test(currentSentenceText);
        if (textHasEntities) {
          currentSentenceText = decodeHtmlAndNormalizeQuotes(currentSentenceText);
          changed = true;
        }

        const textHasPunctuation = /[.?!]/.test(currentSentenceText);
        const wordsMissingPunctuation =
          !s.words ||
          s.words.length === 0 ||
          textHasEntities ||
          textHasMailto ||
          (textHasPunctuation && !s.words.some((w) => /[.?!]/.test(w.word)));

        if (wordsMissingPunctuation && currentSentenceText) {
          changed = true;
          return {
            ...s,
            text: currentSentenceText,
            words: tokenizeWords(currentSentenceText),
          };
        }
        return {
          ...s,
          text: currentSentenceText,
        };
      }),
    };
  });

  if (changed) {
    const updatedDoc = { ...doc, paragraphs: updatedParagraphs };
    saveArticleToStorage(updatedDoc).catch(() => {});
    return updatedDoc;
  }
  return doc;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('favorite', 'favorite', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update an article in IndexedDB.
 */
export async function saveArticleToStorage(article: ArticleDocument): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(article);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falling back to localStorage for article saving', err);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const key = `vox_doc_${article.id}`;
        localStorage.setItem(key, JSON.stringify(article));
      } catch (e) {
        console.error('LocalStorage full or quota exceeded', e);
      }
    }
  }
}

/**
 * Get all saved articles from storage.
 */
export async function getAllArticlesFromStorage(): Promise<ArticleDocument[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const rawDocs: ArticleDocument[] = req.result || [];
        const docs = rawDocs.map(sanitizeStoredArticle);
        docs.sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt));
        resolve(docs);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read failed, checking localStorage fallback', err);
    const docs: ArticleDocument[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('vox_doc_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '');
          if (item?.id) docs.push(sanitizeStoredArticle(item));
        } catch {
          // ignore
        }
      }
    }
    docs.sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt));
    return docs;
  }
}

/**
 * Delete an article from storage.
 */
export async function deleteArticleFromStorage(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.removeItem(`vox_doc_${id}`);
  }
}

/**
 * Update reading progress (lastReadSentenceIndex).
 */
export async function updateArticleProgress(id: string, sentenceIndex: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const doc: ArticleDocument = getReq.result;
      if (doc) {
        doc.lastReadSentenceIndex = sentenceIndex;
        doc.lastOpenedAt = Date.now();
        store.put(doc);
      }
    };
  } catch {
    const key = `vox_doc_${id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const doc = JSON.parse(raw);
        doc.lastReadSentenceIndex = sentenceIndex;
        doc.lastOpenedAt = Date.now();
        localStorage.setItem(key, JSON.stringify(doc));
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Toggle favorite status.
 */
export async function toggleArticleFavorite(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const doc: ArticleDocument = getReq.result;
        if (doc) {
          doc.favorite = !doc.favorite;
          store.put(doc);
          resolve(doc.favorite);
        } else {
          resolve(false);
        }
      };
      getReq.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export function saveActiveDocId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_DOC_ID_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_DOC_ID_KEY);
  }
}

export function getActiveDocId(): string | null {
  return localStorage.getItem(ACTIVE_DOC_ID_KEY);
}

export function saveSettings<T>(key: string, settings: T) {
  localStorage.setItem(key, JSON.stringify(settings));
}

export function getSettings<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export { SETTINGS_KEY, DISPLAY_KEY };
