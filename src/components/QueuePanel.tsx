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

function FileTypeBadgeIcon({ fileName }: { fileName: string }) {
  const fmt = getDocumentFormatLabel(fileName);
  if (fmt === 'XLSX' || fmt === 'XLS' || fmt === 'ODS' || fmt === 'CSV') {
    return (
      <div className="w-8 h-8 rounded bg-emerald-600/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center shrink-0">
        <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
      </div>
    );
  }
  if (fmt === 'DOC' || fmt === 'DOCX') {
    return (
      <div className="w-8 h-8 rounded bg-[#2f95ff]/20 border border-[#2f95ff]/35 text-[#58aaff] flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded bg-rose-600/20 border border-rose-500/35 text-rose-400 flex items-center justify-center shrink-0">
      <FileText className="w-4 h-4" aria-hidden="true" />
    </div>
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
      className={`lg:col-span-8 xl:col-span-9 flex flex-col min-w-0 relative rounded-lg transition-colors ${
        isDragging ? 'ring-2 ring-[#2f95ff] bg-[#181c24]' : ''
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

      {/* Top breadcrumb + FEX-style tab counters */}
      <div className="mb-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#7c8496]">
            <span className="text-[#38bdf8] font-medium">{t.workspaceTrailRoot}</span>
            <span aria-hidden="true">&gt;</span>
            <span className="text-[#9aa2b1]">{t.workspaceTrailActive}</span>
          </div>
          <span className="text-[#7c8496] hidden sm:inline">{t.localBanner}</span>
        </div>

        <div
          className="flex items-center gap-6"
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
                className={`inline-flex items-baseline gap-1.5 font-display text-sm sm:text-base transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] rounded ${
                  active ? 'text-white font-semibold' : 'text-[#8e96a6] hover:text-[#d0d6e0] font-medium'
                }`}
              >
                <span>{label}</span>
                <sup className="text-[11px] font-semibold text-[#38bdf8] tabular-nums">
                  {count}
                </sup>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action toolbar matching FEX.NET: Add button + Search + View switch + ZIP */}
      <div className="flex flex-wrap items-center gap-2.5 pb-3 border-b border-[#262930]">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[#2f95ff] hover:bg-[#1e85f2] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff]"
        >
          <CloudUpload className="w-4 h-4" aria-hidden="true" />
          <span>{t.addFilesBtn}</span>
        </button>

        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search
            className="w-3.5 h-3.5 text-[#7c8496] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className="w-full h-9 pl-8 pr-8 bg-[#1d2026] border border-[#2b2f38] rounded-md text-xs sm:text-sm text-[#eef0f4] placeholder:text-[#727a8c] focus:outline-none focus:border-[#2f95ff] focus:ring-1 focus:ring-[#2f95ff]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t.clearSearchLabel}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7c8496] hover:text-white p-0.5 rounded cursor-pointer"
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
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-[#1d2026] hover:bg-[#252932] border border-[#2f3440] text-[#eef0f4] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff]"
            >
              <FolderArchive className="w-3.5 h-3.5 text-[#38bdf8]" aria-hidden="true" />
              <span>{t.downloadAllBtn}</span>
            </button>
          )}

          <div
            className="inline-flex items-center p-0.5 bg-[#18191d] border border-[#2b2f38] rounded-md shrink-0"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label={t.viewListLabel}
              aria-pressed={viewMode === 'list'}
              title={t.viewListLabel}
              className={`h-8 w-8 inline-flex items-center justify-center rounded transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#262b35] text-amber-400'
                  : 'text-[#8e96a6] hover:text-white'
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
              className={`h-8 w-8 inline-flex items-center justify-center rounded transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#262b35] text-amber-400'
                  : 'text-[#8e96a6] hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Main file list or empty dropzone */}
      {queue.length === 0 ? (
        <div
          onClick={() => !busy && fileInputRef.current?.click()}
          className="mt-4 border border-dashed border-[#2d323d] hover:border-[#2f95ff]/70 bg-[#16181c] rounded-lg py-14 px-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        >
          <div className="w-12 h-12 rounded-lg bg-[#1e222a] border border-[#2b303b] flex items-center justify-center text-[#38bdf8] mb-3.5">
            <CloudUpload className="w-6 h-6" aria-hidden="true" />
          </div>
          <h2 className="font-display font-semibold text-base text-white">{t.emptyTitle}</h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#8e96a6] max-w-md">{t.emptyBody}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-5 h-9 px-5 rounded-md bg-[#2f95ff] hover:bg-[#1e85f2] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff]"
          >
            {t.emptyCta}
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#8e96a6]">{t.noSearchResults}</div>
      ) : viewMode === 'list' ? (
        <div className="divide-y divide-[#22252d]">
          {visibleItems.map((item) => {
            const progressPercent =
              item.pages > 0 ? Math.round((item.currentPage / item.pages) * 100) : 0;
            const totalOutBytes = item.outputs.reduce((acc, o) => acc + o.bytes.byteLength, 0);
            const hasMultipleOutputs = item.outputs.length > 1;
            const isExpanded = !collapsedIds[item.id];
            const singleOut = item.outputs.length === 1 ? item.outputs[0] : null;

            return (
              <div key={item.id}>
                <div className="py-2.5 px-2 hover:bg-[#1a1c22] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileTypeBadgeIcon fileName={item.file.name} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {hasMultipleOutputs && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            aria-expanded={isExpanded}
                            className="text-[#8e96a6] hover:text-white p-0.5 rounded cursor-pointer shrink-0"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                        <p
                          className="text-sm font-medium text-[#eef0f4] truncate"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </p>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#8e96a6] tabular-nums">
                        <span className="font-mono text-[#a3aab8]">
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
                          <span className="inline-flex items-center gap-1 text-[#9aa2b1]">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {t.statusWait}
                          </span>
                        )}
                        {item.status === 'working' && (
                          <span className="inline-flex items-center gap-1.5 text-[#38bdf8]">
                            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                            {t.statusWorking}
                            {item.pages > 0 ? ` (${t.pageProgress(item.currentPage, item.pages)})` : '...'}
                          </span>
                        )}
                        {item.status === 'done' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            {t.statusDone}
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="inline-flex items-center gap-1 text-rose-400">
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                            {t.statusError}: {item.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right column: tabular output size + inline 1-click actions */}
                  <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
                    {totalOutBytes > 0 && (
                      <div className="text-right mr-2 tabular-nums">
                        <div className="text-xs font-mono text-[#eef0f4]">
                          {formatBytes(totalOutBytes)}
                        </div>
                        {singleOut && (
                          <div className="text-[11px] font-mono text-[#7c8496]">
                            {singleOut.dpi} DPI
                          </div>
                        )}
                        {hasMultipleOutputs && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="text-[11px] text-[#38bdf8] hover:underline cursor-pointer"
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
                          className="h-8 px-2.5 rounded border border-[#2c303a] bg-[#18191d] hover:bg-[#242832] text-[#d0d6e0] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t.previewBtn}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadOutput(singleOut)}
                          className="h-8 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
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
                        className="h-8 w-8 inline-flex items-center justify-center rounded border border-[#2c303a] bg-[#18191d] hover:bg-[#242832] text-[#9aa2b1] hover:text-white transition-colors cursor-pointer disabled:opacity-45"
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
                      className="h-8 w-8 inline-flex items-center justify-center rounded border border-[#2c303a] bg-[#18191d] hover:bg-rose-500/15 hover:border-rose-500/40 text-[#9aa2b1] hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-45"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {item.status === 'working' && (
                  <div className="px-2 pb-2.5">
                    <div className="w-full h-1 bg-[#22252d] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#2f95ff] transition-all duration-200"
                        style={{ width: `${Math.max(8, progressPercent)}%` }}
                      />
                    </div>
                  </div>
                )}

                {hasMultipleOutputs && isExpanded && (
                  <div className="bg-[#15161a] border-t border-[#1e2128] divide-y divide-[#1e2128]">
                    {item.outputs.map((out, oi) => (
                      <div
                        key={out.id}
                        className="pl-12 pr-2 py-2 hover:bg-[#1a1d23] transition-colors flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                          <span className="text-xs text-[#d8dde6] truncate" title={out.name}>
                            {out.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-xs font-mono tabular-nums text-[#8e96a6] flex items-center gap-2">
                            <span className={out.withinLimit ? 'text-emerald-400' : 'text-amber-400'}>
                              {formatBytes(out.bytes.byteLength)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{out.dpi} DPI</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPreviewOutput(item, oi)}
                              className="h-7 px-2 rounded border border-[#2c303a] bg-[#18191d] hover:bg-[#242832] text-[#d0d6e0] text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" aria-hidden="true" />
                              <span>{t.previewBtn}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadOutput(out)}
                              className="h-7 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
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
        /* Optional Grid thumbnail view toggled from toolbar */
        <div className="pt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {visibleItems.flatMap((item) =>
            item.outputs.length > 0
              ? item.outputs.map((out, oi) => (
                  <div
                    key={out.id}
                    className="bg-[#18191d] border border-[#262930] rounded-lg p-3 flex flex-col justify-between gap-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => onPreviewOutput(item, oi)}
                      className="group relative w-full h-36 bg-[#101114] border border-[#262930] rounded overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={out.previewUrl}
                        alt={out.name}
                        referrerPolicy="no-referrer"
                        className="max-h-full max-w-full object-contain transition-transform duration-150 group-hover:scale-[1.03]"
                      />
                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 bg-[#18191d] border border-[#323640] text-white text-xs font-semibold px-2.5 py-1 rounded transition-opacity">
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          {t.previewBtn}
                        </span>
                      </span>
                    </button>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#eef0f4] truncate" title={out.name}>
                        {out.name}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <span className={out.withinLimit ? 'text-emerald-400' : 'text-amber-400'}>
                          {formatBytes(out.bytes.byteLength)}
                        </span>
                        <span className="text-[#8e96a6]">{out.dpi} DPI</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownloadOutput(out)}
                        className="w-full h-8 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
                    className="bg-[#18191d] border border-[#262930] rounded-lg p-3.5 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileTypeBadgeIcon fileName={item.file.name} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#eef0f4] truncate">
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-[#8e96a6] font-mono tabular-nums">
                          {formatBytes(item.file.size)} ·{' '}
                          {item.status === 'working' ? t.statusWorking : t.statusWait}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemoveItem(item.id)}
                      className="h-8 rounded border border-[#2c303a] hover:bg-rose-500/15 hover:text-rose-400 text-[#9aa2b1] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
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
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-[#121620]/85 border-2 border-dashed border-[#2f95ff] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white">
            <CloudUpload className="w-8 h-8 text-[#38bdf8]" aria-hidden="true" />
            <span className="text-sm font-semibold">{t.dropOverlayTitle}</span>
          </div>
        </div>
      )}
    </section>
  );
}
