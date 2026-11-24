import { ShieldCheck, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { TranslationDict } from '../i18n/translations';
import { ColorMode, ConversionSettings, OutputMode, SizeLimitKb } from '../types/pdf';

interface SettingsPanelProps {
  settings: ConversionSettings;
  onUpdateSettings: (patch: Partial<ConversionSettings>) => void;
  onAddFiles: (files: File[]) => void;
  onConvert: () => void;
  onClear: () => void;
  busy: boolean;
  canConvert: boolean;
  hasItems: boolean;
  t: TranslationDict;
}

export function SettingsPanel({
  settings,
  onUpdateSettings,
  onAddFiles,
  onConvert,
  onClear,
  busy,
  canConvert,
  hasItems,
  t,
}: SettingsPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || busy) return;
    onAddFiles(Array.from(fileList));
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <aside className="lg:col-span-4 space-y-3.5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex items-center gap-3.5 bg-white border-2 border-dashed rounded-xl p-3.5 text-left transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-600 ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 hover:border-slate-400'
        } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          disabled={busy}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
          <Upload className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug">
            {t.uploadTitle}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 truncate" title={t.uploadSubtitle}>
            {t.uploadSubtitle}
          </p>
        </div>
        <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0">
          {t.uploadButton}
        </span>
      </label>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
        <h2 className="font-bold text-sm text-slate-950">{t.settingsTitle}</h2>

        <div>
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">
            {t.outputModeLabel}
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            {(['split', 'merged'] as OutputMode[]).map((mode) => {
              const active = settings.outputMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() => onUpdateSettings({ outputMode: mode, preset: 'custom' })}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    active
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {mode === 'split' ? t.outputModes.split : t.outputModes.merged}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="size-limit-select"
            className="block text-xs font-semibold text-slate-600 mb-1"
          >
            {t.sizeLimitLabel}
          </label>
          <select
            id="size-limit-select"
            disabled={busy}
            value={settings.sizeLimitKb}
            onChange={(e) =>
              onUpdateSettings({
                sizeLimitKb: Number(e.target.value) as SizeLimitKb,
                preset: 'custom',
              })
            }
            className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none disabled:opacity-55"
          >
            <option value={490}>{t.sizeLimits[490]}</option>
            <option value={950}>{t.sizeLimits[950]}</option>
            <option value={1900}>{t.sizeLimits[1900]}</option>
            <option value={4500}>{t.sizeLimits[4500]}</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="color-mode-select"
            className="block text-xs font-semibold text-slate-600 mb-1"
          >
            {t.colorModeLabel}
          </label>
          <select
            id="color-mode-select"
            disabled={busy}
            value={settings.colorMode}
            onChange={(e) =>
              onUpdateSettings({
                colorMode: e.target.value as ColorMode,
                preset: 'custom',
              })
            }
            className="w-full h-9 bg-slate-50 border border-slate-300 rounded-lg px-2.5 text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 focus:outline-none disabled:opacity-55"
          >
            <option value="grayscale">{t.colorModes.grayscale}</option>
            <option value="bw_contrast">{t.colorModes.bw_contrast}</option>
            <option value="color">{t.colorModes.color}</option>
          </select>
        </div>

        <dl className="pt-2.5 border-t border-slate-200 space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">{t.specResolution}</dt>
            <dd className="font-medium text-slate-900 tabular-nums">{t.specResolutionVal}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">{t.specPrivacy}</dt>
            <dd className="font-medium text-emerald-700 tabular-nums">{t.specPrivacyVal}</dd>
          </div>
        </dl>

        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            disabled={!canConvert || busy}
            onClick={onConvert}
            className="flex-1 min-h-10 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {busy ? t.convertingBtn : t.convertBtn}
          </button>

          <button
            type="button"
            disabled={!hasItems || busy}
            onClick={onClear}
            className="min-h-10 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {t.clearBtn}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2 px-1 text-[11px] text-slate-500 leading-snug">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
        <p>{t.localBadge}</p>
      </div>
    </aside>
  );
}
