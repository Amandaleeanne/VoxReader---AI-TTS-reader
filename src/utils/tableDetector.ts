import { latexToSpokenText } from './mathUtils';

export interface DetectedTable {
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
  title?: string;
  isTruthTable?: boolean;
  imageUrl?: string;
}

export interface PdfLineItem {
  str: string;
  x: number;
  width: number;
  y?: number;
  fontSize?: number;
  isBold?: boolean;
}

export interface PdfLineLike {
  text: string;
  items?: PdfLineItem[];
  fontSize?: number;
  posY?: number;
  minX?: number;
  maxX?: number;
}

export interface DetectedPdfFigureOrTable {
  lineIndexStart: number;
  lineIndexEnd: number;
  captionLineIndex: number;
  type: 'figure' | 'table';
  figureNumber?: string;
  captionText: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  tableData?: DetectedTable;
}

// Set of recognized truth-value tokens in standard logic, digital circuits, and discrete mathematics
const TRUTH_VALUE_MAP: Record<string, string> = {
  t: 'T',
  f: 'F',
  true: 'True',
  false: 'False',
  '1': '1',
  '0': '0',
  v: 'V', // Vrai / Verdadero
  u: 'U', // Unknown / Undefined in ternary logic
  h: 'H', // High
  l: 'L', // Low
  '⊤': 'T',
  '⊥': 'F',
  '✓': 'T',
  '✗': 'F',
};

/**
 * Checks whether a single string or cell represents a boolean truth value.
 */
