import ExcelJS from 'exceljs';
import * as pdfMakeModule from 'pdfmake/build/pdfmake';
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import * as XLSX from 'xlsx';

// Initialize pdfmake virtual filesystem (Roboto TTF with full Cyrillic + Latin Extended support)
const pdfMake: any = (pdfMakeModule as any).default ?? pdfMakeModule;
const rawVfs: any =
  (pdfFontsModule as any).default ??
  (pdfFontsModule as any).pdfMake?.vfs ??
  pdfFontsModule;

let vfsInitialized = false;
function ensurePdfMakeFonts(): void {
  if (vfsInitialized) return;
  if (typeof pdfMake.addVirtualFileSystem === 'function' && rawVfs) {
    pdfMake.addVirtualFileSystem(rawVfs);
  } else if (rawVfs) {
    pdfMake.vfs = rawVfs;
  }
  vfsInitialized = true;
}

interface NormalizedCell {
  text: string;
  colSpan: number;
  rowSpan: number;
  isCovered: boolean;
  wrapText: boolean;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  fontSize: number;
  color?: string;
  fillColor?: string;
  alignment: 'left' | 'center' | 'right';
  borders: [boolean, boolean, boolean, boolean]; // [left, top, right, bottom]
  borderColor?: string;
}

interface NormalizedSheet {
  name: string;
  orientation: 'portrait' | 'landscape';
  explicitOrientation: boolean;
  fitToHeightOne: boolean;
  colWidthsChars: number[];
  rows: NormalizedCell[][];
}

