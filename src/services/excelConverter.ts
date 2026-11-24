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
      for (let c = 1; c <= colLimit; c++) {
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

    const colWidthsChars: number[] = [];
    let totalChars = 0;
    for (let c = minC; c <= maxC; c++) {
      const col = ws.getColumn(c);
      const w = col?.width && col.width > 0 ? col.width : 9;
      colWidthsChars.push(w);
      totalChars += w;
    }

    const explicitOrientation = ws.pageSetup?.orientation;
    const orientation: 'portrait' | 'landscape' =
      explicitOrientation === 'landscape'
        ? 'landscape'
        : explicitOrientation === 'portrait'
          ? 'portrait'
          : totalChars > 92 || maxC - minC + 1 >= 7
            ? 'landscape'
            : 'portrait';

    const rows: NormalizedCell[][] = [];

    for (let r = minR; r <= maxR; r++) {
      const excelRow = ws.getRow(r);
      const rowCells: NormalizedCell[] = [];

      for (let c = minC; c <= maxC; c++) {
        const key = `${r}:${c}`;
        if (covered.has(key)) {
          rowCells.push({
            text: '',
            colSpan: 1,
            rowSpan: 1,
            isCovered: true,
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

    sheets.push({
      name: ws.name,
      orientation,
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
      colWidthsChars,
      rows,
    });
  }

  return sheets;
}

function buildPdfMakeDefinition(sheets: NormalizedSheet[]): TDocumentDefinitions {
  const firstOrientation = sheets[0]?.orientation ?? 'portrait';
  const showSheetHeaders = sheets.length > 1;
  const content: Content[] = [];

  sheets.forEach((sheet, sIdx) => {
    const usableWidthPt = sheet.orientation === 'landscape' ? 801.89 : 555.28;
    const totalChars = sheet.colWidthsChars.reduce((sum, w) => sum + w, 0) || 1;
    // Approx 5.4 pt per Excel char unit; compute scale factor if sheet is wider than page
    const rawTotalPt = totalChars * 5.4;
    const fontScale = Math.min(1, Math.max(0.62, usableWidthPt / Math.max(1, rawTotalPt)));

    const widths = sheet.colWidthsChars.map((w) =>
      Math.max(12, Number(((w / totalChars) * usableWidthPt).toFixed(2))),
    );
    // Normalize widths sum to exactly usableWidthPt
    const sumW = widths.reduce((a, b) => a + b, 0);
    if (widths.length > 0 && Math.abs(sumW - usableWidthPt) > 0.5) {
      widths[0] = Number((widths[0] + (usableWidthPt - sumW)).toFixed(2));
    }

    if (showSheetHeaders) {
      content.push({
        text: sheet.name,
        fontSize: 10,
        bold: true,
        color: '#0f172a',
        margin: [0, sIdx === 0 ? 0 : 8, 0, 4],
        ...(sIdx > 0 ? { pageBreak: 'before' as const, pageOrientation: sheet.orientation } : {}),
      });
    } else if (sIdx > 0) {
      content.push({
        text: '',
        pageBreak: 'before',
        pageOrientation: sheet.orientation,
      });
    }

    const body: TableCell[][] = sheet.rows.map((row) =>
      row.map((cell): TableCell => {
        if (cell.isCovered) {
          return { text: '' };
        }

        const scaledSize = Math.max(6.2, Number((cell.fontSize * fontScale).toFixed(1)));
        const outCell: any = {
          text: cell.text,
          fontSize: scaledSize,
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
        if (cell.borderColor) outCell.borderColor = [
          cell.borderColor,
          cell.borderColor,
          cell.borderColor,
          cell.borderColor,
        ];

        return outCell;
      }),
    );

    content.push({
      table: {
        widths,
        body,
        dontBreakRows: true,
        heights: (rowIdx: number) =>
          sheet.rows[rowIdx]?.every((c) => !c.text.trim()) ? 11 : 'auto',
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#64748b',
        vLineColor: () => '#64748b',
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    });
  });

  return {
    pageSize: 'A4',
    pageOrientation: firstOrientation,
    pageMargins: [20, 20, 20, 20],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
      color: '#0f172a',
      lineHeight: 1.15,
    },
    content,
  };
}

/**
 * Step 1 of Excel -> PDF -> JPEG -> PDF:
 * Converts an Excel/CSV spreadsheet into an intermediate vector PDF (Uint8Array)
 * preserving column proportions, merged cells, borders, alignments, and typography.
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

  const docDefinition = buildPdfMakeDefinition(sheets);
  const pdfDoc = pdfMake.createPdf(docDefinition);
  const outBuffer: Uint8Array = await pdfDoc.getBuffer();
  return outBuffer instanceof Uint8Array ? outBuffer : new Uint8Array(outBuffer);
}