export function isTruthValueToken(token: string): boolean {
  if (!token) return false;
  const clean = token
    .trim()
    .replace(/^[$`"']+|[$`"']+$/g, '')
    .replace(/\\text\{([^{}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]+)\}/g, '$1')
    .trim()
    .toLowerCase();
  return Boolean(TRUTH_VALUE_MAP[clean]);
}

/**
 * Normalizes a truth value token for clean display.
 */
export function normalizeTruthValue(token: string): string {
  const clean = token
    .trim()
    .replace(/^[$`"']+|[$`"']+$/g, '')
    .trim()
    .toLowerCase();
  return TRUTH_VALUE_MAP[clean] || token.trim();
}

/**
 * Checks whether a cell or header string looks like a propositional logic formula or variable.
 */
export function isLogicFormula(str: string): boolean {
  const s = str.trim();
  if (/^[pqrstuvwxyzabc]$/i.test(s)) return true;
  if (/^[pqrstuvwxyzabc]\d*$/i.test(s)) return true;
  if (/[∧∨¬~→↔⊕⇒⇔≡!&|+\^]/.test(s)) return true;
  if (/\b(and|or|not|xor|nand|nor|implies|iff)\b/i.test(s)) return true;
  if (/\\(land|lor|neg|sim|to|rightarrow|implies|leftrightarrow|iff|oplus)/i.test(s)) return true;
  return false;
}

/**
 * Splits a table line string into cell values by pipe, multi-space, or tab.
 */
export function splitLineIntoCells(lineText: string, expectedColCount?: number): string[] {
  const trimmed = lineText.trim();
  if (!trimmed) return [];

  // 1. Pipe-delimited: | P | Q | P ∧ Q |
  if (trimmed.includes('|')) {
    let clean = trimmed;
    if (clean.startsWith('|')) clean = clean.slice(1);
    if (clean.endsWith('|')) clean = clean.slice(0, -1);
    return clean.split('|').map((c) => c.trim());
  }

  // 2. Tab-delimited
  if (trimmed.includes('\t')) {
    return trimmed.split(/\t+/).map((c) => c.trim()).filter((c) => c.length > 0);
  }

  // 3. If all tokens when split by any whitespace are truth values (e.g., "0 0 0 0" or "T T T")
  const spaceTokens = trimmed.split(/\s+/).filter((c) => c.length > 0);
  if (spaceTokens.length >= 2 && spaceTokens.every((t) => isTruthValueToken(t))) {
    return spaceTokens;
  }

  // 4. Multi-space delimited (2 or more spaces between columns)
  const multiSpaceParts = trimmed.split(/\s{2,}/).map((c) => c.trim()).filter((c) => c.length > 0);
  if (multiSpaceParts.length >= 2) {
    if (!expectedColCount || multiSpaceParts.length === expectedColCount) {
      return multiSpaceParts;
    }
  }

  // 5. If an expected column count is known:
  if (expectedColCount && expectedColCount >= 2) {
    if (spaceTokens.length === expectedColCount) {
      return spaceTokens;
    }
    if (spaceTokens.length > expectedColCount) {
      const result: string[] = [];
      const prefixCount = expectedColCount - 1;
      for (let k = 0; k < prefixCount; k++) {
        result.push(spaceTokens[k]);
      }
      result.push(spaceTokens.slice(prefixCount).join(' '));
      return result;
    }
  }

  return multiSpaceParts.length > 0 ? multiSpaceParts : spaceTokens;
}

/**
 * Checks whether an array of cell strings is predominantly truth values.
 */
export function isTruthRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const truthCount = cells.filter((c) => isTruthValueToken(c)).length;
  return truthCount >= Math.ceil(cells.length * 0.75);
}

/**
 * Generates sensible variable headers for a truth table (e.g. p, q, Result or A, B, Output).
 */
export function generateDefaultTruthHeaders(colCount: number): string[] {
  if (colCount === 2) return ['p', '¬p'];
  if (colCount === 3) return ['p', 'q', 'p ∧ q'];
  if (colCount === 4) return ['x', 'y', 'z', 'f(x, y, z)'];

  const vars = ['p', 'q', 'r', 's', 't', 'u', 'v'];
  const res: string[] = [];
  for (let i = 0; i < colCount - 1 && i < vars.length; i++) {
    res.push(vars[i]);
  }
  while (res.length < colCount - 1) {
    res.push(`x${res.length + 1}`);
  }
  res.push('Result');
  return res;
}

/**
 * Attempts to parse structured truth table headers and rows from figure content lines.
 */
export function parseTruthTableFromFigureLines(
  lines: PdfLineLike[],
  captionText?: string
): DetectedTable | null {
  const rawTexts = lines.map((l) => l.text);

  // 1. Check for pure binary / boolean truth table rows (e.g. Figure 1.1)
  const binaryRows: string[][] = [];
  let headerRow: string[] | null = null;
  let firstRowIdx = -1;

  for (let idx = 0; idx < rawTexts.length; idx++) {
    const l = rawTexts[idx];
    const tokens = l.trim().split(/\s+/);
    if (tokens.length >= 2 && tokens.every((t) => /^[01TF]$/i.test(t))) {
      if (firstRowIdx === -1) {
        firstRowIdx = idx;
        if (idx > 0) {
          const hLine = rawTexts[idx - 1].trim();
          const hTokens = hLine.split(/\s{2,}|\s+/);
          if (hTokens.length === tokens.length) {
            headerRow = hTokens;
          } else if (hTokens.length > tokens.length) {
            headerRow = hTokens.slice(0, tokens.length - 1);
            headerRow.push(hTokens.slice(tokens.length - 1).join(' '));
          }
        }
      }
      binaryRows.push(tokens.map((t) => normalizeTruthValue(t)));
    }
  }

  if (binaryRows.length >= 2) {
    if (!headerRow || headerRow.length !== binaryRows[0].length) {
      if (binaryRows[0].length === 4) headerRow = ['x', 'y', 'z', 'f(x, y, z)'];
      else if (binaryRows[0].length === 3) headerRow = ['x', 'y', 'f(x, y)'];
      else headerRow = generateDefaultTruthHeaders(binaryRows[0].length);
    }
    return {
      headers: headerRow,
      rows: binaryRows,
      alignments: headerRow.map(() => 'center' as const),
      isTruthTable: true,
      title: captionText,
    };
  }

  // 2. Check for Boolean functions table with 4 valuations (e.g. Figure 1.2)
  const funcRows: string[][] = [];
  for (const l of rawTexts) {
    const m = l.match(/^(.*?)\s+([01TF])\s+([01TF])\s+([01TF])\s+([01TF])$/i);
    if (m) {
      const leftParts = m[1].trim().split(/\s{2,}/);
      const name = leftParts[0] || m[1].trim();
      const formula = leftParts.slice(1).join(' ') || '';
      funcRows.push([
        name,
        formula,
        normalizeTruthValue(m[2]),
        normalizeTruthValue(m[3]),
        normalizeTruthValue(m[4]),
        normalizeTruthValue(m[5]),
      ]);
    }
  }

  if (funcRows.length >= 3) {
    return {
      headers: ['Function', 'Formula', '0 0', '0 1', '1 0', '1 1'],
      rows: funcRows,
      alignments: ['left', 'left', 'center', 'center', 'center', 'center'],
      isTruthTable: true,
      title: captionText,
    };
  }

  // 3. Check for Mux / Demux style truth table rows (e.g. Figure 1.8, 1.9, 1.10, 1.11)
  const circuitRows: string[][] = [];
  for (const l of rawTexts) {
    const m = l.match(/^([01TF])\s+([01TF])\s+(.*)$/);
    if (m) {
      const colTokens = l.trim().split(/\s+/);
      if (colTokens.length >= 3 && colTokens.some((t) => /^(in|[a-h]|out|0|1)$/i.test(t))) {
        circuitRows.push(colTokens);
      }
    }
  }

  if (circuitRows.length >= 2) {
    const colCount = circuitRows[0].length;
    let headers: string[] = [];
    if (colCount === 3) headers = ['sel[1]', 'sel[0]', 'out'];
    else if (colCount === 4) headers = ['a', 'b', 'sel', 'out'];
    else if (colCount === 6) headers = ['sel[1]', 'sel[0]', 'a', 'b', 'c', 'd'];
    else {
      headers = Array.from({ length: colCount }, (_, k) => `Col ${k + 1}`);
    }
    return {
      headers,
      rows: circuitRows,
      alignments: headers.map(() => 'center' as const),
      isTruthTable: true,
      title: captionText,
    };
  }

  return null;
}

/**
 * Detects all Figure and Table blocks on a PDF page by scanning for captions and calculating bounds.
 */
export function detectPdfFiguresAndTables(lines: PdfLineLike[]): DetectedPdfFigureOrTable[] {
  const results: DetectedPdfFigureOrTable[] = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const match = l.text.match(/^(Figure|Table)\s+(\d+(\.\d+)?)\s*[:.—-]?\s*(.*)$/i);
    if (!match) continue;

    const figTypeRaw = match[1].toLowerCase();
    const figNum = match[2];
    const captionBase = l.text.trim();
    let captionText = captionBase;

    // Check if caption continues on next line (e.g. "Figure 1.8 Multiplexor..." followed by "on the left.")
    let captionEndIndex = i;
    if (
      !/[.?!]$/.test(captionBase) &&
      i + 1 < lines.length &&
      /^[a-z]/.test(lines[i + 1].text.trim())
    ) {
      captionEndIndex = i + 1;
      captionText += ` ${lines[i + 1].text.trim()}`;
    }

    // Determine the content lines preceding this caption
    let startIdx = i - 1;
    while (startIdx >= 0) {
      const prevL = lines[startIdx];
      // Stop if reaching top running header (usually Y >= 595 in standard book format)
      if (prevL.posY && prevL.posY >= 595) break;

      // Stop if previous line was another figure caption
      if (/^(Figure|Table)\s+\d+/i.test(prevL.text)) break;

      // Stop if previous line ended with period / terminal punctuation and has large vertical gap > 20
      const gap = Math.abs((lines[startIdx + 1]?.posY || 0) - (prevL.posY || 0));
      if (
        gap > 20 &&
        /[.?!]["'”’)]?$/.test(prevL.text.trim()) &&
        prevL.text.length > 35 &&
        startIdx < i - 1
      ) {
        break;
      }
      startIdx--;
    }
    startIdx = Math.max(0, startIdx + 1);

    const contentLines = lines.slice(startIdx, i);
    const allLinesInBlock = [...contentLines, ...lines.slice(i, captionEndIndex + 1)];

    // Compute bounding box coordinates for canvas snapshot
    const minX = Math.min(...allLinesInBlock.map((ln) => ln.minX || 80));
    const maxX = Math.max(...allLinesInBlock.map((ln) => ln.maxX || 500));
    const minY = Math.min(...allLinesInBlock.map((ln) => ln.posY || 200));
    const maxY = Math.max(...allLinesInBlock.map((ln) => ln.posY || 580));

    // Try parsing structured truth table data from content lines
    const parsedTable = parseTruthTableFromFigureLines(contentLines, captionText);

    const isTable = Boolean(parsedTable) || figTypeRaw === 'table';

    results.push({
      lineIndexStart: startIdx,
      lineIndexEnd: captionEndIndex + 1, // inclusive of caption line(s)
      captionLineIndex: i,
      type: isTable ? 'table' : 'figure',
      figureNumber: `${match[1]} ${figNum}`,
      captionText,
      minX,
      maxX,
      minY,
      maxY,
      tableData: parsedTable || undefined,
    });
  }

  return results;
}

/**
 * Backwards compatibility alias for detectTablesInPdfLines.
 */
export function detectTablesInPdfLines(lines: PdfLineLike[]): DetectedPdfFigureOrTable[] {
  return detectPdfFiguresAndTables(lines).filter((item) => item.type === 'table');
}

/**
 * Renders the PDF page to a canvas in the browser and crops exact high-res PNG image
 * snapshots for every detected figure and table on that page.
 */
export async function capturePdfFigureCrops(
  page: any,
  figures: DetectedPdfFigureOrTable[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (typeof window === 'undefined' || !page || figures.length === 0) {
    return result;
  }

  try {
    const scale = 2.0; // 2x retina sharpness for diagrams, math, and tables
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return result;

    await page.render({ canvasContext: ctx, viewport }).promise;

    for (const fig of figures) {
      // PDF viewport coordinate conversion:
      // (minX, maxY) -> (vx1, vy1) [top-left]
      // (maxX, minY) -> (vx2, vy2) [bottom-right]
      const [vx1, vy1] = viewport.convertToViewportPoint(fig.minX, fig.maxY);
      const [vx2, vy2] = viewport.convertToViewportPoint(fig.maxX, fig.minY);

      // Add comfortable padding around the figure box
      const padX = 14 * scale;
      const padY = 12 * scale;

      const left = Math.max(0, Math.floor(Math.min(vx1, vx2) - padX));
      const top = Math.max(0, Math.floor(Math.min(vy1, vy2) - padY));
      const right = Math.min(canvas.width, Math.ceil(Math.max(vx1, vx2) + padX));
      const bottom = Math.min(canvas.height, Math.ceil(Math.max(vy1, vy2) + padY));

      const w = right - left;
      const h = bottom - top;

      if (w > 30 && h > 30) {
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = w;
        cropCanvas.height = h;
        const cropCtx = cropCanvas.getContext('2d');
        if (cropCtx) {
          cropCtx.drawImage(canvas, left, top, w, h, 0, 0, w, h);
          const dataUrl = cropCanvas.toDataURL('image/png');
          result.set(fig.captionLineIndex, dataUrl);
        }
      }
    }
  } catch (err) {
    console.warn('PDF canvas figure cropping failed:', err);
  }

  return result;
}

/**
 * Attempts to parse a contiguous block of text lines into a Truth Table (for plain text / markdown).
 */
export function detectTruthTableFromLines(
  lines: string[],
  startIndex: number = 0
): { table: DetectedTable; consumedCount: number } | null {
  if (startIndex >= lines.length) return null;

  let firstRowIdx = -1;
  let detectedColCount = -1;

  for (let i = startIndex; i < lines.length && i < startIndex + 6; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cells = splitLineIntoCells(rawLine);
    if (isTruthRow(cells)) {
      firstRowIdx = i;
      detectedColCount = cells.length;
      break;
    }
  }

  if (firstRowIdx === -1 || detectedColCount < 2) return null;

  const dataRows: string[][] = [];
  let currIdx = firstRowIdx;

  while (currIdx < lines.length) {
    const rawLine = lines[currIdx].trim();
    if (!rawLine) break;

    // Skip divider row if present
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(rawLine)) {
      currIdx++;
      continue;
    }

    const cells = splitLineIntoCells(rawLine, detectedColCount);
    if (isTruthRow(cells)) {
      const row = cells.slice(0, detectedColCount).map((c) => normalizeTruthValue(c));
      while (row.length < detectedColCount) row.push('?');
      dataRows.push(row);
      currIdx++;
    } else {
      break;
    }
  }

  if (dataRows.length < 2) return null;

  let headerRowIdx = firstRowIdx - 1;
  let headers: string[] = [];
  let tableTitle: string | undefined;

  if (
    headerRowIdx >= startIndex &&
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(lines[headerRowIdx].trim())
  ) {
    headerRowIdx--;
  }

  if (headerRowIdx >= startIndex) {
    const candidateHeaderLine = lines[headerRowIdx].trim();
    if (candidateHeaderLine.length > 0 && !isTruthRow(splitLineIntoCells(candidateHeaderLine))) {
      const candidateHeaders = splitLineIntoCells(candidateHeaderLine, detectedColCount);
      if (candidateHeaders.length === detectedColCount) {
        headers = candidateHeaders;
      } else if (candidateHeaders.length > 0) {
        if (candidateHeaders.length > detectedColCount) {
          headers = candidateHeaders.slice(0, detectedColCount);
        } else {
          headers = candidateHeaders;
          while (headers.length < detectedColCount) {
            headers.push(`Col ${headers.length + 1}`);
          }
        }
      }

      if (headerRowIdx - 1 >= startIndex) {
        const potentialTitle = lines[headerRowIdx - 1].trim();
        if (/truth\s*table|table\s*\d+/i.test(potentialTitle) && potentialTitle.length < 100) {
          tableTitle = potentialTitle;
        }
      }
    }
  }

  if (headers.length !== detectedColCount) {
    headers = generateDefaultTruthHeaders(detectedColCount);
  }

  const alignments = headers.map(() => 'center' as const);

  return {
    table: {
      headers,
      rows: dataRows,
      alignments,
      title: tableTitle,
      isTruthTable: true,
    },
    consumedCount: currIdx - startIndex,
  };
}

/**
 * Detects general markdown pipe tables.
 */
export function detectGeneralTableFromLines(
  lines: string[],
  startIndex: number = 0
): { table: DetectedTable; consumedCount: number } | null {
  if (startIndex >= lines.length) return null;

  const firstLine = lines[startIndex].trim();
  if (!firstLine || !firstLine.includes('|')) return null;

  const headerCells = splitLineIntoCells(firstLine);
  if (headerCells.length < 2) return null;

  let idx = startIndex + 1;
  let alignments: ('left' | 'center' | 'right')[] = headerCells.map(() => 'left');

  // Check for delimiter row |:---|:---:|---:|
  if (idx < lines.length) {
    const delMatch = lines[idx].trim();
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(delMatch)) {
      const delParts = delMatch.replace(/^\||\|$/g, '').split('|');
      alignments = delParts.map((p) => {
        const t = p.trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        return 'left';
      });
      idx++;
    }
  }

  const rows: string[][] = [];
  while (idx < lines.length) {
    const rowLine = lines[idx].trim();
    if (!rowLine || !rowLine.includes('|')) break;
    const cells = splitLineIntoCells(rowLine, headerCells.length);
    if (cells.length > 0) {
      while (cells.length < headerCells.length) cells.push('');
      rows.push(cells.slice(0, headerCells.length));
    }
    idx++;
  }

  if (rows.length >= 1) {
    return {
      table: {
        headers: headerCells,
        rows,
        alignments,
        isTruthTable: false,
      },
      consumedCount: idx - startIndex,
    };
  }

  return null;
}

/**
 * Analyzes a paragraph's rawText to see if it represents a mashed Truth Table.
 */
export function detectMashedTruthTableInParagraphText(text: string): {
  title?: string;
  headers: string[];
  rows: string[][];
  alignments: ('left' | 'center' | 'right')[];
  textBefore?: string;
  textAfter?: string;
} | null {
  if (!text) return null;
  const trimmed = text.trim();

  // If text contains newlines, try lines detection first
  if (trimmed.includes('\n')) {
    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    const truthRes = detectTruthTableFromLines(lines);
    if (truthRes && truthRes.table.rows.length >= 2) {
      return {
        headers: truthRes.table.headers,
        rows: truthRes.table.rows,
        alignments: truthRes.table.alignments,
        title: truthRes.table.title,
      };
    }
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length < 6) return null;

  let truthStartIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (isTruthValueToken(tokens[i])) {
      let nonTruthCount = 0;
      for (let j = i; j < tokens.length; j++) {
        if (!isTruthValueToken(tokens[j])) nonTruthCount++;
      }
      if (nonTruthCount <= 1 && tokens.length - i >= 4) {
        truthStartIdx = i;
        break;
      }
    }
  }

  if (truthStartIdx === -1) return null;

  const truthTokens = tokens.slice(truthStartIdx).map((t) => normalizeTruthValue(t));
  const numTruthTokens = truthTokens.length;
  if (numTruthTokens < 4) return null;

  const candidateTokensBefore = tokens.slice(0, truthStartIdx);

  let bestColCount = -1;
  let bestRowCount = -1;

  for (const C of [4, 3, 2, 5, 6, 7, 8]) {
    if (numTruthTokens % C === 0) {
      const R = numTruthTokens / C;
      if (R === 2 || R === 4 || R === 8 || R === 16 || (R >= 2 && R <= 32)) {
        bestColCount = C;
        bestRowCount = R;
        break;
      }
    }
  }

  if (bestColCount === -1 || bestRowCount === -1) return null;

  const rows: string[][] = [];
  for (let r = 0; r < bestRowCount; r++) {
    rows.push(truthTokens.slice(r * bestColCount, (r + 1) * bestColCount));
  }

  let headers: string[] = [];
  let textBefore: string | undefined;

  if (candidateTokensBefore.length >= bestColCount) {
    const prefixCount = bestColCount - 1;
    const titleMatch = candidateTokensBefore.findIndex((t) =>
      /truth\s*table|table\s*\d+|figure\s*\d+/i.test(t)
    );
    let formulaStart = 0;
    if (titleMatch !== -1) {
      formulaStart = titleMatch + 1;
      while (
        formulaStart < candidateTokensBefore.length &&
        /^(for|of|:|the)$/i.test(candidateTokensBefore[formulaStart])
      ) {
        formulaStart++;
      }
    }

    const headerCandidates = candidateTokensBefore.slice(formulaStart);
    if (headerCandidates.length >= bestColCount) {
      if (headerCandidates.length === bestColCount) {
        headers = headerCandidates;
      } else {
        headers = headerCandidates.slice(0, prefixCount);
        headers.push(headerCandidates.slice(prefixCount).join(' '));
      }
      if (formulaStart > 0) {
        textBefore = candidateTokensBefore.slice(0, formulaStart).join(' ');
      }
    } else {
      headers = generateDefaultTruthHeaders(bestColCount);
      textBefore = candidateTokensBefore.join(' ');
    }
  } else {
    headers = generateDefaultTruthHeaders(bestColCount);
    if (candidateTokensBefore.length > 0) {
      textBefore = candidateTokensBefore.join(' ');
    }
  }

  const alignments = headers.map(() => 'center' as const);

  return {
    headers,
    rows,
    alignments,
    textBefore,
  };
}

/**
 * Builds readable speech text for a truth table row or full table.
 */
export function formatTruthTableRowSpeech(row: string[], headers: string[], rowIndex: number): string {
  const parts = row.map((cell, cIdx) => {
    const h = headers[cIdx] ? `${headers[cIdx]}: ` : '';
    let valSpoken = cell;
    if (/^t$/i.test(cell) || cell === '1') valSpoken = 'True';
    else if (/^f$/i.test(cell) || cell === '0') valSpoken = 'False';
    return `${latexToSpokenText(h)}${latexToSpokenText(valSpoken)}`;
  });
  return `Row ${rowIndex + 1}. ${parts.join(', ')}`;
}
