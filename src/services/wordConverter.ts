import * as CFB from 'cfb';
import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';

const A4_WIDTH_PX = 794; // 210mm at 96 DPI
const A4_HEIGHT_PX = 1123; // 297mm at 96 DPI
const A4_RATIO = 841.89 / 595.28; // ~1.41427

type DetectedFormat = 'docx' | 'doc_ole2' | 'rtf' | 'html';

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function detectWordFormat(bytes: Uint8Array, fileName: string): DetectedFormat {
  // PK\x03\x04 -> ZIP / OOXML (.docx)
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return 'docx';
  }
  // D0 CF 11 E0 A1 B1 1A E1 -> OLE2 Compound File (.doc)
  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'doc_ole2';
  }

  const headAscii = new TextDecoder('ascii', { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();

  if (headAscii.startsWith('{\\rtf')) {
    return 'rtf';
  }
  if (
    headAscii.startsWith('<!doctype html') ||
    headAscii.startsWith('<html') ||
    headAscii.includes('<html') ||
    headAscii.includes('<body')
  ) {
    return 'html';
  }

  return /\.docx$/i.test(fileName) ? 'docx' : 'doc_ole2';
}

function cleanWordText(raw: string): string {
  // Strip Word field codes (\x13 ... \x14 visible text \x15)
  let text = raw.replace(/\x13[^\x14\x15]*\x14/g, '');
  text = text.replace(/[\x13\x14\x15]/g, '');
  // Replace Word cell/row markers and special whitespace
  text = text.replace(/\x07/g, '\t');
  text = text.replace(/[\x0b\x0c]/g, '\n');
  text = text.replace(/\r\n?/g, '\n');
  // Remove remaining non-printable control chars except \n and \t
  text = text.replace(/[\x00-\x08\x0e-\x1f]/g, '');
  return text;
}

function extractTextFromOle2Doc(bytes: Uint8Array): string {
  const container = CFB.read(bytes, { type: 'array' });
  const wordEntry = CFB.find(container, 'WordDocument') ?? CFB.find(container, '/WordDocument');
  if (!wordEntry || !wordEntry.content) {
    throw new Error('Invalid .doc file: missing WordDocument stream');
  }

  const wBytes =
    wordEntry.content instanceof Uint8Array
      ? wordEntry.content
      : new Uint8Array(wordEntry.content);
  const wView = new DataView(wBytes.buffer, wBytes.byteOffset, wBytes.byteLength);

  if (wBytes.length < 0x1a8) {
    throw new Error('Corrupted .doc header');
  }

  const flags = wView.getUint16(0x000a, true);
  const tableName = (flags & 0x0200) !== 0 ? '1Table' : '0Table';
  const tableEntry = CFB.find(container, tableName) ?? CFB.find(container, `/${tableName}`);

  // Dynamically walk FIB sections (FibBase=32, csw, cslw, cbRgFcLcb)
  let pos = 32;
  const csw = wView.getUint16(pos, true);
  pos += 2 + csw * 2;
  const cslw = wView.getUint16(pos, true);
  const ccpText = cslw > 3 && pos + 2 + 16 <= wBytes.length ? wView.getInt32(pos + 2 + 3 * 4, true) : 0;
  pos += 2 + cslw * 4;
  const cbRgFcLcb = pos + 2 <= wBytes.length ? wView.getUint16(pos, true) : 0;
  pos += 2;

  const fcClxOffset = pos + 33 * 8;
  const hasClx =
    tableEntry &&
    tableEntry.content &&
    cbRgFcLcb > 33 &&
    fcClxOffset + 8 <= wBytes.length;

  if (hasClx && tableEntry?.content) {
    const tBytes =
      tableEntry.content instanceof Uint8Array
        ? tableEntry.content
        : new Uint8Array(tableEntry.content);
    const tView = new DataView(tBytes.buffer, tBytes.byteOffset, tBytes.byteLength);

    const fcClx = wView.getUint32(fcClxOffset, true);
    const lcbClx = wView.getUint32(fcClxOffset + 4, true);

    if (fcClx + lcbClx <= tBytes.length && lcbClx > 0) {
      let clxPos = fcClx;
      const clxEnd = fcClx + lcbClx;

      // Skip Prc records (clxt === 0x01)
      while (clxPos < clxEnd && tBytes[clxPos] === 0x01) {
        if (clxPos + 3 > clxEnd) break;
        const cbGrpprl = tView.getUint16(clxPos + 1, true);
        clxPos += 3 + cbGrpprl;
      }

      // Read Pcdt record (clxt === 0x02)
      if (clxPos + 5 <= clxEnd && tBytes[clxPos] === 0x02) {
        const lcbPlcPcd = tView.getUint32(clxPos + 1, true);
        const plcStart = clxPos + 5;
        const plcEnd = Math.min(plcStart + lcbPlcPcd, tBytes.length);
        const nPieces = Math.floor((plcEnd - plcStart - 4) / 12);

        if (nPieces > 0) {
          const cpBase = plcStart;
          const pcdBase = plcStart + (nPieces + 1) * 4;
          const win1251 = new TextDecoder('windows-1251', { fatal: false });
          const utf16 = new TextDecoder('utf-16le', { fatal: false });
          const chunks: string[] = [];
          let collectedChars = 0;

          for (let i = 0; i < nPieces; i++) {
            const cpStart = tView.getUint32(cpBase + i * 4, true);
            const cpEnd = tView.getUint32(cpBase + (i + 1) * 4, true);
            let charCount = cpEnd - cpStart;
            if (charCount <= 0) continue;

            if (ccpText > 0 && collectedChars >= ccpText) break;
            if (ccpText > 0 && collectedChars + charCount > ccpText) {
              charCount = ccpText - collectedChars;
            }

            const pcdOffset = pcdBase + i * 8;
            if (pcdOffset + 8 > plcEnd) break;
            const fcRaw = tView.getUint32(pcdOffset + 2, true);
            const isCompressed = (fcRaw & 0x40000000) !== 0;

            if (isCompressed) {
              const byteStart = (fcRaw & ~0x40000000) >>> 1;
              const byteEnd = Math.min(byteStart + charCount, wBytes.length);
              if (byteStart < byteEnd) {
                chunks.push(win1251.decode(wBytes.subarray(byteStart, byteEnd)));
              }
            } else {
              const byteStart = fcRaw;
              const byteEnd = Math.min(byteStart + charCount * 2, wBytes.length);
              if (byteStart < byteEnd) {
                chunks.push(utf16.decode(wBytes.subarray(byteStart, byteEnd)));
              }
            }

            collectedChars += charCount;
          }

          const joined = cleanWordText(chunks.join(''));
          if (joined.trim().length > 0) {
            return joined;
          }
        }
      }
    }
  }

  // Fallback: extract readable UTF-16LE / CP1251 text segment from WordDocument stream
  const fcMin = wView.getUint32(0x0018, true);
  const fcMac = wView.getUint32(0x001c, true);
  if (fcMac > fcMin && fcMac <= wBytes.length) {
    const slice = wBytes.subarray(fcMin, fcMac);
    // Heuristic: if every second byte is frequently 0x00 or 0x04 (Cyrillic UTF-16LE), decode as utf-16le
    let zeroOrCyrHigh = 0;
    const sampleLen = Math.min(slice.length, 512);
    for (let i = 1; i < sampleLen; i += 2) {
      if (slice[i] === 0x00 || slice[i] === 0x04) zeroOrCyrHigh++;
    }
    const isUtf16 = sampleLen > 10 && zeroOrCyrHigh / (sampleLen / 2) > 0.35;
    const decoded = new TextDecoder(isUtf16 ? 'utf-16le' : 'windows-1251', { fatal: false }).decode(
      slice,
    );
    const cleaned = cleanWordText(decoded);
    if (cleaned.trim().length > 0) {
      return cleaned;
    }
  }

  throw new Error('Could not extract readable text from .doc file');
}

function extractTextFromRtf(bytes: Uint8Array): string {
  const raw = new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
  const win1251 = new TextDecoder('windows-1251', { fatal: false });
  const output: string[] = [];
  let skipGroupDepth = 0;
  let depth = 0;
  let ucSkip = 1;

  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'headerl',
    'headerr',
    'headerf',
    'footerl',
    'footerr',
    'footerf',
    'fldinst',
    'xmlopen',
    'datastore',
    'themedata',
    'colorschememapping',
    'latentstyles',
    'listtable',
    'listoverridetable',
  ]);

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];

    if (ch === '{') {
      depth++;
      i++;
      continue;
    }

    if (ch === '}') {
      if (skipGroupDepth === depth) {
        skipGroupDepth = 0;
      }
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }

    if (skipGroupDepth > 0 && depth >= skipGroupDepth) {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= raw.length) break;
      const next = raw[i];

      if (next === '\\' || next === '{' || next === '}') {
        output.push(next);
        i++;
        continue;
      }

      if (next === '*') {
        skipGroupDepth = depth;
        i++;
        continue;
      }

      if (next === '\'') {
        const hex = raw.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          output.push(win1251.decode(new Uint8Array([parseInt(hex, 16)])));
          i += 3;
          continue;
        }
      }

      if (next === '\r' || next === '\n') {
        output.push('\n');
        i++;
        continue;
      }

      // Control word
      const match = raw.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (match) {
        const word = match[1];
        const param = match[2] !== undefined ? Number(match[2]) : undefined;
        i += match[0].length;

        if (skipDestinations.has(word)) {
          skipGroupDepth = depth;
        } else if (word === 'par' || word === 'line') {
          output.push('\n');
        } else if (word === 'tab') {
          output.push('\t');
        } else if (word === 'uc' && param !== undefined) {
          ucSkip = Math.max(0, param);
        } else if (word === 'u' && param !== undefined) {
          const codePoint = param < 0 ? param + 65536 : param;
          output.push(String.fromCharCode(codePoint));
          // Skip fallback ANSI characters after \uN
          let skipped = 0;
          while (skipped < ucSkip && i < raw.length) {
            if (raw[i] === '\\' && raw[i + 1] === "'") {
              i += 4;
            } else {
              i++;
            }
            skipped++;
          }
        }
        continue;
      }

      i++;
      continue;
    }

    if (ch !== '\r' && ch !== '\n') {
      output.push(ch);
    }
    i++;
  }

  return output.join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToStructuredHtml(text: string): string {
  const lines = text.split('\n');
  const htmlParts: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    htmlParts.push('<table><tbody>');
    for (const row of tableRows) {
      htmlParts.push('<tr>');
      for (const cell of row) {
        htmlParts.push(`<td>${escapeHtml(cell.trim())}</td>`);
      }
      htmlParts.push('</tr>');
    }
    htmlParts.push('</tbody></table>');
    tableRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.includes('\t')) {
      const cells = line.split('\t').filter((c, idx, arr) => !(idx === arr.length - 1 && c === ''));
      if (cells.length > 1) {
        tableRows.push(cells);
        continue;
      }
    }

    flushTable();
    const trimmed = line.trim();
    if (!trimmed) {
      htmlParts.push('<div class="spacer"></div>');
    } else {
      htmlParts.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  }

  flushTable();
  return htmlParts.join('\n');
}

