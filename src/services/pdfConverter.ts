import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ColorMode, ConversionSettings, PageOutput, QueueItem } from '../types/pdf';
import { convertExcelToIntermediatePdf } from './excelConverter';
import { renderWordFileToCanvases } from './wordConverter';

// Bundle the worker locally with Vite so zero external CDNs are required.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDFJS_CMAP_URL = '/pdfjs/cmaps/';
const PDFJS_STANDARD_FONT_URL = '/pdfjs/standard_fonts/';

export const ACCEPTED_DOCUMENT_TYPES =
  '.pdf,.doc,.docx,.xlsx,.xls,.xlsm,.ods,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.oasis.opendocument.spreadsheet,text/csv';

export function isWordFile(file: File): boolean {
  return (
    /\.(docx?|DOCX?)$/i.test(file.name) ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

export function isExcelFile(file: File): boolean {
  return (
    /\.(xlsx|xls|xlsm|ods|csv)$/i.test(file.name) ||
    file.type === 'application/vnd.ms-excel' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.oasis.opendocument.spreadsheet' ||
    file.type === 'text/csv'
  );
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isSupportedDocumentFile(file: File): boolean {
  return isPdfFile(file) || isWordFile(file) || isExcelFile(file);
}

export function getDocumentFormatLabel(
  fileName: string,
): 'PDF' | 'DOCX' | 'DOC' | 'XLSX' | 'XLS' | 'ODS' | 'CSV' {
  if (/\.docx$/i.test(fileName)) return 'DOCX';
  if (/\.doc$/i.test(fileName)) return 'DOC';
  if (/\.xlsx$/i.test(fileName)) return 'XLSX';
  if (/\.xlsm$/i.test(fileName)) return 'XLSX';
  if (/\.xls$/i.test(fileName)) return 'XLS';
  if (/\.ods$/i.test(fileName)) return 'ODS';
  if (/\.csv$/i.test(fileName)) return 'CSV';
  return 'PDF';
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function applyColorFilter(canvas: HTMLCanvasElement, mode: ColorMode): void {
  if (mode === 'color') return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const isHighContrast = mode === 'bw_contrast';

  for (let y = 0; y < canvas.height; y += 128) {
    const h = Math.min(128, canvas.height - y);
    const im = ctx.getImageData(0, y, width, h);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      if (isHighContrast) {
        if (g > 218) {
          g = 255;
        } else if (g < 75) {
          g = Math.max(0, Math.round(g * 0.72));
        } else {
          const norm = (g - 75) / (218 - 75);
          g = Math.round(54 + norm * (248 - 54));
        }
      }
      d[i] = g;
      d[i + 1] = g;
      d[i + 2] = g;
    }
    ctx.putImageData(im, 0, y);
  }
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

function canvasToJpegBytes(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; bytes: Uint8Array }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode page image'));
          return;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        resolve({ blob, bytes });
      },
      'image/jpeg',
      quality,
    );
  });
}

