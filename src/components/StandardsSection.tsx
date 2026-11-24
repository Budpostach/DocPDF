import { TranslationDict } from '../i18n/translations';

interface StandardsSectionProps {
  t: TranslationDict;
}

export function StandardsSection({ t }: StandardsSectionProps) {
  return (
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pb-12 space-y-10">
      <section
        id="standards"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 scroll-mt-6"
      >
        <div className="max-w-2xl mb-6">
          <h2 className="text-xl font-bold text-slate-950">{t.standardsTitle}</h2>
          <p className="mt-1.5 text-sm text-slate-600">{t.standardsSubtitle}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-3 pr-4">{t.standardsCols.portal}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.standardsCols.limit}</th>
                <th className="py-3 px-4 whitespace-nowrap">{t.standardsCols.mode}</th>
                <th className="py-3 pl-4">{t.standardsCols.notes}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {t.standardsRows.map((row) => (
                <tr key={row.portal} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 pr-4 font-semibold text-slate-900">{row.portal}</td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-800 whitespace-nowrap tabular-nums">
                    {row.limit}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">{row.mode}</td>
                  <td className="py-3.5 pl-4 text-slate-600 leading-relaxed">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="privacy" className="border-t border-slate-200 pt-8 scroll-mt-6">
        <h2 className="text-xl font-bold text-slate-950 mb-6">{t.privacyTitle}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {t.privacyPoints.map((point, idx) => (
            <div key={point.title} className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                0{idx + 1}. {point.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{point.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
