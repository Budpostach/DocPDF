import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  FolderArchive,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useRef } from 'react';
import { TranslationDict } from '../i18n/translations';
import {
  ACCEPTED_DOCUMENT_TYPES,
  formatBytes,
  getDocumentFormatLabel,
  saveBlobAsFile,
} from '../services/pdfConverter';
import { PageOutput, QueueFilter, QueueItem } from '../types/pdf';

interface QueuePanelProps {
  queue: QueueItem[];
  filter: QueueFilter;
  onFilterChange: (filter: QueueFilter) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onReconvertItem: (id: string) => void;
  onPreviewOutput: (item: QueueItem, outputIndex: number) => void;
  onDownloadAllZip: () => void;
  busy: boolean;
  t: TranslationDict;
}

export function QueuePanel({
  queue,
  filter,
  onFilterChange,
  onAddFiles,
  onRemoveItem,
  onReconvertItem,
  onPreviewOutput,
  onDownloadAllZip,
  busy,
  t,
}: QueuePanelProps) {
  const emptyInputRef = useRef<HTMLInputElement>(null);

  const totalOutputs = queue.reduce((sum, item) => sum + item.outputs.length, 0);
  const totalPages = queue.reduce((sum, item) => sum + item.pages, 0);
  const totalOutputBytes = queue.reduce(
    (sum, item) => sum + item.outputs.reduce((acc, out) => acc + out.bytes.byteLength, 0),
    0,
  );
  const totalInputBytesForDone = queue
    .filter((item) => item.status === 'done')
    .reduce((sum, item) => sum + item.file.size, 0);

  const visibleItems = queue.filter((item) => {
    if (filter === 'pending') return item.status === 'wait' || item.status === 'working';
    if (filter === 'done') return item.status === 'done';
    return true;
  });

  const handleDownloadOutput = (out: PageOutput) => {
    saveBlobAsFile(new Blob([out.bytes], { type: 'application/pdf' }), out.name);
  };

  return (
    <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="font-bold text-lg text-slate-950">{t.queueTitle}</h2>
          {queue.length > 0 && (
            <p className="mt-1 text-xs text-slate-500 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{t.statsFiles(queue.length)}</span>
              {totalPages > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{t.statsPages(totalPages)}</span>
                </>
              )}
              {totalOutputBytes > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-700">{formatBytes(totalOutputBytes)}</span>
                  {totalInputBytesForDone > 0 && totalOutputBytes < totalInputBytesForDone && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 font-medium">
                        -{Math.round((1 - totalOutputBytes / totalInputBytesForDone) * 100)}%{' '}
                        {t.savedLabel.toLowerCase()}
                      </span>
                    </>
                  )}
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {queue.length > 1 && (
            <div
              className="inline-flex items-center p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="Filter queue"
            >
              {(['all', 'pending', 'done'] as QueueFilter[]).map((key) => {
                const active = filter === key;
                const label =
                  key === 'all' ? t.filterAll : key === 'pending' ? t.filterPending : t.filterDone;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFilterChange(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      active
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {totalOutputs > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onDownloadAllZip}
              className="inline-flex items-center gap-2 min-h-10 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <FolderArchive className="w-4 h-4" aria-hidden="true" />
              <span>{t.downloadAllBtn}</span>
            </button>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
            <FileText className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-base text-slate-900">{t.emptyTitle}</h3>
          <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed">{t.emptyBody}</p>
          <input
            ref={emptyInputRef}
            type="file"
            accept={ACCEPTED_DOCUMENT_TYPES}
            multiple
            onChange={(e) => {
              if (e.target.files) {
                onAddFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => emptyInputRef.current?.click()}
            className="mt-5 min-h-10 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {t.emptyCta}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {visibleItems.map((item) => {
            const progressPercent =
              item.pages > 0 ? Math.round((item.currentPage / item.pages) * 100) : 0;

            return (
              <article key={item.id} className="py-5 first:pt-5 last:pb-1 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-sm text-slate-950 break-all">
                      {item.file.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 tabular-nums">
                      <span className="font-mono font-medium text-slate-700">
                        {getDocumentFormatLabel(item.file.name)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatBytes(item.file.size)}</span>
                      {item.pages > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {t.pagesLabel}: {item.pages}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      {item.status === 'wait' && (
                        <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.statusWait}
                        </span>
                      )}
                      {item.status === 'working' && (
                        <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                          {t.statusWorking}
                          {item.pages > 0
                            ? ` (${t.pageProgress(item.currentPage, item.pages)})`
                            : '...'}
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.statusDone}
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.statusError}: {item.error}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(item.status === 'done' || item.status === 'error') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReconvertItem(item.id)}
                        title={t.reconvertBtn}
                        className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.reconvertBtn}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`${t.removeBtn}: ${item.file.name}`}
                      className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.removeBtn}</span>
                    </button>
                  </div>
                </div>

                {item.status === 'working' && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-700 transition-all duration-200"
                      style={{ width: `${Math.max(8, progressPercent)}%` }}
                    />
                  </div>
                )}

                {item.outputs.length > 0 && (
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 pt-1">
                    {item.outputs.map((out, oi) => (
                      <div
                        key={out.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => onPreviewOutput(item, oi)}
                          className="group relative w-full h-40 bg-white border border-slate-200 rounded-md overflow-hidden flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                          <img
                            src={out.previewUrl}
                            alt={out.name}
                            referrerPolicy="no-referrer"
                            className="max-h-full max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.03]"
                          />
                          <span className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/35 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 bg-white text-slate-950 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition-opacity">
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              {t.previewBtn}
                            </span>
                          </span>
                        </button>

                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="text-xs font-semibold text-slate-900 truncate"
                              title={out.name}
                            >
                              {out.isMergedDocument
                                ? `${t.mergedLabel} (${out.pageCount} ${t.allPagesLabel})`
                                : `${t.pageShort} ${out.pageNum}`}
                            </p>
                            <p className="text-[11px] font-mono tabular-nums text-slate-600 mt-0.5 flex items-center gap-1.5">
                              <span
                                className={
                                  out.withinLimit ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'
                                }
                              >
                                {formatBytes(out.bytes.byteLength)}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{out.dpi} DPI</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadOutput(out)}
                            className="inline-flex items-center gap-1 min-h-9 px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>{t.downloadBtn}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
