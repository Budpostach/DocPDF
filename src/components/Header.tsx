import { useState } from 'react';
import { TranslationDict } from '../i18n/translations';
import { Language } from '../types/pdf';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  t: TranslationDict;
}

export function Header({ lang, onLangChange, t }: HeaderProps) {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#converter"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
        >
          {!logoError ? (
            <img
              src="/BP_logo.jpg"
              alt={t.brandName}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
            />
          ) : (
            <svg
              width="36"
              height="36"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="28" height="28" rx="6" fill="#0F172A" />
              <path
                d="M8.5 7.5H15.5L19.5 11.5V20.5H8.5V7.5Z"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M15 7.5V12H19.5"
                stroke="#60A5FA"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path d="M11 15.5H17" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M11 18H15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          <span>{t.brandName}</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#converter"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            {t.navConverter}
          </a>
          <a
            href="#standards"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            {t.navStandards}
          </a>
          <a
            href="#privacy"
            className="hover:text-slate-950 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            {t.navPrivacy}
          </a>
        </nav>

        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0"
          role="group"
          aria-label="Language"
        >
          <button
            type="button"
            onClick={() => onLangChange('ua')}
            aria-pressed={lang === 'ua'}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              lang === 'ua'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            UA
          </button>
          <button
            type="button"
            onClick={() => onLangChange('en')}
            aria-pressed={lang === 'en'}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              lang === 'en'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