export function stripDocumentExtension(fileName: string): string {
  return fileName.replace(/\.(pdf|docx?|xlsx?|xlsm|ods|csv)$/i, '');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function revokeItemOutputs(outputs: PageOutput[]): void {
  for (const out of outputs) {
    if (out.previewUrl) {
      URL.revokeObjectURL(out.previewUrl);
    }
  }
}

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadAllOutputsAsZip(queue: QueueItem[]): Promise<void> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const item of queue) {
    for (const out of item.outputs) {
      let safeName = out.name;
      if (usedNames.has(safeName)) {
        const dotIdx = safeName.lastIndexOf('.');
        const stem = dotIdx > -1 ? safeName.slice(0, dotIdx) : safeName;
        const ext = dotIdx > -1 ? safeName.slice(dotIdx) : '';
        let counter = 2;
        while (usedNames.has(`${stem}_${counter}${ext}`)) {
          counter++;
        }
        safeName = `${stem}_${counter}${ext}`;
      }
      usedNames.add(safeName);
      zip.file(safeName, out.bytes);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  saveBlobAsFile(blob, 'DocGate_PDF_Documents.zip');
}

interface DpiRange {
  dpi: number;
  highQ: number;
  lowQ: number;
}

const DPI_RANGES: DpiRange[] = [
  { dpi: 300, highQ: 0.9, lowQ: 0.72 },
  { dpi: 200, highQ: 0.84, lowQ: 0.58 },
  { dpi: 150, highQ: 0.78, lowQ: 0.42 },
  { dpi: 120, highQ: 0.72, lowQ: 0.32 },
  { dpi: 100, highQ: 0.64, lowQ: 0.24 },
  { dpi: 85, highQ: 0.56, lowQ: 0.2 },
  { dpi: 72, highQ: 0.48, lowQ: 0.16 },
  { dpi: 60, highQ: 0.4, lowQ: 0.14 },
  { dpi: 50, highQ: 0.32, lowQ: 0.12 },
];

function selectDpiSchedule(maxSizeBytes: number, pageCountForBudget: number): DpiRange[] {
  const perPageBudget = maxSizeBytes / Math.max(1, pageCountForBudget);
  if (perPageBudget >= 320 * 1024) {
    return DPI_RANGES;
  }
  if (perPageBudget >= 150 * 1024) {
    return DPI_RANGES.filter((r) => r.dpi <= 200);
  }
  if (perPageBudget >= 70 * 1024) {
    return DPI_RANGES.filter((r) => r.dpi <= 150);
  }
  return DPI_RANGES.filter((r) => r.dpi <= 120);
}

interface RenderedPageFrame {
  canvas: HTMLCanvasElement;
  ptWidth: number;
  ptHeight: number;
}

async function compileFramesToPdf(
  frames: RenderedPageFrame[],
  quality: number,
): Promise<{ arrayBuf: ArrayBuffer; firstPageBlob: Blob | null }> {
  let pdf: jsPDF | null = null;
  let firstPageBlob: Blob | null = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const { blob, bytes: jpegBuf } = await canvasToJpegBytes(frame.canvas, quality);
    if (i === 0) {
      firstPageBlob = blob;
    }

    const orientation = frame.ptWidth > frame.ptHeight ? 'landscape' : 'portrait';
    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: 'pt',
        format: [frame.ptWidth, frame.ptHeight],
        compress: true,
      });
    } else {
      pdf.addPage([frame.ptWidth, frame.ptHeight], orientation);
    }

    pdf.addImage(jpegBuf, 'JPEG', 0, 0, frame.ptWidth, frame.ptHeight, undefined, 'FAST');
  }

  return {
    arrayBuf: pdf ? pdf.output('arraybuffer') : new ArrayBuffer(0),
    firstPageBlob,
  };
}

/**
 * Finds the highest JPEG quality between lowQ and highQ on already-rendered
 * canvases such that the compiled PDF fits within maxSizeBytes.
 */