function argbToHex(argb?: string): string | undefined {
  if (!argb || typeof argb !== 'string') return undefined;
  const clean = argb.replace(/^#/, '').trim();
  if (clean.length === 8) {
    return `#${clean.slice(2).toLowerCase()}`;
  }
  if (clean.length === 6) {
    return `#${clean.toLowerCase()}`;
  }
  return undefined;
}

function formatDateValue(date: Date, numFmt?: string): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  if (numFmt && /yy-mm-dd/i.test(numFmt)) {
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${dd}.${mm}.${yyyy}`;
}

function formatNumberWithNumFmt(val: number, numFmt?: string): string {
  if (!Number.isFinite(val)) return String(val);
  if (numFmt && /%/.test(numFmt)) {
    return `${(val * 100).toFixed(0)}%`;
  }

  let decimals = 0;
  let useGrouping = false;
  if (numFmt) {
    const cleanFmt = numFmt.split(';')[0].replace(/"[^"]*"/g, '');
    if (cleanFmt.includes(',') || cleanFmt.includes(' ')) {
      useGrouping = true;
    }
    const dotMatch = cleanFmt.match(/\.([0#]+)/);
    if (dotMatch) {
      decimals = Math.min(6, dotMatch[1].length);
    }
  } else if (!Number.isInteger(val)) {
    decimals = Math.min(4, (val.toString().split('.')[1] ?? '').length);
  }

  return new Intl.NumberFormat('en-US', {
    useGrouping,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

function extractExcelJsCellText(cell: ExcelJS.Cell): { text: string; isNumeric: boolean } {
  const val = cell.value;
  if (val === null || val === undefined) {
    return { text: '', isNumeric: false };
  }

  if (typeof val === 'number') {
    return { text: formatNumberWithNumFmt(val, cell.numFmt), isNumeric: true };
  }

  if (typeof val === 'boolean') {
    return { text: val ? 'TRUE' : 'FALSE', isNumeric: false };
  }

  if (val instanceof Date) {
    return { text: formatDateValue(val, cell.numFmt), isNumeric: false };
  }

  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return {
        text: val.richText.map((part) => part.text ?? '').join(''),
        isNumeric: false,
      };
    }

    if ('formula' in val || 'sharedFormula' in val) {
      const result = (val as ExcelJS.CellFormulaValue).result;
      if (result === null || result === undefined) return { text: '', isNumeric: false };
      if (typeof result === 'number') {
        return { text: formatNumberWithNumFmt(result, cell.numFmt), isNumeric: true };
      }
      if (result instanceof Date) {
        return { text: formatDateValue(result, cell.numFmt), isNumeric: false };
      }
      if (typeof result === 'object' && 'error' in result) {
        return { text: String(result.error), isNumeric: false };
      }
      return { text: String(result), isNumeric: false };
    }

    if ('text' in val) {
      return { text: String((val as ExcelJS.CellHyperlinkValue).text ?? ''), isNumeric: false };
    }

    if ('error' in val) {
      return { text: String((val as ExcelJS.CellErrorValue).error), isNumeric: false };
    }
  }

  try {
    return { text: cell.text ?? String(val), isNumeric: false };
  } catch {
    return { text: String(val), isNumeric: false };
  }
}

function parseMergeRanges(
  merges: string[],
): {
  origins: Map<string, { rowSpan: number; colSpan: number }>;
  covered: Set<string>;
} {
  const origins = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Set<string>();

  for (const rangeStr of merges) {
    const decoded = XLSX.utils.decode_range(rangeStr);
    // ExcelJS uses 1-based row/col indices; XLSX.utils.decode_range returns 0-based
    const sr = decoded.s.r + 1;
    const sc = decoded.s.c + 1;
    const er = decoded.e.r + 1;
    const ec = decoded.e.c + 1;

    origins.set(`${sr}:${sc}`, {
      rowSpan: er - sr + 1,
      colSpan: ec - sc + 1,
    });

    for (let r = sr; r <= er; r++) {
      for (let c = sc; c <= ec; c++) {
        if (r !== sr || c !== sc) {
          covered.add(`${r}:${c}`);
        }
      }
    }
  }

  return { origins, covered };
}

/**
 * Emulates Excel's horizontal overflow: when an unmerged, left-aligned cell
 * does not have wrapText enabled and its text exceeds the column width, it flows
 * across adjacent empty cells to the right instead of wrapping into multiple lines.
 */
function expandHorizontalOverflow(rows: NormalizedCell[][], colWidthsChars: number[]): void {
  const numCols = colWidthsChars.length;

  for (const row of rows) {
    for (let c = 0; c < numCols; c++) {
      const cell = row[c];
      if (
        !cell ||
        cell.isCovered ||
        cell.colSpan > 1 ||
        cell.rowSpan > 1 ||
        cell.wrapText ||
        cell.alignment !== 'left' ||
        cell.borders[2]
      ) {
        continue;
      }

      const trimmed = cell.text.trim();
      if (!trimmed) continue;

      const lines = cell.text.split(/\r?\n/);
      const maxLineChars = Math.max(...lines.map((l) => l.length));
      const sizeFactor = (cell.fontSize / 9.5) * (cell.bold ? 1.08 : 1.0);
      const neededChars = maxLineChars * sizeFactor + 1.5;

      const currentColChars = colWidthsChars[c] ?? 9;
      if (neededChars <= currentColChars * 0.92) continue;

      let accumulatedChars = currentColChars;
      let span = 1;

      for (let k = c + 1; k < numCols; k++) {
        if (accumulatedChars >= neededChars) break;
        const next = row[k];
        if (
          !next ||
          next.isCovered ||
          next.colSpan > 1 ||
          next.rowSpan > 1 ||
          next.text.trim() !== '' ||
          Boolean(next.fillColor) ||
          next.borders[0] ||
          next.borders[1] !== cell.borders[1] ||
          next.borders[3] !== cell.borders[3]
        ) {
          break;
        }

        accumulatedChars += colWidthsChars[k] ?? 9;
        span++;
        next.isCovered = true;

        if (next.borders[2]) {
          cell.borders[2] = true;
          break;
        }
      }

      if (span > 1) {
        cell.colSpan = span;
      }
    }
  }
}

async function parseXlsxWithExcelJs(buffer: ArrayBuffer): Promise<NormalizedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets: NormalizedSheet[] = [];

  for (const ws of workbook.worksheets) {
    if (!ws || ws.state === 'veryHidden' || ws.state === 'hidden') continue;

    // Determine real non-empty bounds (accounting for values and borders)
    let minR = Number.MAX_SAFE_INTEGER;
    let minC = Number.MAX_SAFE_INTEGER;
    let maxR = 0;
    let maxC = 0;

    const rowLimit = Math.min(ws.rowCount || 0, 2000);
    const colLimit = Math.min(ws.columnCount || 0, 50);

    for (let r = 1; r <= rowLimit; r++) {
      const row = ws.getRow(r);
      if (row.hidden) continue;
      for (let c = 1; c <= colLimit; c++) {
        const col = ws.getColumn(c);
        if (col.hidden) continue;
        const cell = row.getCell(c);
        const { text } = extractExcelJsCellText(cell);
        const hasText = text.trim() !== '';
        const hasFill =
          cell.fill?.type === 'pattern' &&
          cell.fill.pattern !== 'none' &&
          Boolean(cell.fill.fgColor?.argb);
        const hasBorder = Boolean(
          cell.border?.top?.style ||
            cell.border?.bottom?.style ||
            cell.border?.left?.style ||
            cell.border?.right?.style,
        );

        if (hasText || hasFill || hasBorder) {
          if (r < minR) minR = r;
          if (c < minC) minC = c;
          if (r > maxR) maxR = r;
          if (c > maxC) maxC = c;
        }
      }
    }

    if (maxR < minR || maxC < minC) continue;

    const mergeList = ws.model?.merges ?? [];
    const { origins, covered } = parseMergeRanges(mergeList);

    // Ensure merge endpoints within active rows are included
    for (const rangeStr of mergeList) {
      const decoded = XLSX.utils.decode_range(rangeStr);
      const sr = decoded.s.r + 1;
      const sc = decoded.s.c + 1;
      const er = Math.min(decoded.e.r + 1, rowLimit);
      const ec = Math.min(decoded.e.c + 1, colLimit);
      if (sr <= maxR && sc <= maxC) {
        maxR = Math.max(maxR, er);
        maxC = Math.max(maxC, ec);
      }
    }

    // Track columns involved in merges so we don't break colSpan indices
    const mergedCols = new Set<number>();
    const mergedRows = new Set<number>();
    for (const rangeStr of mergeList) {
      const decoded = XLSX.utils.decode_range(rangeStr);
      for (let r = decoded.s.r + 1; r <= decoded.e.r + 1; r++) mergedRows.add(r);
      for (let c = decoded.s.c + 1; c <= decoded.e.c + 1; c++) mergedCols.add(c);
    }

    const keptCols: number[] = [];
    const colWidthsChars: number[] = [];
    let totalChars = 0;
    for (let c = minC; c <= maxC; c++) {
      const col = ws.getColumn(c);
      if (col.hidden && !mergedCols.has(c)) continue;
      keptCols.push(c);
      const w = col.hidden ? 0.5 : col?.width && col.width > 0 ? col.width : 9;
      colWidthsChars.push(w);
      totalChars += w;
    }

    if (keptCols.length === 0) continue;

    const explicitOrientationRaw = ws.pageSetup?.orientation;
    const explicitOrientation =
      explicitOrientationRaw === 'landscape' || explicitOrientationRaw === 'portrait';
    const orientation: 'portrait' | 'landscape' =
      explicitOrientationRaw === 'landscape'
        ? 'landscape'
        : explicitOrientationRaw === 'portrait'
          ? 'portrait'
          : totalChars > 92 || keptCols.length >= 7
            ? 'landscape'
            : 'portrait';

    const fitToHeightOne = Boolean(
      ws.pageSetup?.fitToPage &&
        (ws.pageSetup?.fitToHeight === 1 || ws.pageSetup?.fitToHeight === undefined),
    );

    const rows: NormalizedCell[][] = [];

    for (let r = minR; r <= maxR; r++) {
      const excelRow = ws.getRow(r);
      if (excelRow.hidden && !mergedRows.has(r)) continue;
      const rowCells: NormalizedCell[] = [];

      for (const c of keptCols) {
        const key = `${r}:${c}`;
        if (covered.has(key)) {
          rowCells.push({
            text: '',
            colSpan: 1,
            rowSpan: 1,
            isCovered: true,
            wrapText: false,
            bold: false,
            italic: false,
            underline: false,
            fontSize: 9,
            alignment: 'left',
            borders: [false, false, false, false],
          });
          continue;
        }

        const cell = excelRow.getCell(c);
        const merge = origins.get(key);
        const { text, isNumeric } = extractExcelJsCellText(cell);

        const font = cell.font ?? {};
        const align = cell.alignment ?? {};
        const border = cell.border ?? {};

        const borders: [boolean, boolean, boolean, boolean] = [
          Boolean(border.left?.style),
          Boolean(border.top?.style),
          Boolean(border.right?.style),
          Boolean(border.bottom?.style),
        ];

        // If merged cell spans right/bottom, check the far edge cell borders too
        if (merge) {
          if (merge.colSpan > 1) {
            const rightCell = excelRow.getCell(Math.min(maxC, c + merge.colSpan - 1));
            if (rightCell.border?.right?.style) borders[2] = true;
          }
          if (merge.rowSpan > 1) {
            const bottomCell = ws.getRow(Math.min(maxR, r + merge.rowSpan - 1)).getCell(c);
            if (bottomCell.border?.bottom?.style) borders[3] = true;
          }
        }

        let fillColor: string | undefined;
        if (cell.fill?.type === 'pattern' && cell.fill.pattern !== 'none') {
          const hex = argbToHex(cell.fill.fgColor?.argb);
          if (hex && hex !== '#000000') {
            fillColor = hex;
          }
        }

        const fontColor = argbToHex(font.color?.argb);
        const borderColor =
          argbToHex(border.top?.color?.argb) ??
          argbToHex(border.bottom?.color?.argb) ??
          argbToHex(border.left?.color?.argb) ??
          argbToHex(border.right?.color?.argb);

        const horizontal: 'left' | 'center' | 'right' =
          align.horizontal === 'center' || align.horizontal === 'centerContinuous'
            ? 'center'
            : align.horizontal === 'right'
              ? 'right'
              : align.horizontal === 'left'
                ? 'left'
                : isNumeric
                  ? 'right'
                  : 'left';

        rowCells.push({
          text,
          colSpan: merge?.colSpan ?? 1,
          rowSpan: merge?.rowSpan ?? 1,
          isCovered: false,
          wrapText: Boolean(align.wrapText),
          bold: Boolean(font.bold),
          italic: Boolean(font.italic),
          underline: Boolean(font.underline),
          fontSize: font.size && font.size > 5 ? font.size : 10,
          color: fontColor,
          fillColor,
          alignment: horizontal,
          borders,
          borderColor,
        });
      }

      rows.push(rowCells);
    }

    expandHorizontalOverflow(rows, colWidthsChars);

    sheets.push({
      name: ws.name,
      orientation,
      explicitOrientation,
      fitToHeightOne,
      colWidthsChars,
      rows,
    });
  }

  return sheets;
}

function decodeCsvString(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
  }
}

function parseLegacySpreadsheetWithSheetJs(bytes: Uint8Array, fileName: string): NormalizedSheet[] {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = isCsv
    ? XLSX.read(decodeCsvString(bytes), { type: 'string', cellDates: true })
    : XLSX.read(bytes, { type: 'array', cellDates: true });

  const sheets: NormalizedSheet[] = [];

  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name];
    if (!ws || !ws['!ref']) continue;

    const raw = XLSX.utils.decode_range(ws['!ref']);
    let minR = raw.e.r;
    let minC = raw.e.c;
    let maxR = -1;
    let maxC = -1;

    const limitR = Math.min(raw.e.r, raw.s.r + 2000);
    const limitC = Math.min(raw.e.c, raw.s.c + 50);

    for (let r = raw.s.r; r <= limitR; r++) {
      for (let c = raw.s.c; c <= limitC; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
          if (r < minR) minR = r;
          if (c < minC) minC = c;
          if (r > maxR) maxR = r;
          if (c > maxC) maxC = c;
        }
      }
    }

    if (maxR < minR || maxC < minC) continue;

    const merges = ws['!merges'] ?? [];
    const origins = new Map<string, { rowSpan: number; colSpan: number }>();
    const covered = new Set<string>();

    for (const m of merges) {
      if (m.s.r <= maxR && m.s.c <= maxC) {
        maxR = Math.max(maxR, Math.min(m.e.r, limitR));
        maxC = Math.max(maxC, Math.min(m.e.c, limitC));
      }
      const sr = Math.max(m.s.r, minR);
      const sc = Math.max(m.s.c, minC);
      const er = Math.min(m.e.r, limitR);
      const ec = Math.min(m.e.c, limitC);
      if (er >= sr && ec >= sc) {
        origins.set(`${sr}:${sc}`, { rowSpan: er - sr + 1, colSpan: ec - sc + 1 });
        for (let r = sr; r <= er; r++) {
          for (let c = sc; c <= ec; c++) {
            if (r !== sr || c !== sc) covered.add(`${r}:${c}`);
          }
        }
      }
    }

    const colsMeta = ws['!cols'] ?? [];
    const colWidthsChars: number[] = [];
    let totalChars = 0;
    for (let c = minC; c <= maxC; c++) {
      const w = colsMeta[c]?.wch && colsMeta[c]!.wch! > 0 ? colsMeta[c]!.wch! : 10;
      colWidthsChars.push(w);
      totalChars += w;
    }

    const orientation: 'portrait' | 'landscape' =
      totalChars > 92 || maxC - minC + 1 >= 7 ? 'landscape' : 'portrait';

    const rows: NormalizedCell[][] = [];
    for (let r = minR; r <= maxR; r++) {
      const rowCells: NormalizedCell[] = [];
      for (let c = minC; c <= maxC; c++) {
        const key = `${r}:${c}`;
        if (covered.has(key)) {
          rowCells.push({
            text: '',
            colSpan: 1,
            rowSpan: 1,
            isCovered: true,
            wrapText: false,
            bold: false,
            italic: false,
            underline: false,
            fontSize: 9,
            alignment: 'left',
            borders: [true, true, true, true],
          });
          continue;
        }

        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        const text = cell ? XLSX.utils.format_cell(cell) : '';
        const merge = origins.get(key);

        rowCells.push({
          text,
          colSpan: merge?.colSpan ?? 1,
          rowSpan: merge?.rowSpan ?? 1,
          isCovered: false,
          wrapText: false,
          bold: r === minR,
          italic: false,
          underline: false,
          fontSize: 9.5,
          fillColor: r === minR ? '#f8fafc' : undefined,
          alignment: cell?.t === 'n' ? 'right' : 'left',
          borders: [true, true, true, true],
          borderColor: '#cbd5e1',
        });
      }
      rows.push(rowCells);
    }

    sheets.push({
      name,
      orientation,
      explicitOrientation: false,
      fitToHeightOne: false,
      colWidthsChars,
      rows,
    });
  }

  return sheets;
}

const PAGE_MARGIN_PT = 14;

function buildSheetContent(
  sheet: NormalizedSheet,
  heightScale: number,
  showSheetHeader: boolean,
  isSubsequentSheet: boolean,
): Content[] {
  const numCols = Math.max(1, sheet.colWidthsChars.length);
  const pageWidthPt = sheet.orientation === 'landscape' ? 841.89 : 595.28;
  const usableWidthPt = pageWidthPt - PAGE_MARGIN_PT * 2;

  const padX = Math.max(1.2, Number((2.5 * Math.min(1, heightScale + 0.15)).toFixed(2)));
  const padY = Math.max(0.5, Number((2.0 * heightScale).toFixed(2)));
  const vLineW = 0.5;
  const hLineW = 0.5;

  // pdfmake adds (paddingLeft + paddingRight) per column + vLineWidth for vertical grid lines
  const tableChromeWidth = numCols * (padX * 2) + (numCols + 1) * vLineW + 2;
  const availableInnerWidthPt = Math.max(60, usableWidthPt - tableChromeWidth);

  const totalChars = sheet.colWidthsChars.reduce((sum, w) => sum + w, 0) || 1;
  const rawTotalPt = totalChars * 5.4;
  const widthFontScale = Math.min(1, Math.max(0.55, availableInnerWidthPt / Math.max(1, rawTotalPt)));
  const combinedFontScale = widthFontScale * heightScale;

  const minColW = Math.min(10, availableInnerWidthPt / numCols);
  const rawWidths = sheet.colWidthsChars.map((w) =>
    Math.max(minColW, (w / totalChars) * availableInnerWidthPt),
  );
  const rawSum = rawWidths.reduce((a, b) => a + b, 0) || 1;
  const widthAdjust = availableInnerWidthPt / rawSum;
  const widths = rawWidths.map((w) => Number((w * widthAdjust).toFixed(2)));

  const items: Content[] = [];

  if (showSheetHeader) {
    items.push({
      text: sheet.name,
      fontSize: Math.max(7, Number((9.5 * Math.min(1, heightScale + 0.15)).toFixed(1))),
      bold: true,
      color: '#0f172a',
      margin: [0, 0, 0, Math.max(1.5, Number((3 * heightScale).toFixed(1)))],
      ...(isSubsequentSheet
        ? { pageBreak: 'before' as const, pageOrientation: sheet.orientation }
        : {}),
    });
  } else if (isSubsequentSheet) {
    items.push({
      text: '',
      fontSize: 1,
      margin: [0, 0, 0, 0],
      pageBreak: 'before',
      pageOrientation: sheet.orientation,
    });
  }

  const lineHeight = Math.max(0.98, Number((1.0 + 0.12 * heightScale).toFixed(2)));
  const blankRowHeight = Math.max(3, Number((9 * heightScale).toFixed(1)));
  const minReadablePt = heightScale < 0.6 ? 4.8 : 5.6;

  const body: TableCell[][] = sheet.rows.map((row) =>
    row.map((cell): TableCell => {
      if (cell.isCovered) {
        return { text: '' };
      }

      const scaledSize = Math.max(minReadablePt, Number((cell.fontSize * combinedFontScale).toFixed(1)));
      const outCell: any = {
        text: cell.text,
        fontSize: scaledSize,
        lineHeight,
        bold: cell.bold,
        italics: cell.italic,
        decoration: cell.underline ? 'underline' : undefined,
        alignment: cell.alignment,
        border: cell.borders,
        margin: [0, 0, 0, 0],
      };

      if (cell.colSpan > 1) outCell.colSpan = cell.colSpan;
      if (cell.rowSpan > 1) outCell.rowSpan = cell.rowSpan;
      if (cell.color) outCell.color = cell.color;
      if (cell.fillColor) outCell.fillColor = cell.fillColor;
      if (cell.borderColor) {
        outCell.borderColor = [
          cell.borderColor,
          cell.borderColor,
          cell.borderColor,
          cell.borderColor,
        ];
      }

      return outCell;
    }),
  );

  items.push({
    table: {
      widths,
      body,
      dontBreakRows: true,
      heights: (rowIdx: number) =>
        sheet.rows[rowIdx]?.every((c) => !c.text.trim()) ? blankRowHeight : 'auto',
    },
    layout: {
      hLineWidth: () => hLineW,
      vLineWidth: () => vLineW,
      hLineColor: () => '#64748b',
      vLineColor: () => '#64748b',
      paddingLeft: () => padX,
      paddingRight: () => padX,
      paddingTop: () => padY,
      paddingBottom: () => padY,
    },
  });

  return items;
}

function countPdfPagesFromBuffer(pdfBytes: Uint8Array): number {
  const raw = new TextDecoder('latin1').decode(pdfBytes);
  const matches = raw.match(/\/Type\s*\/Page(?!s)\b/g);
  return matches ? matches.length : 1;
}

async function measureSheetPageCount(
  sheet: NormalizedSheet,
  heightScale: number,
  showSheetHeader: boolean,
): Promise<number> {
  const def: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: sheet.orientation,
    pageMargins: [PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#0f172a',
      lineHeight: 1.12,
    },
    content: buildSheetContent(sheet, heightScale, showSheetHeader, false),
  };

  const buf: Uint8Array = await pdfMake.createPdf(def).getBuffer();
  return countPdfPagesFromBuffer(buf);
}

async function solveOptimalScaleForSheet(
  sheet: NormalizedSheet,
  showSheetHeader: boolean,
): Promise<number> {
  const pagesAtFull = await measureSheetPageCount(sheet, 1.0, showSheetHeader);
  if (pagesAtFull <= 1) {
    return 1.0;
  }

  // Huge tables (> 105 rows) without explicit fitToHeight=1 should remain legible across pages
  if (!sheet.fitToHeightOne && sheet.rows.length > 105) {
    return 0.85;
  }

  const minScale = sheet.fitToHeightOne ? 0.34 : 0.44;
  const pagesAtMin = await measureSheetPageCount(sheet, minScale, showSheetHeader);

  if (pagesAtMin > 1) {
    // Even at minimum scale it spans multiple pages; if orientation was auto-picked as portrait,
    // check whether landscape fits onto 1 page cleanly
    if (!sheet.explicitOrientation && sheet.orientation === 'portrait') {
      const prevOrientation = sheet.orientation;
      sheet.orientation = 'landscape';
      const pagesLandscape = await measureSheetPageCount(sheet, minScale, showSheetHeader);
      if (pagesLandscape <= 1) {
        // Binary search landscape scale
        let lo = minScale;
        let hi = 1.0;
        let best = minScale;
        for (let step = 0; step < 5; step++) {
          const mid = Number(((lo + hi) / 2).toFixed(2));
          if (mid <= lo || mid >= hi) break;
          const p = await measureSheetPageCount(sheet, mid, showSheetHeader);
          if (p <= 1) {
            best = mid;
            lo = mid;
          } else {
            hi = mid;
          }
        }
        return best;
      }
      sheet.orientation = prevOrientation;
    }

    return sheet.fitToHeightOne ? minScale : 0.78;
  }

  // Binary search the largest scale between minScale and 1.0 that still fits on 1 page
  let lo = minScale;
  let hi = 1.0;
  let best = minScale;

  for (let step = 0; step < 5; step++) {
    const mid = Number(((lo + hi) / 2).toFixed(2));
    if (mid <= lo || mid >= hi) break;
    const pages = await measureSheetPageCount(sheet, mid, showSheetHeader);
    if (pages <= 1) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return best;
}

async function buildPdfMakeDefinition(sheets: NormalizedSheet[]): Promise<TDocumentDefinitions> {
  const showSheetHeaders = sheets.length > 1;
  const scales: number[] = [];

  for (const sheet of sheets) {
    scales.push(await solveOptimalScaleForSheet(sheet, showSheetHeaders));
  }

  const firstOrientation = sheets[0]?.orientation ?? 'portrait';
  const content: Content[] = [];

  sheets.forEach((sheet, sIdx) => {
    content.push(...buildSheetContent(sheet, scales[sIdx], showSheetHeaders, sIdx > 0));
  });

  return {
    pageSize: 'A4',
    pageOrientation: firstOrientation,
    pageMargins: [PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT, PAGE_MARGIN_PT],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#0f172a',
      lineHeight: 1.12,
    },
    content,
  };
}

/**
 * Step 1 of Excel -> PDF -> JPEG -> PDF:
 * Converts an Excel/CSV spreadsheet into an intermediate vector PDF (Uint8Array)
 * preserving column proportions, merged cells, borders, alignments, and fitting
 * each worksheet cleanly onto 1 page without right-edge clipping.
 */
export async function convertExcelToIntermediatePdf(file: File): Promise<Uint8Array> {
  ensurePdfMakeFonts();

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const isXlsxZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  let sheets: NormalizedSheet[] = [];
  if (isXlsxZip) {
    sheets = await parseXlsxWithExcelJs(buffer);
  } else {
    sheets = parseLegacySpreadsheetWithSheetJs(bytes, file.name);
  }

  if (sheets.length === 0) {
    throw new Error('Spreadsheet contains no data');
  }

  const docDefinition = await buildPdfMakeDefinition(sheets);
  const pdfDoc = pdfMake.createPdf(docDefinition);
  const outBuffer: Uint8Array = await pdfDoc.getBuffer();
  return outBuffer instanceof Uint8Array ? outBuffer : new Uint8Array(outBuffer);
}
