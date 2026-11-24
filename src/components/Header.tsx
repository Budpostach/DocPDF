import { Globe } from 'lucide-react';
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
    <header className="bg-[#18191d] border-b border-[#262930]">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-8">
        <a
          href="#converter"
          className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] rounded"
        >
          {!logoError ? (
            <img
              src="/BP_logo.jpg"
              alt={t.brandName}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-8 h-8 rounded-md object-cover border border-[#323640] shrink-0"
            />
          ) : (
            <svg
              width="32"
              height="32"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="28" height="28" rx="6" fill="#23262e" />
              <path
                d="M8.5 7.5H15.5L19.5 11.5V20.5H8.5V7.5Z"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M15 7.5V12H19.5"
                stroke="#2f95ff"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{t.brandName}</span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#a3aab8]">
          <a
            href="#converter"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] rounded"
          >
            {t.navConverter}
          </a>
          <a
            href="#standards"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] rounded"
          >
            {t.navStandards}
          </a>
          <a
            href="#privacy"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] rounded"
          >
            {t.navPrivacy}
          </a>
        </nav>

        <div
          className="inline-flex items-center gap-1 p-0.5 bg-[#121316] border border-[#2a2d36] rounded-md shrink-0"
          role="group"
          aria-label="Language"
        >
          <Globe className="w-3.5 h-3.5 text-[#7c8496] ml-2 mr-1" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onLangChange('ua')}
            aria-pressed={lang === 'ua'}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] ${
              lang === 'ua' ? 'bg-[#252831] text-white' : 'text-[#8c93a3] hover:text-white'
            }`}
          >
            UA
          </button>
          <button
            type="button"
            onClick={() => onLangChange('en')}
            aria-pressed={lang === 'en'}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f95ff] ${
              lang === 'en' ? 'bg-[#252831] text-white' : 'text-[#8c93a3] hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
