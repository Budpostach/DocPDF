import { ShieldCheck, Trash2 } from 'lucide-react';
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
    <aside className="lg:col-span-4 xl:col-span-3 bg-white dark:bg-[#18191d] border border-[#e2e5ec] dark:border-[#262930] rounded-lg p-4 space-y-4 transition-colors">
      <div>
        <span className="block text-xs font-semibold text-[#525b6c] dark:text-[#9aa2b1] mb-2">
          {t.presetsLabel}
        </span>
        <div className="grid grid-cols-1 gap-1.5" role="group" aria-label={t.presetsLabel}>
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
                className={`w-full text-left px-3 py-2 rounded-md border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] ${
                  active
                    ? 'bg-[#eef6ff] dark:bg-[#222731] border-[#2285ee] dark:border-[#2f95ff]/70 text-[#0f172a] dark:text-white font-semibold'
                    : 'bg-[#f8f9fb] dark:bg-[#121316] border-[#dfe3ec] dark:border-[#262930] text-[#454d5c] dark:text-[#b4bccb] hover:text-[#14171c] dark:hover:text-white hover:border-[#c8cedb] dark:hover:border-[#353a46]'
                }`}
              >
                <span className="truncate">{t.presets[presetId].label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#e6e9f0] dark:border-[#262930] pt-4 space-y-3.5">
        <div>
          <span className="block text-xs font-semibold text-[#525b6c] dark:text-[#9aa2b1] mb-1.5">
            {t.outputModeLabel}
          </span>
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#f1f3f6] dark:bg-[#121316] border border-[#dfe3ec] dark:border-[#262930] rounded-md">
            {(['split', 'merged'] as OutputMode[]).map((mode) => {
              const active = settings.outputMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  onClick={() => onUpdateSettings({ outputMode: mode, preset: 'custom' })}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] ${
                    active
                      ? 'bg-white dark:bg-[#262b35] text-[#14171c] dark:text-white shadow-2xs dark:shadow-none'
                      : 'text-[#5c6473] dark:text-[#8e96a6] hover:text-[#14171c] dark:hover:text-white'
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
            className="block text-xs font-semibold text-[#525b6c] dark:text-[#9aa2b1] mb-1.5"
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
            className="w-full h-9 bg-[#f8f9fb] dark:bg-[#121316] border border-[#d6dbe4] dark:border-[#2c303a] rounded-md px-2.5 text-xs text-[#181b20] dark:text-[#eef0f4] focus:ring-2 focus:ring-[#2285ee] focus:border-[#2285ee] focus:outline-none disabled:opacity-50"
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
            className="block text-xs font-semibold text-[#525b6c] dark:text-[#9aa2b1] mb-1.5"
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
            className="w-full h-9 bg-[#f8f9fb] dark:bg-[#121316] border border-[#d6dbe4] dark:border-[#2c303a] rounded-md px-2.5 text-xs text-[#181b20] dark:text-[#eef0f4] focus:ring-2 focus:ring-[#2285ee] focus:border-[#2285ee] focus:outline-none disabled:opacity-50"
          >
            <option value="grayscale">{t.colorModes.grayscale}</option>
            <option value="bw_contrast">{t.colorModes.bw_contrast}</option>
            <option value="color">{t.colorModes.color}</option>
          </select>
        </div>
      </div>

      <div className="border-t border-[#e6e9f0] dark:border-[#262930] pt-4 space-y-2">
        <button
          type="button"
          disabled={!canConvert || busy}
          onClick={onConvert}
          className="w-full min-h-10 px-4 py-2 rounded-md bg-[#2285ee] hover:bg-[#1673d8] text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee]"
        >
          {busy ? t.convertingBtn : t.convertBtn}
        </button>

        {hasItems && (
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="w-full min-h-9 px-3 py-1.5 rounded-md border border-[#d6dbe4] dark:border-[#2c303a] bg-transparent hover:bg-[#f1f3f6] dark:hover:bg-[#21242c] text-[#525b6c] dark:text-[#a3aab8] hover:text-[#14171c] dark:hover:text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee]"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.clearBtn}</span>
          </button>
        )}
      </div>

      <div className="border-t border-[#e6e9f0] dark:border-[#262930] pt-3">
        <div className="flex items-start gap-2 text-[11px] text-[#5c6473] dark:text-[#7c8496] leading-snug">
          <ShieldCheck
            className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p>{t.localBadge}</p>
        </div>
      </div>
    </aside>
  );
}
