import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudUpload,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
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

type ViewMode = 'list' | 'grid';

function MinimalFileIcon({ fileName }: { fileName: string }) {
  const fmt = getDocumentFormatLabel(fileName);
  if (fmt === 'XLSX' || fmt === 'XLS' || fmt === 'ODS' || fmt === 'CSV') {
    return (
      <FileSpreadsheet
        className="w-5 h-5 text-emerald-600/85 dark:text-emerald-400/90 shrink-0"
        aria-hidden="true"
      />
    );
  }
  if (fmt === 'DOC' || fmt === 'DOCX') {
    return (
      <FileText
        className="w-5 h-5 text-[#2563eb] dark:text-[#60a5fa] shrink-0"
        aria-hidden="true"
      />
    );
  }
  return (
    <FileText
      className="w-5 h-5 text-neutral-500 dark:text-neutral-400 shrink-0"
      aria-hidden="true"
    />
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isDragging, setIsDragging] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const counts = useMemo(() => {
    let pending = 0;
    let done = 0;
    for (const item of queue) {
      if (item.status === 'wait' || item.status === 'working') pending++;
      if (item.status === 'done') done++;
    }
    return { all: queue.length, pending, done };
  }, [queue]);

  const totalOutputs = queue.reduce((sum, item) => sum + item.outputs.length, 0);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return queue.filter((item) => {
      if (filter === 'pending' && item.status !== 'wait' && item.status !== 'working') {
        return false;
      }
      if (filter === 'done' && item.status !== 'done') {
        return false;
      }
      if (q && !item.file.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [queue, filter, search]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || busy) return;
    onAddFiles(Array.from(fileList));
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDownloadOutput = (out: PageOutput) => {
    saveBlobAsFile(new Blob([out.bytes], { type: 'application/pdf' }), out.name);
  };

  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      className={`lg:col-span-8 xl:col-span-9 flex flex-col min-w-0 relative rounded-2xl transition-colors ${
        isDragging ? 'ring-2 ring-[#2563eb] bg-[#2563eb]/[0.04]' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_TYPES}
        multiple
        disabled={busy}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="sr-only"
      />

      {/* Minimal Page Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {t.navConverter}
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t.localBanner}
          </p>
        </div>

        {/* Minimal Segmented Queue Filter */}
        <div
          className="inline-flex items-center p-1 bg-neutral-200/65 dark:bg-white/[0.06] rounded-lg self-start sm:self-auto"
          role="tablist"
          aria-label="Filter queue"
        >
          {(['all', 'pending', 'done'] as QueueFilter[]).map((key) => {
            const active = filter === key;
            const label =
              key === 'all' ? t.filterAll : key === 'pending' ? t.filterPending : t.filterDone;
            const count = counts[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                  active
                    ? 'bg-white dark:bg-[#1d2028] text-neutral-950 dark:text-white font-semibold shadow-2xs dark:shadow-none'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <span>{label}</span>
                <span className="tabular-nums text-[11px] opacity-65">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Minimalist Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 pb-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{t.addFilesBtn}</span>
        </button>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search
            className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="w-full h-9 pl-8 pr-8 bg-white dark:bg-[#13151a] border border-neutral-200 dark:border-white/[0.08] rounded-lg text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t.clearSearchLabel}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {totalOutputs > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={onDownloadAllZip}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white dark:bg-[#13151a] hover:bg-neutral-100 dark:hover:bg-white/[0.06] border border-neutral-200 dark:border-white/[0.08] text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <FolderArchive className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
              <span>{t.downloadAllBtn}</span>
            </button>
          )}

          <div
            className="inline-flex items-center p-0.5 bg-neutral-200/65 dark:bg-white/[0.06] rounded-lg shrink-0"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label={t.viewListLabel}
              aria-pressed={viewMode === 'list'}
              title={t.viewListLabel}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#1d2028] text-neutral-950 dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <List className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label={t.viewGridLabel}
              aria-pressed={viewMode === 'grid'}
              title={t.viewGridLabel}
              className={`h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#1d2028] text-neutral-950 dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {queue.length === 0 ? (
        <div
          onClick={() => !busy && fileInputRef.current?.click()}
          className="border border-dashed border-neutral-300 dark:border-white/[0.12] hover:border-[#2563eb]/70 dark:hover:border-[#3b82f6]/60 bg-white/70 dark:bg-white/[0.015] rounded-2xl py-20 px-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        >
          <CloudUpload
            className="w-8 h-8 text-neutral-400 dark:text-neutral-500 mb-3.5 stroke-[1.6]"
            aria-hidden="true"
          />
          <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-white">
            {t.emptyTitle}
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
            {t.emptyBody}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-5 h-9 px-4 rounded-lg border border-neutral-200 dark:border-white/[0.12] bg-white dark:bg-[#13151a] hover:bg-neutral-50 dark:hover:bg-white/[0.06] text-neutral-800 dark:text-neutral-100 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {t.emptyCta}
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl py-16 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {t.noSearchResults}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl divide-y divide-neutral-100 dark:divide-white/[0.06] overflow-hidden">
          {visibleItems.map((item) => {
            const progressPercent =
              item.pages > 0 ? Math.round((item.currentPage / item.pages) * 100) : 0;
            const totalOutBytes = item.outputs.reduce((acc, o) => acc + o.bytes.byteLength, 0);
            const hasMultipleOutputs = item.outputs.length > 1;
            const isExpanded = !collapsedIds[item.id];
            const singleOut = item.outputs.length === 1 ? item.outputs[0] : null;

            return (
              <div key={item.id}>
                <div className="py-3.5 px-4 hover:bg-neutral-50/80 dark:hover:bg-white/[0.025] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <MinimalFileIcon fileName={item.file.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {hasMultipleOutputs && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            aria-expanded={isExpanded}
                            className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <p
                          className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </p>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                        <span className="font-mono text-neutral-600 dark:text-neutral-300">
                          {getDocumentFormatLabel(item.file.name)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{formatBytes(item.file.size)}</span>
                        {item.pages > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.pages} {t.allPagesLabel}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        {item.status === 'wait' && (
                          <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {t.statusWait}
                          </span>
                        )}
                        {item.status === 'working' && (
                          <span className="inline-flex items-center gap-1.5 text-[#2563eb] dark:text-[#60a5fa]">
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            {t.statusWorking}
                            {item.pages > 0
                              ? ` (${t.pageProgress(item.currentPage, item.pages)})`
                              : '...'}
                          </span>
                        )}
                        {item.status === 'done' && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            {t.statusDone}
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                            {t.statusError}: {item.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-8 sm:pl-0">
                    {totalOutBytes > 0 && (
                      <div className="text-right mr-2.5 tabular-nums">
                        <div className="text-xs font-mono font-medium text-neutral-900 dark:text-neutral-100">
                          {formatBytes(totalOutBytes)}
                        </div>
                        {singleOut && (
                          <div className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                            {singleOut.dpi} DPI
                          </div>
                        )}
                        {hasMultipleOutputs && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="text-[11px] text-[#2563eb] dark:text-[#60a5fa] hover:underline cursor-pointer"
                          >
                            {t.outputsCount(item.outputs.length)}
                          </button>
                        )}
                      </div>
                    )}

                    {singleOut && (
                      <>
                        <button
                          type="button"
                          onClick={() => onPreviewOutput(item, 0)}
                          title={t.previewBtn}
                          aria-label={`${t.previewBtn}: ${singleOut.name}`}
                          className="h-8 px-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span className="hidden md:inline">{t.previewBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadOutput(singleOut)}
                          className="h-8 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t.downloadBtn}</span>
                        </button>
                      </>
                    )}

                    {(item.status === 'done' || item.status === 'error') && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onReconvertItem(item.id)}
                        title={t.reconvertBtn}
                        aria-label={`${t.reconvertBtn}: ${item.file.name}`}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.08] text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-45"
                      >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveItem(item.id)}
                      title={t.removeBtn}
                      aria-label={`${t.removeBtn}: ${item.file.name}`}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-45"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {item.status === 'working' && (
                  <div className="px-4 pb-3">
                    <div className="w-full h-1 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2563eb] transition-all duration-200"
                        style={{ width: `${Math.max(8, progressPercent)}%` }}
                      />
                    </div>
                  </div>
                )}

                {hasMultipleOutputs && isExpanded && (
                  <div className="bg-neutral-50/70 dark:bg-black/20 border-t border-neutral-100 dark:border-white/[0.05] divide-y divide-neutral-100 dark:divide-white/[0.05]">
                    {item.outputs.map((out, oi) => (
                      <div
                        key={out.id}
                        className="pl-12 pr-4 py-2.5 hover:bg-neutral-100/70 dark:hover:bg-white/[0.03] transition-colors flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText
                            className="w-3.5 h-3.5 text-neutral-400 shrink-0"
                            aria-hidden="true"
                          />
                          <span
                            className="text-xs text-neutral-700 dark:text-neutral-300 truncate"
                            title={out.name}
                          >
                            {out.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                            <span
                              className={
                                out.withinLimit
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {formatBytes(out.bytes.byteLength)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{out.dpi} DPI</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onPreviewOutput(item, oi)}
                              className="h-7 px-2 rounded-md hover:bg-neutral-200/70 dark:hover:bg-white/[0.08] text-neutral-600 dark:text-neutral-300 text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              <span>{t.previewBtn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadOutput(out)}
                              className="h-7 px-2.5 rounded-md bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Download className="w-3 h-3" aria-hidden="true" />
                              <span>{t.downloadBtn}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Clean Grid View */
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {visibleItems.flatMap((item) =>
            item.outputs.length > 0
              ? item.outputs.map((out, oi) => (
                  <div
                    key={out.id}
                    className="bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => onPreviewOutput(item, oi)}
                      className="group relative w-full h-40 bg-neutral-100/80 dark:bg-[#0b0c0f] rounded-lg overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={out.previewUrl}
                        alt={out.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.02]"
                      />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 bg-white dark:bg-[#181a20] text-neutral-900 dark:text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-opacity">
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.previewBtn}
                        </span>
                      </span>
                    </button>

                    <div className="space-y-2">
                      <p
                        className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate"
                        title={out.name}
                      >
                        {out.name}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <span
                          className={
                            out.withinLimit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {formatBytes(out.bytes.byteLength)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">{out.dpi} DPI</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadOutput(out)}
                        className="w-full h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.downloadBtn}</span>
                      </button>
                    </div>
                  </div>
                ))
              : [
                  <div
                    key={item.id}
                    className="bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MinimalFileIcon fileName={item.file.name} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mt-0.5">
                          {formatBytes(item.file.size)} ·{' '}
                          {item.status === 'working' ? t.statusWorking : t.statusWait}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveItem(item.id)}
                      className="h-8 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400 text-neutral-500 dark:text-neutral-400 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t.removeBtn}</span>
                    </button>
                  </div>,
                ],
          )}
        </div>
      )}

      {isDragging && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/90 dark:bg-[#0b0c0f]/90 border-2 border-dashed border-[#2563eb] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-neutral-900 dark:text-white">
            <CloudUpload className="w-8 h-8 text-[#2563eb] dark:text-[#60a5fa]" aria-hidden="true" />
            <span className="text-sm font-semibold">{t.dropOverlayTitle}</span>
          </div>
        </div>
      )}
    </section>
  );
}
