import { ArrowLeft } from 'lucide-react';
import { TranslationDict } from '../i18n/translations';

interface SubPageProps {
  onBackToFiles: () => void;
  t: TranslationDict;
}

export function StandardsPage({ onBackToFiles, t }: SubPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 pb-16 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {t.standardsTitle}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            {t.standardsSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToFiles}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-neutral-200 dark:border-white/[0.1] bg-white dark:bg-[#13151a] hover:bg-neutral-50 dark:hover:bg-white/[0.06] text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.backToFilesBtn}</span>
        </button>
      </div>

      <section className="bg-white dark:bg-[#13151a] border border-neutral-200/85 dark:border-white/[0.08] rounded-xl overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-neutral-200/80 dark:border-white/[0.08] text-xs font-medium text-neutral-500 dark:text-neutral-400">
                <th className="py-3.5 px-5">{t.standardsCols.portal}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{t.standardsCols.limit}</th>
                <th className="py-3.5 px-4 whitespace-nowrap">{t.standardsCols.mode}</th>
                <th className="py-3.5 px-5">{t.standardsCols.notes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
              {t.standardsRows.map((row) => (
                <tr
                  key={row.portal}
                  className="hover:bg-neutral-50/80 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-4 px-5 font-medium text-neutral-950 dark:text-neutral-100">
                    {row.portal}
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-[#2563eb] dark:text-[#60a5fa] whitespace-nowrap tabular-nums">
                    {row.limit}
                  </td>
                  <td className="py-4 px-4 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                    {row.mode}
                  </td>
                  <td className="py-4 px-5 text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function PrivacyPage({ onBackToFiles, t }: SubPageProps) {
  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-8 pb-16 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {t.privacyTitle}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            {t.localBanner}
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToFiles}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-neutral-200 dark:border-white/[0.1] bg-white dark:bg-[#13151a] hover:bg-neutral-50 dark:hover:bg-white/[0.06] text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.backToFilesBtn}</span>
        </button>
      </div>

      <section className="grid md:grid-cols-3 gap-8 border-t border-neutral-200/80 dark:border-white/[0.08] pt-8">
        {t.privacyPoints.map((point, idx) => (
          <div key={point.title} className="space-y-2.5">
            <span className="block font-mono text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
              0{idx + 1}
            </span>
            <h2 className="font-display text-base font-semibold text-neutral-950 dark:text-white">
              {point.title}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {point.desc}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
