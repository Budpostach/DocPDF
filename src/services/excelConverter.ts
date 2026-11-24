import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const A4_PORTRAIT_W = 794;
const A4_PORTRAIT_H = 1123;
const A4_LANDSCAPE_W = 1123;
const A4_LANDSCAPE_H = 794;
const PAGE_PADDING_X = 36;
const PAGE_PADDING_Y = 36;

interface MergeMeta {
  rowspan: number;
  colspan: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeCsvString(bytes: Uint8Array): string {
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
  }
}

function createIsolatedExcelIframe(): Promise<{
  iframe: HTMLIFrameElement;
  doc: Document;
}> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-12000px';
    iframe.style.top = '0';
    iframe.style.width = '1280px';
    iframe.style.height = '1400px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (doc) resolve({ iframe, doc });
    };

    iframe.srcdoc = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: "DM Sans", Arial, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .excel-page {
    background: #ffffff;
    padding: ${PAGE_PADDING_Y}px ${PAGE_PADDING_X}px;
    overflow: hidden;
  }
  .sheet-title {
    margin: 0 0 10px 0;
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 5px;
  }
  table.excel-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    font-variant-numeric: tabular-nums;
  }
  table.excel-grid td {
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    vertical-align: middle;
    word-break: break-word;
    color: #111827;
    line-height: 1.3;
  }
  table.excel-grid tr.header-like td {
    background: #f8fafc;
    font-weight: 600;
  }
  table.excel-grid td.num {
    text-align: right;
    white-space: nowrap;
  }
