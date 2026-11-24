import { Check, Trash2 } from 'lucide-react';
import { TranslationDict } from '../i18n/translations';
import {
  ColorMode,
  ConversionSettings,
  OutputMode,
  PresetId,
  SizeLimitKb,
} from '../types/pdf';

interface SettingsPanelProps {
  settings: ConversionSettings;
  onSelectPreset: (preset: PresetId) => void;
  onUpdateSettings: (patch: Partial<ConversionSettings>) => void;
  onConvert: () => void;
  onClear: () => void;
  busy: boolean;
  canConvert: boolean;
  hasItems: boolean;
  t: TranslationDict;
}

const PRESET_ORDER: PresetId[] = ['customs_strict', 'bank_split', 'bank_single', 'custom'];

export function SettingsPanel({
  settings,
  onSelectPreset,
  onUpdateSettings,
  onConvert,
  onClear,
  busy,
  canConvert,
  hasItems,
  t,
}: SettingsPanelProps) {
  return (
    <aside className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl p-5 space-y-5 transition-colors">
      <div>
        <span className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
          {t.presetsLabel}
        </span>
        <div className="space-y-1" role="group" aria-label={t.presetsLabel}>
          {PRESET_ORDER.map((presetId) => {
            const active = settings.preset === presetId;
            return (
              <button
                key={presetId}
                type="button"
                disabled={busy}
                onClick={() => onSelectPreset(presetId)}
                aria-pressed={active}
                title={t.presets[presetId].hint}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                  active
                    ? 'bg-[#2563eb]/[0.08] dark:bg-[#3b82f6]/15 text-[#1d4ed8] dark:text-[#60a5fa] font-semibold'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/[0.05]'
                }`}
              >
                <span className="truncate">{t.presets[presetId].label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-neutral-100 dark:border-white/[0.06] pt-4 space-y-4">
        <div>
          <span className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">
            {t.outputModeLabel}
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 dark:bg-white/[0.05] rounded-lg">
            {(['split', 'merged'] as OutputMode[]).map((mode) => {
              const active = settings.outputMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() => onUpdateSettings({ outputMode: mode, preset: 'custom' })}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                    active
                      ? 'bg-white dark:bg-[#1e2128] text-neutral-950 dark:text-white font-semibold shadow-2xs dark:shadow-none'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
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
            className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5"
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
            className="w-full h-9 bg-transparent border border-neutral-200 dark:border-white/[0.1] rounded-lg px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb] focus:outline-none disabled:opacity-50"
          >
            <option value={490} className="dark:bg-[#13151a]">
              {t.sizeLimits[490]}
            </option>
            <option value={950} className="dark:bg-[#13151a]">
              {t.sizeLimits[950]}
            </option>
            <option value={1900} className="dark:bg-[#13151a]">
              {t.sizeLimits[1900]}
            </option>
            <option value={4500} className="dark:bg-[#13151a]">
              {t.sizeLimits[4500]}
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="color-mode-select"
            className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5"
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
            className="w-full h-9 bg-transparent border border-neutral-200 dark:border-white/[0.1] rounded-lg px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-[#2563eb] focus:border-[#2563eb] focus:outline-none disabled:opacity-50"
          >
            <option value="grayscale" className="dark:bg-[#13151a]">
              {t.colorModes.grayscale}
            </option>
            <option value="bw_contrast" className="dark:bg-[#13151a]">
              {t.colorModes.bw_contrast}
            </option>
            <option value="color" className="dark:bg-[#13151a]">
              {t.colorModes.color}
            </option>
          </select>
        </div>
      </div>

      <div className="border-t border-neutral-100 dark:border-white/[0.06] pt-4 space-y-2">
        <button
          type="button"
          disabled={!canConvert || busy}
          onClick={onConvert}
          className="w-full h-10 px-4 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          {busy ? t.convertingBtn : t.convertBtn}
        </button>

        {hasItems && (
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="w-full h-9 px-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.clearBtn}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
