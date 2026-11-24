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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-[#13151a] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-white/[0.1] shadow-2xl">
        <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="preview-modal-title"
              className="font-semibold text-sm text-neutral-950 dark:text-white truncate"
            >
              {current.name}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>
                {current.isMergedDocument
                  ? `${t.mergedLabel} (${current.pageCount} ${t.allPagesLabel})`
                  : `${t.pageShort} ${current.pageNum}`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-neutral-800 dark:text-neutral-200">
                {formatBytes(current.bytes.byteLength)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{current.dpi} DPI</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  current.withinLimit
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-amber-600 dark:text-amber-400 font-medium'
                }
              >
                {current.withinLimit ? t.withinLimitLabel : t.overLimitLabel}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {outputs.length > 1 && (
              <div className="inline-flex items-center gap-1 mr-1">
                <button
                  type="button"
                  disabled={!hasPrev}
                  onClick={() => onSelectIndex(activeIndex - 1)}
                  aria-label={t.prevPageBtn}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={!hasNext}
                  onClick={() => onSelectIndex(activeIndex + 1)}
                  aria-label={t.nextPageBtn}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
                >
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.downloadBtn}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeBtn}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto bg-neutral-100 dark:bg-[#0b0c0f] flex-1 flex items-center justify-center">
          <img
            src={current.previewUrl}
            alt={current.name}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[74vh] object-contain bg-white rounded shadow-md"
          />
        </div>
      </div>
    </div>
  );
}
