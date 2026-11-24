import { TranslationDict } from '../i18n/translations';
import { PresetId } from '../types/pdf';

interface WorkspaceToolbarProps {
  activePreset: PresetId;
  onSelectPreset: (preset: PresetId) => void;
  disabled: boolean;
  t: TranslationDict;
}

const PRESET_ORDER: PresetId[] = ['customs_strict', 'bank_split', 'bank_single', 'custom'];

export function WorkspaceToolbar({
  activePreset,
  onSelectPreset,
  disabled,
  t,
}: WorkspaceToolbarProps) {
  return (
    <section className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-4 pb-4">
      <div className="max-w-3xl">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 text-balance">
          {t.heroTitle}
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-snug">
          {t.heroSubtitle}
        </p>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
        <span className="text-xs font-medium text-slate-500 whitespace-nowrap shrink-0">
          {t.presetsLabel}
        </span>
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-xl"
          role="group"
          aria-label={t.presetsLabel}
        >
          {PRESET_ORDER.map((presetId) => {
            const isActive = activePreset === presetId;
            return (
              <button
                key={presetId}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPreset(presetId)}
                aria-pressed={isActive}
                title={t.presets[presetId].hint}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/50'
                }`}
              >
                {t.presets[presetId].label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
