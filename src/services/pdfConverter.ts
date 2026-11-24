import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ColorMode, ConversionSettings, PageOutput, QueueItem } from '../types/pdf';

// Bundle the worker locally with Vite so zero external CDNs are required.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PDFJS_CMAP_URL = '/pdfjs/cmaps/';
const PDFJS_STANDARD_FONT_URL = '/pdfjs/standard_fonts/';

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
        // Gentle scan cleanup: lift off-white paper noise to pure white, deepen ink/stamps
        if (g > 218) {
          g = 255;
        } else if (g < 75) {
          g = Math.max(0, Math.round(g * 0.72));
        } else {
          // Stretch midtones smoothly
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

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<{ blob: Blob; bytes: Uint8Array }> {
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

export function stripPdfExtension(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '');
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

const DPI_TIERS = [
  { dpi: 300, quality: 0.9 },
  { dpi: 200, quality: 0.82 },
  { dpi: 150, quality: 0.74 },
  { dpi: 120, quality: 0.66 },
  { dpi: 100, quality: 0.58 },
  { dpi: 85, quality: 0.52 },
];

export async function convertPdfDocument(
  file: File,
  settings: ConversionSettings,
  onProgress: (currentPage: number, totalPages: number) => void,
): Promise<{ totalPages: number; outputs: PageOutput[] }> {
  let doc: PDFDocumentProxy | null = null;
  let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
  const maxSizeBytes = settings.sizeLimitKb * 1024;
  const base = stripPdfExtension(file.name);

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
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

      for (let p = 1; p <= totalPages; p++) {
        onProgress(p, totalPages);
        await yieldFrame();

        const page = await doc.getPage(p);
        const size = page.getViewport({ scale: 1 });

        let chosenBytes: ArrayBuffer | null = null;
        let chosenBlob: Blob | null = null;
        let chosenDpi = 85;
        let withinLimit = false;

        for (let idx = 0; idx < DPI_TIERS.length; idx++) {
          const tier = DPI_TIERS[idx];
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

          const { blob, bytes: jpegBuf } = await canvasToJpegBytes(canvas, tier.quality);

          const pdf = new jsPDF({
            orientation: size.width > size.height ? 'landscape' : 'portrait',
            unit: 'pt',
            format: [size.width, size.height],
            compress: true,
          });
          pdf.addImage(jpegBuf, 'JPEG', 0, 0, size.width, size.height, undefined, 'FAST');
          const arrayBuf = pdf.output('arraybuffer');

          canvas.width = 0;
          canvas.height = 0;

          if (arrayBuf.byteLength <= maxSizeBytes || idx === DPI_TIERS.length - 1) {
            chosenBytes = arrayBuf;
            chosenBlob = blob;
            chosenDpi = tier.dpi;
            withinLimit = arrayBuf.byteLength <= maxSizeBytes;
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
    let finalBytes: ArrayBuffer | null = null;
    let firstPagePreviewBlob: Blob | null = null;
    let finalDpi = 85;
    let withinLimit = false;

    for (let idx = 0; idx < DPI_TIERS.length; idx++) {
      const tier = DPI_TIERS[idx];
      let mergedPdf: jsPDF | null = null;
      let tierPreviewBlob: Blob | null = null;

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
        const { blob, bytes: jpegBuf } = await canvasToJpegBytes(canvas, tier.quality);

        if (p === 1) {
          tierPreviewBlob = blob;
        }

        const orientation = size.width > size.height ? 'landscape' : 'portrait';
        if (!mergedPdf) {
          mergedPdf = new jsPDF({
            orientation,
            unit: 'pt',
            format: [size.width, size.height],
            compress: true,
          });
        } else {
          mergedPdf.addPage([size.width, size.height], orientation);
        }

        mergedPdf.addImage(jpegBuf, 'JPEG', 0, 0, size.width, size.height, undefined, 'FAST');

        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
      }

      if (mergedPdf) {
        const arrayBuf = mergedPdf.output('arraybuffer');
        if (arrayBuf.byteLength <= maxSizeBytes || idx === DPI_TIERS.length - 1) {
          finalBytes = arrayBuf;
          firstPagePreviewBlob = tierPreviewBlob;
          finalDpi = tier.dpi;
          withinLimit = arrayBuf.byteLength <= maxSizeBytes;
          break;
        }
      }
    }

    const outputs: PageOutput[] = [];
    if (finalBytes && firstPagePreviewBlob) {
      outputs.push({
        id: `${base}_merged_${crypto.randomUUID().slice(0, 6)}`,
        pageNum: 1,
        pageCount: totalPages,
        name: `${base}_optimized.pdf`,
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