async function solveQualityForFrames(
  frames: RenderedPageFrame[],
  highQ: number,
  lowQ: number,
  maxSizeBytes: number,
): Promise<{
  fits: boolean;
  arrayBuf: ArrayBuffer;
  firstPageBlob: Blob | null;
}> {
  const highTry = await compileFramesToPdf(frames, highQ);
  if (highTry.arrayBuf.byteLength <= maxSizeBytes) {
    return { fits: true, ...highTry };
  }

  const lowTry = await compileFramesToPdf(frames, lowQ);
  if (lowTry.arrayBuf.byteLength > maxSizeBytes) {
    return { fits: false, ...lowTry };
  }

  // Binary search (3 steps) between lowQ and highQ on the same rendered canvases
  let lo = lowQ;
  let hi = highQ;
  let best = lowTry;

  for (let step = 0; step < 3; step++) {
    const mid = Number(((lo + hi) / 2).toFixed(2));
    if (mid <= lo || mid >= hi) break;
    const midTry = await compileFramesToPdf(frames, mid);
    if (midTry.arrayBuf.byteLength <= maxSizeBytes) {
      best = midTry;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return { fits: true, ...best };
}

function disposeFrames(frames: RenderedPageFrame[]): void {
  for (const frame of frames) {
    frame.canvas.width = 0;
    frame.canvas.height = 0;
  }
}

function scaleMasterCanvasForDpi(
  master: HTMLCanvasElement,
  ptWidth: number,
  ptHeight: number,
  dpi: number,
): HTMLCanvasElement {
  const targetW = Math.max(1, Math.min(master.width, Math.round((ptWidth * dpi) / 72)));
  const targetH = Math.max(1, Math.round((targetW * ptHeight) / ptWidth));
  const canvas = makeCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(master, 0, 0, targetW, targetH);
  }
  return canvas;
}

async function convertCanvasesToPdfDocument(
  masterCanvases: HTMLCanvasElement[],
  file: File,
  settings: ConversionSettings,
  onProgress: (currentPage: number, totalPages: number) => void,
): Promise<{ totalPages: number; outputs: PageOutput[] }> {
  const base = stripDocumentExtension(file.name);
  const maxSizeBytes = settings.sizeLimitKb * 1024;
  const totalPages = masterCanvases.length;

  try {
    if (settings.outputMode === 'split') {
      const outputs: PageOutput[] = [];
      const schedule = selectDpiSchedule(maxSizeBytes, 1);

      for (let i = 0; i < totalPages; i++) {
        const p = i + 1;
        onProgress(p, totalPages);
        await yieldFrame();

        const master = masterCanvases[i];
        const ptWidth = master.width > master.height ? 841.89 : 595.28;
        const ptHeight = Math.max(200, (ptWidth * master.height) / master.width);

        let chosenBytes: ArrayBuffer | null = null;
        let chosenBlob: Blob | null = null;
        let chosenDpi = schedule[schedule.length - 1].dpi;
        let withinLimit = false;

        for (let idx = 0; idx < schedule.length; idx++) {
          const tier = schedule[idx];
          const canvas = scaleMasterCanvasForDpi(master, ptWidth, ptHeight, tier.dpi);
          applyColorFilter(canvas, settings.colorMode);
          const frames: RenderedPageFrame[] = [{ canvas, ptWidth, ptHeight }];

          const solved = await solveQualityForFrames(frames, tier.highQ, tier.lowQ, maxSizeBytes);
          disposeFrames(frames);

          if (solved.fits || idx === schedule.length - 1) {
            chosenBytes = solved.arrayBuf;
            chosenBlob = solved.firstPageBlob;
            chosenDpi = tier.dpi;
            withinLimit = solved.fits;
            break;
          }
        }

        if (chosenBytes && chosenBlob) {
          outputs.push({
            id: `${base}_p${p}_${crypto.randomUUID().slice(0, 6)}`,
            pageNum: p,
            name: `${base}_page_${p}.pdf`,
            bytes: chosenBytes,
            previewUrl: URL.createObjectURL(chosenBlob),
            dpi: chosenDpi,
            withinLimit,
          });
        }
      }

      return { totalPages, outputs };
    }

    // Merged mode for DOC/DOCX
    const schedule = selectDpiSchedule(maxSizeBytes, totalPages);
    let finalBytes: ArrayBuffer | null = null;
    let firstPagePreviewBlob: Blob | null = null;
    let finalDpi = schedule[schedule.length - 1].dpi;
    let withinLimit = false;

    for (let idx = 0; idx < schedule.length; idx++) {
      const tier = schedule[idx];
      const frames: RenderedPageFrame[] = [];

      for (let i = 0; i < totalPages; i++) {
        onProgress(i + 1, totalPages);
        await yieldFrame();

        const master = masterCanvases[i];
        const ptWidth = master.width > master.height ? 841.89 : 595.28;
        const ptHeight = Math.max(200, (ptWidth * master.height) / master.width);
        const canvas = scaleMasterCanvasForDpi(master, ptWidth, ptHeight, tier.dpi);
        applyColorFilter(canvas, settings.colorMode);
        frames.push({ canvas, ptWidth, ptHeight });
      }

      const solved = await solveQualityForFrames(frames, tier.highQ, tier.lowQ, maxSizeBytes);
      disposeFrames(frames);

      if (solved.fits || idx === schedule.length - 1) {
        finalBytes = solved.arrayBuf;
        firstPagePreviewBlob = solved.firstPageBlob;
        finalDpi = tier.dpi;
        withinLimit = solved.fits;
        break;
      }
    }

    const outputs: PageOutput[] = [];
    if (finalBytes && firstPagePreviewBlob) {
      outputs.push({
        id: `${base}_merged_${crypto.randomUUID().slice(0, 6)}`,
        pageNum: 1,
        pageCount: totalPages,
        name: `${base}.pdf`,
        bytes: finalBytes,
        previewUrl: URL.createObjectURL(firstPagePreviewBlob),
        dpi: finalDpi,
        withinLimit,
        isMergedDocument: true,
      });
    }

    return { totalPages, outputs };
  } finally {
    for (const c of masterCanvases) {
      c.width = 0;
      c.height = 0;
    }
  }
}

export async function convertPdfDocument(
  file: File,
  settings: ConversionSettings,
  onProgress: (currentPage: number, totalPages: number) => void,
): Promise<{ totalPages: number; outputs: PageOutput[] }> {
  if (isWordFile(file)) {
    const canvases = await renderWordFileToCanvases(file);
    return convertCanvasesToPdfDocument(canvases, file, settings, onProgress);
  }

  const fromExcel = isExcelFile(file);
  let doc: PDFDocumentProxy | null = null;
  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
  const maxSizeBytes = settings.sizeLimitKb * 1024;
  const base = stripDocumentExtension(file.name);

  try {
    const buffer = fromExcel
      ? await convertExcelToIntermediatePdf(file)
      : new Uint8Array(await file.arrayBuffer());
    loadingTask = pdfjsLib.getDocument({
      data: buffer,
      useSystemFonts: true,
      cMapUrl: PDFJS_CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: PDFJS_STANDARD_FONT_URL,
    });
    doc = await loadingTask.promise;

    const totalPages = doc.numPages;

    if (settings.outputMode === 'split') {
      const outputs: PageOutput[] = [];
      const schedule = selectDpiSchedule(maxSizeBytes, 1);

      for (let p = 1; p <= totalPages; p++) {
        onProgress(p, totalPages);
        await yieldFrame();

        const page = await doc.getPage(p);
        const size = page.getViewport({ scale: 1 });

        let chosenBytes: ArrayBuffer | null = null;
        let chosenBlob: Blob | null = null;
        let chosenDpi = schedule[schedule.length - 1].dpi;
        let withinLimit = false;

        for (let idx = 0; idx < schedule.length; idx++) {
          const tier = schedule[idx];
          const viewport = page.getViewport({ scale: tier.dpi / 72 });
          const w = Math.max(1, Math.ceil(viewport.width));
          const h = Math.max(1, Math.ceil(viewport.height));
          const canvas = makeCanvas(w, h);

          await page.render({
            canvas,
            viewport,
            background: '#ffffff',
          }).promise;

          applyColorFilter(canvas, settings.colorMode);
          const frames: RenderedPageFrame[] = [
            { canvas, ptWidth: size.width, ptHeight: size.height },
          ];

          const solved = await solveQualityForFrames(frames, tier.highQ, tier.lowQ, maxSizeBytes);
          disposeFrames(frames);

          if (solved.fits || idx === schedule.length - 1) {
            chosenBytes = solved.arrayBuf;
            chosenBlob = solved.firstPageBlob;
            chosenDpi = tier.dpi;
            withinLimit = solved.fits;
            break;
          }
        }

        page.cleanup();

        if (chosenBytes && chosenBlob) {
          outputs.push({
            id: `${base}_p${p}_${crypto.randomUUID().slice(0, 6)}`,
            pageNum: p,
            name: `${base}_page_${p}.pdf`,
            bytes: chosenBytes,
            previewUrl: URL.createObjectURL(chosenBlob),
            dpi: chosenDpi,
            withinLimit,
          });
        }
      }

      return { totalPages, outputs };
    }

    // Merged mode: compile all pages into one PDF under maxSizeBytes
    const schedule = selectDpiSchedule(maxSizeBytes, totalPages);
    let finalBytes: ArrayBuffer | null = null;
    let firstPagePreviewBlob: Blob | null = null;
    let finalDpi = schedule[schedule.length - 1].dpi;
    let withinLimit = false;

    for (let idx = 0; idx < schedule.length; idx++) {
      const tier = schedule[idx];
      const frames: RenderedPageFrame[] = [];

      for (let p = 1; p <= totalPages; p++) {
        onProgress(p, totalPages);
        await yieldFrame();

        const page = await doc.getPage(p);
        const size = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: tier.dpi / 72 });
        const w = Math.max(1, Math.ceil(viewport.width));
        const h = Math.max(1, Math.ceil(viewport.height));
        const canvas = makeCanvas(w, h);

        await page.render({
          canvas,
          viewport,
          background: '#ffffff',
        }).promise;

        applyColorFilter(canvas, settings.colorMode);
        frames.push({ canvas, ptWidth: size.width, ptHeight: size.height });
        page.cleanup();
      }

      const solved = await solveQualityForFrames(frames, tier.highQ, tier.lowQ, maxSizeBytes);
      disposeFrames(frames);

      if (solved.fits || idx === schedule.length - 1) {
        finalBytes = solved.arrayBuf;
        firstPagePreviewBlob = solved.firstPageBlob;
        finalDpi = tier.dpi;
        withinLimit = solved.fits;
        break;
      }
    }

    const outputs: PageOutput[] = [];
    if (finalBytes && firstPagePreviewBlob) {
      outputs.push({
        id: `${base}_merged_${crypto.randomUUID().slice(0, 6)}`,
        pageNum: 1,
        pageCount: totalPages,
        name: fromExcel ? `${base}.pdf` : `${base}_optimized.pdf`,
        bytes: finalBytes,
        previewUrl: URL.createObjectURL(firstPagePreviewBlob),
        dpi: finalDpi,
        withinLimit,
        isMergedDocument: true,
      });
    }

    return { totalPages, outputs };
  } finally {
    if (doc) {
      await doc.cleanup();
    }
    if (loadingTask) {
      await loadingTask.destroy();
    }
  }
}
