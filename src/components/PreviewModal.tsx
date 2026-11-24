import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useEffect } from 'react';
import { TranslationDict } from '../i18n/translations';
import { formatBytes, saveBlobAsFile } from '../services/pdfConverter';
import { PageOutput } from '../types/pdf';

interface PreviewModalProps {
  outputs: PageOutput[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onClose: () => void;
  t: TranslationDict;
}

export function PreviewModal({
  outputs,
  activeIndex,
  onSelectIndex,
  onClose,
  t,
}: PreviewModalProps) {
  const current = outputs[activeIndex];
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < outputs.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onSelectIndex(activeIndex - 1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        onSelectIndex(activeIndex + 1);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, hasNext, hasPrev, onClose, onSelectIndex]);

  if (!current) return null;

  const handleDownload = () => {
    saveBlobAsFile(new Blob([current.bytes], { type: 'application/pdf' }), current.name);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <div className="min-w-0">
            <h3
              id="preview-modal-title"
              className="font-bold text-sm text-slate-950 truncate"
            >
              {current.name}
            </h3>
            <p className="text-xs text-slate-600 tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>
                {current.isMergedDocument
                  ? `${t.mergedLabel} (${current.pageCount} ${t.allPagesLabel})`
                  : `${t.pageShort} ${current.pageNum}`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{formatBytes(current.bytes.byteLength)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{current.dpi} DPI</span>
              <span aria-hidden="true">·</span>
              <span className={current.withinLimit ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                {current.withinLimit ? t.withinLimitLabel : t.overLimitLabel}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {outputs.length > 1 && (
              <div className="inline-flex items-center gap-1 mr-1">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => onSelectIndex(activeIndex - 1)}
                  aria-label={t.prevPageBtn}
                  className="min-h-9 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => onSelectIndex(activeIndex + 1)}
                  aria-label={t.nextPageBtn}
                  className="min-h-9 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.downloadBtn}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.closeBtn}</span>
            </button>
          </div>
        </div>

        <div className="p-5 overflow-auto bg-slate-200 flex-1 flex items-center justify-center">
          <img
            src={current.previewUrl}
            alt={current.name}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[74vh] object-contain bg-white shadow-md border border-slate-300"
          />
        </div>
      </div>
    </div>
  );
}