function sanitizeHtmlForDoc(bytes: Uint8Array): string {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  parsed.querySelectorAll('script, iframe, object, embed, link[rel="stylesheet"]').forEach((el) => {
    el.remove();
  });
  return parsed.body ? parsed.body.innerHTML : `<pre>${escapeHtml(raw)}</pre>`;
}

function createIsolatedIframe(): Promise<{
  iframe: HTMLIFrameElement;
  doc: Document;
}> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-12000px';
    iframe.style.top = '0';
    iframe.style.width = '960px';
    iframe.style.height = '1400px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (doc) {
        resolve({ iframe, doc });
      }
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
    font-family: "Times New Roman", Georgia, "Liberation Serif", serif;
    -webkit-font-smoothing: antialiased;
  }
  .docx-wrapper {
    background: #ffffff !important;
    padding: 0 !important;
  }
  .docx-wrapper > section.docx {
    box-shadow: none !important;
    margin: 0 auto !important;
  }
  .doc-pages-root {
    width: ${A4_WIDTH_PX}px;
    background: #ffffff;
  }
  .doc-page {
    width: ${A4_WIDTH_PX}px;
    min-height: ${A4_HEIGHT_PX}px;
    padding: 56px 56px 56px 68px;
    background: #ffffff;
    color: #111827;
    font-family: "DM Sans", Arial, "Helvetica Neue", sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .doc-page p {
    margin: 0 0 6px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .doc-page .spacer {
    height: 10px;
  }
  .doc-page table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 12px;
  }
  .doc-page td, .doc-page th {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
    word-break: break-word;
  }
  .doc-flow-content {
    width: ${A4_WIDTH_PX}px;
    padding: 56px 56px 56px 68px;
    background: #ffffff;
    color: #111827;
    font-family: "DM Sans", Arial, "Helvetica Neue", sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .doc-flow-content p {
    margin: 0 0 6px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .doc-flow-content .spacer {
    height: 10px;
  }
  .doc-flow-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 12px;
  }
  .doc-flow-content td, .doc-flow-content th {
    border: 1px solid #cbd5e1;
    padding: 5px 7px;
    vertical-align: top;
    word-break: break-word;
  }
</style>
</head>
<body></body>
</html>`;

    document.body.appendChild(iframe);
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

/**
 * Finds a mostly-white horizontal scanline near targetY so tall rendered
 * documents do not slice through the middle of a line of text.
 */
function findCleanCutY(canvas: HTMLCanvasElement, targetY: number): number {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return targetY;

  const searchRadius = Math.min(90, Math.round(canvas.height * 0.06));
  const minY = Math.max(10, targetY - searchRadius);
  const maxY = Math.min(canvas.height - 10, targetY + searchRadius);

  let bestY = targetY;
  let bestScore = -1;

  for (let y = maxY; y >= minY; y -= 2) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    let brightPixels = 0;
    for (let x = 0; x < row.length; x += 16) {
      if (row[x] > 242 && row[x + 1] > 242 && row[x + 2] > 242) {
        brightPixels++;
      }
    }
    if (brightPixels > bestScore) {
      bestScore = brightPixels;
      bestY = y;
      // Early exit if row is completely white
      if (brightPixels >= Math.floor(row.length / 16)) {
        break;
      }
    }
  }

  return bestY;
}

function sliceTallCanvasIntoA4Pages(tallCanvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const pageHeightPx = Math.round(tallCanvas.width * A4_RATIO);
  if (tallCanvas.height <= pageHeightPx * 1.08) {
    return [tallCanvas];
  }

  const pages: HTMLCanvasElement[] = [];
  let y = 0;

  while (y < tallCanvas.height - 12) {
    const remaining = tallCanvas.height - y;
    const rawCut = y + Math.min(pageHeightPx, remaining);
    const cutY =
      remaining <= pageHeightPx * 1.05 ? tallCanvas.height : findCleanCutY(tallCanvas, rawCut);
    const sliceH = Math.max(1, cutY - y);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = tallCanvas.width;
    pageCanvas.height = pageHeightPx;
    const ctx = pageCanvas.getContext('2d', { alpha: false });
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(tallCanvas, 0, y, tallCanvas.width, sliceH, 0, 0, tallCanvas.width, sliceH);
    }

    pages.push(pageCanvas);
    y = cutY;
  }

  tallCanvas.width = 0;
  tallCanvas.height = 0;
  return pages;
}

export async function renderWordFileToCanvases(file: File): Promise<HTMLCanvasElement[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectWordFormat(bytes, file.name);

  const { iframe, doc } = await createIsolatedIframe();

  try {
    const styleContainer = doc.createElement('div');
    const bodyContainer = doc.createElement('div');
    doc.body.appendChild(styleContainer);
    doc.body.appendChild(bodyContainer);

    let elementsToCapture: HTMLElement[] = [];

    if (format === 'docx') {
      await renderAsync(buffer, bodyContainer, styleContainer, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
      });

      const sections = Array.from(bodyContainer.querySelectorAll('section')) as HTMLElement[];
      elementsToCapture = sections.length > 0 ? sections : [bodyContainer];
    } else {
      const htmlContent =
        format === 'html'
          ? sanitizeHtmlForDoc(bytes)
          : format === 'rtf'
            ? textToStructuredHtml(extractTextFromRtf(bytes))
            : textToStructuredHtml(extractTextFromOle2Doc(bytes));

      const flowEl = doc.createElement('div');
      flowEl.className = 'doc-flow-content';
      flowEl.innerHTML = htmlContent;
      bodyContainer.appendChild(flowEl);
      elementsToCapture = [flowEl];
    }

    await waitForImages(bodyContainer);
    // Allow browser layout to settle inside iframe
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 40)));

    const pageCanvases: HTMLCanvasElement[] = [];

    for (const el of elementsToCapture) {
      const width = Math.max(el.scrollWidth, el.offsetWidth, A4_WIDTH_PX);
      const height = Math.max(el.scrollHeight, el.offsetHeight, 100);

      const captured = await html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2.2,
        useCORS: true,
        logging: false,
        width,
        height,
        windowWidth: Math.max(width, doc.documentElement.scrollWidth),
        windowHeight: Math.max(height, doc.documentElement.scrollHeight),
      });

      const sliced = sliceTallCanvasIntoA4Pages(captured);
      pageCanvases.push(...sliced);
    }

    if (pageCanvases.length === 0) {
      throw new Error('Document produced no renderable pages');
    }

    return pageCanvases;
  } finally {
    iframe.remove();
  }
}