</style>
</head>
<body></body>
</html>`;

    document.body.appendChild(iframe);
  });
}

function getTrimmedBounds(
  sheet: XLSX.WorkSheet,
): { s: XLSX.CellAddress; e: XLSX.CellAddress } | null {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const raw = XLSX.utils.decode_range(ref);

  let maxR = -1;
  let maxC = -1;
  let minR = raw.e.r;
  let minC = raw.e.c;

  // Cap extreme empty formatted sheets safely
  const limitR = Math.min(raw.e.r, raw.s.r + 2500);
  const limitC = Math.min(raw.e.c, raw.s.c + 60);

  for (let r = raw.s.r; r <= limitR; r++) {
    for (let c = raw.s.c; c <= limitC; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      if (cell && cell.v !== undefined && cell.v !== null && String(cell.v).trim() !== '') {
        if (r < minR) minR = r;
        if (c < minC) minC = c;
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
    }
  }

  if (maxR < minR || maxC < minC) return null;

  // Include merge ends if they cover non-empty cells
  const merges = sheet['!merges'] ?? [];
  for (const m of merges) {
    if (m.s.r <= maxR && m.s.c <= maxC) {
      maxR = Math.max(maxR, Math.min(m.e.r, limitR));
      maxC = Math.max(maxC, Math.min(m.e.c, limitC));
    }
  }

  return { s: { r: minR, c: minC }, e: { r: maxR, c: maxC } };
}

function buildMergeMaps(
  merges: XLSX.Range[],
  bounds: { s: XLSX.CellAddress; e: XLSX.CellAddress },
): {
  origins: Map<string, MergeMeta>;
  covered: Set<string>;
} {
  const origins = new Map<string, MergeMeta>();
  const covered = new Set<string>();

  for (const m of merges) {
    if (m.e.r < bounds.s.r || m.s.r > bounds.e.r || m.e.c < bounds.s.c || m.s.c > bounds.e.c) {
      continue;
    }
    const sr = Math.max(m.s.r, bounds.s.r);
    const sc = Math.max(m.s.c, bounds.s.c);
    const er = Math.min(m.e.r, bounds.e.r);
    const ec = Math.min(m.e.c, bounds.e.c);

    origins.set(`${sr}:${sc}`, {
      rowspan: er - sr + 1,
      colspan: ec - sc + 1,
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

function buildSheetTableRows(
  sheet: XLSX.WorkSheet,
  bounds: { s: XLSX.CellAddress; e: XLSX.CellAddress },
): string[] {
  const merges = sheet['!merges'] ?? [];
  const { origins, covered } = buildMergeMaps(merges, bounds);
  const rowsHtml: string[] = [];

  for (let r = bounds.s.r; r <= bounds.e.r; r++) {
    const cells: string[] = [];
    for (let c = bounds.s.c; c <= bounds.e.c; c++) {
      const key = `${r}:${c}`;
      if (covered.has(key)) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSX.CellObject | undefined;
      const text = cell ? XLSX.utils.format_cell(cell) : '';
      const isNum = cell?.t === 'n';
      const merge = origins.get(key);

      const attrs: string[] = [];
      if (merge && merge.rowspan > 1) attrs.push(`rowspan="${merge.rowspan}"`);
      if (merge && merge.colspan > 1) attrs.push(`colspan="${merge.colspan}"`);
      if (isNum && text.trim() !== '') attrs.push('class="num"');

      const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
      cells.push(`<td${attrStr}>${escapeHtml(text)}</td>`);
    }

    const rowClass = r === bounds.s.r ? ' class="header-like"' : '';
    rowsHtml.push(`<tr${rowClass}>${cells.join('')}</tr>`);
  }

  return rowsHtml;
}

function estimateSheetIsLandscape(
  sheet: XLSX.WorkSheet,
  bounds: { s: XLSX.CellAddress; e: XLSX.CellAddress },
): boolean {
  const colCount = bounds.e.c - bounds.s.c + 1;
  if (colCount >= 7) return true;

  const colsMeta = sheet['!cols'] ?? [];
  let totalWch = 0;
  for (let c = bounds.s.c; c <= bounds.e.c; c++) {
    totalWch += colsMeta[c]?.wch ?? 11;
  }
  return totalWch > 78;
}

export async function renderExcelFileToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isCsv = /\.csv$/i.test(file.name);
  const workbook = isCsv
    ? XLSX.read(decodeCsvString(bytes), { type: 'string', cellDates: true })
    : XLSX.read(bytes, { type: 'array', cellDates: true });

  const nonEmptySheets: Array<{
    name: string;
    sheet: XLSX.WorkSheet;
    bounds: { s: XLSX.CellAddress; e: XLSX.CellAddress };
  }> = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const bounds = getTrimmedBounds(sheet);
    if (bounds) {
      nonEmptySheets.push({ name, sheet, bounds });
    }
  }

  if (nonEmptySheets.length === 0) {
    throw new Error('Spreadsheet contains no data');
  }

  const { iframe, doc } = await createIsolatedExcelIframe();

  try {
    const pageCanvases: HTMLCanvasElement[] = [];
    const showSheetTitle = nonEmptySheets.length > 1;

    for (const item of nonEmptySheets) {
      const isLandscape = estimateSheetIsLandscape(item.sheet, item.bounds);
      const pageW = isLandscape ? A4_LANDSCAPE_W : A4_PORTRAIT_W;
      const pageH = isLandscape ? A4_LANDSCAPE_H : A4_PORTRAIT_H;
      const innerW = pageW - PAGE_PADDING_X * 2;
      const innerH = pageH - PAGE_PADDING_Y * 2;

      const rowHtmlList = buildSheetTableRows(item.sheet, item.bounds);
      const colCount = item.bounds.e.c - item.bounds.s.c + 1;

      // Determine readable font size that fits columns inside page width
      let fontSize = colCount <= 5 ? 11 : colCount <= 9 ? 9.5 : 8;
      let cellPad = colCount <= 6 ? '4px 6px' : '3px 4px';

      // Measure full table inside an offscreen page container to adjust font scale if wide
      const measurePage = doc.createElement('section');
      measurePage.className = 'excel-page';
      measurePage.style.width = `${pageW}px`;

      const measureTable = doc.createElement('table');
      measureTable.className = 'excel-grid';
      measureTable.style.fontSize = `${fontSize}px`;
      measureTable.innerHTML = `<tbody>${rowHtmlList.join('')}</tbody>`;
      measurePage.appendChild(measureTable);
      doc.body.appendChild(measurePage);

      if (measureTable.scrollWidth > innerW) {
        const ratio = innerW / measureTable.scrollWidth;
        fontSize = Math.max(6.8, Number((fontSize * ratio).toFixed(1)));
        cellPad = '2px 3px';
        measureTable.style.fontSize = `${fontSize}px`;
        measureTable.querySelectorAll('td').forEach((td) => {
          (td as HTMLElement).style.padding = cellPad;
        });
      }

      const measuredHeights = Array.from(measureTable.querySelectorAll('tr')).map((tr) =>
        Math.max(18, Math.ceil((tr as HTMLElement).getBoundingClientRect().height)),
      );
      measurePage.remove();

      // Paginate rows cleanly into A4 page sections
      const titleReserve = showSheetTitle ? 32 : 0;
      let rowIdx = 0;

      while (rowIdx < rowHtmlList.length) {
        const pageEl = doc.createElement('section');
        pageEl.className = 'excel-page';
        pageEl.style.width = `${pageW}px`;
        pageEl.style.height = `${pageH}px`;

        if (showSheetTitle) {
          const titleEl = doc.createElement('h3');
          titleEl.className = 'sheet-title';
          titleEl.textContent = item.name;
          pageEl.appendChild(titleEl);
        }

        const pageTable = doc.createElement('table');
        pageTable.className = 'excel-grid';
        pageTable.style.fontSize = `${fontSize}px`;

        const pageRows: string[] = [];
        let accHeight = titleReserve;

        while (rowIdx < rowHtmlList.length) {
          const nextH = measuredHeights[rowIdx] ?? 22;
          if (pageRows.length > 0 && accHeight + nextH > innerH) {
            break;
          }
          pageRows.push(rowHtmlList[rowIdx]);
          accHeight += nextH;
          rowIdx++;
        }

        pageTable.innerHTML = `<tbody>${pageRows.join('')}</tbody>`;
        pageTable.querySelectorAll('td').forEach((td) => {
          (td as HTMLElement).style.padding = cellPad;
        });

        pageEl.appendChild(pageTable);
        doc.body.appendChild(pageEl);

        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 15)));

        const captured = await html2canvas(pageEl, {
          backgroundColor: '#ffffff',
          scale: 2.1,
          useCORS: true,
          logging: false,
          width: pageW,
          height: pageH,
          windowWidth: Math.max(pageW, doc.documentElement.scrollWidth),
          windowHeight: Math.max(pageH, doc.documentElement.scrollHeight),
        });

        pageCanvases.push(captured);
        pageEl.remove();
      }
    }

    if (pageCanvases.length === 0) {
      throw new Error('Spreadsheet produced no renderable pages');
    }

    return pageCanvases;
  } finally {
    iframe.remove();
  }
}
