import { TranslationDict } from '../i18n/translations';

interface StandardsSectionProps {
  t: TranslationDict;
}

export function StandardsSection({ t }: StandardsSectionProps) {
  return (
    <div className="max-w-[1360px] mx-auto px-5 sm:px-8 pb-12 space-y-8">
      <section
        id="standards"
        className="bg-white dark:bg-[#18191d] border border-[#e2e5ec] dark:border-[#262930] rounded-lg p-5 sm:p-6 scroll-mt-6 transition-colors"
      >
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-bold text-[#14171c] dark:text-white">
            {t.standardsTitle}
          </h2>
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
                  <td className="py-3 pr-4 font-semibold text-[#181b20] dark:text-[#eef0f4]">
                    {row.portal}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#0284c7] dark:text-[#38bdf8] whitespace-nowrap tabular-nums">
                    {row.limit}
                  </td>
                  <td className="py-3 px-4 text-[#3b4250] dark:text-[#c2c8d4] whitespace-nowrap">
                    {row.mode}
                  </td>
                  <td className="py-3 pl-4 text-[#5c6473] dark:text-[#8e96a6] leading-relaxed">
                    {row.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="privacy" className="border-t border-[#e2e5ec] dark:border-[#242730] pt-7 scroll-mt-6">
        <h2 className="text-base sm:text-lg font-bold text-[#14171c] dark:text-white mb-5">
          {t.privacyTitle}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {t.privacyPoints.map((point, idx) => (
            <div key={point.title} className="space-y-1.5">
              <h3 className="text-sm font-semibold text-[#181b20] dark:text-[#eef0f4]">
                0{idx + 1}. {point.title}
              </h3>
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
