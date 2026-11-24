import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { TranslationDict } from '../i18n/translations';

interface SubPageProps {
  onBackToFiles: () => void;
  t: TranslationDict;
}

export function StandardsPage({ onBackToFiles, t }: SubPageProps) {
  return (
    <div className="max-w-[1360px] mx-auto px-5 sm:px-8 pt-5 pb-12 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#646d7e] dark:text-[#7c8496]">
          <button
            type="button"
            onClick={onBackToFiles}
            className="text-[#0284c7] dark:text-[#38bdf8] font-medium hover:underline cursor-pointer"
          >
            {t.workspaceTrailRoot}
          </button>
          <span aria-hidden="true">&gt;</span>
          <span className="text-[#454d5c] dark:text-[#9aa2b1]">{t.navStandards}</span>
        </div>

        <button
          type="button"
          onClick={onBackToFiles}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#d6dbe4] dark:border-[#2c303a] bg-white dark:bg-[#18191d] hover:bg-[#f1f3f6] dark:hover:bg-[#242832] text-xs font-semibold text-[#181b20] dark:text-[#eef0f4] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.backToFilesBtn}</span>
        </button>
      </div>

      <section className="bg-white dark:bg-[#18191d] border border-[#e2e5ec] dark:border-[#262930] rounded-lg p-5 sm:p-6 transition-colors">
        <div className="mb-5">
          <h1 className="text-lg sm:text-xl font-bold text-[#14171c] dark:text-white">
            {t.standardsTitle}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#5c6473] dark:text-[#8e96a6]">
            {t.standardsSubtitle}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-[#e2e5ec] dark:border-[#262930] text-xs font-semibold text-[#5c6473] dark:text-[#7c8496]">
                <th className="py-2.5 pr-4">{t.standardsCols.portal}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.standardsCols.limit}</th>
                <th className="py-2.5 px-4 whitespace-nowrap">{t.standardsCols.mode}</th>
                <th className="py-2.5 pl-4">{t.standardsCols.notes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedf3] dark:divide-[#22252d]">
              {t.standardsRows.map((row) => (
                <tr
                  key={row.portal}
                  className="hover:bg-[#f7f8fa] dark:hover:bg-[#1e2128] transition-colors"
                >
                  <td className="py-3.5 pr-4 font-semibold text-[#181b20] dark:text-[#eef0f4]">
                    {row.portal}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-[#0284c7] dark:text-[#38bdf8] whitespace-nowrap tabular-nums">
                    {row.limit}
                  </td>
                  <td className="py-3.5 px-4 text-[#3b4250] dark:text-[#c2c8d4] whitespace-nowrap">
                    {row.mode}
                  </td>
                  <td className="py-3.5 pl-4 text-[#5c6473] dark:text-[#8e96a6] leading-relaxed">
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
    <div className="max-w-[1360px] mx-auto px-5 sm:px-8 pt-5 pb-12 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#646d7e] dark:text-[#7c8496]">
          <button
            type="button"
            onClick={onBackToFiles}
            className="text-[#0284c7] dark:text-[#38bdf8] font-medium hover:underline cursor-pointer"
          >
            {t.workspaceTrailRoot}
          </button>
          <span aria-hidden="true">&gt;</span>
          <span className="text-[#454d5c] dark:text-[#9aa2b1]">{t.navPrivacy}</span>
        </div>

        <button
          type="button"
          onClick={onBackToFiles}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-[#d6dbe4] dark:border-[#2c303a] bg-white dark:bg-[#18191d] hover:bg-[#f1f3f6] dark:hover:bg-[#242832] text-xs font-semibold text-[#181b20] dark:text-[#eef0f4] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.backToFilesBtn}</span>
        </button>
      </div>

      <section className="bg-white dark:bg-[#18191d] border border-[#e2e5ec] dark:border-[#262930] rounded-lg p-5 sm:p-6 space-y-6 transition-colors">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#14171c] dark:text-white">
              {t.privacyTitle}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#5c6473] dark:text-[#8e96a6]">
              {t.localBanner}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 border-t border-[#eaedf3] dark:border-[#22252d] pt-6">
          {t.privacyPoints.map((point, idx) => (
            <div key={point.title} className="space-y-2">
              <h2 className="text-sm font-semibold text-[#181b20] dark:text-[#eef0f4]">
                0{idx + 1}. {point.title}
              </h2>
              <p className="text-xs sm:text-sm text-[#5c6473] dark:text-[#8e96a6] leading-relaxed">
                {point.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
