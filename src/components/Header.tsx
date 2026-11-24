import { Globe, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { TranslationDict } from '../i18n/translations';
import { AppPage, Language, ThemeMode } from '../types/pdf';

interface HeaderProps {
  lang: Language;
  onLangChange: (lang: Language) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  t: TranslationDict;
}

export function Header({
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  activePage,
  onNavigate,
  t,
}: HeaderProps) {
  const [logoError, setLogoError] = useState(false);

  const navItems: Array<{ page: AppPage; href: string; label: string }> = [
    { page: 'files', href: '#files', label: t.navConverter },
    { page: 'standards', href: '#standards', label: t.navStandards },
    { page: 'privacy', href: '#privacy', label: t.navPrivacy },
  ];

  return (
    <header className="bg-white dark:bg-[#18191d] border-b border-[#e2e5ec] dark:border-[#262930] transition-colors">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-4 sm:gap-8">
        <a
          href="#files"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('files');
          }}
          className="inline-flex items-center gap-2.5 font-display text-base sm:text-lg font-bold tracking-tight text-[#14171c] dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] rounded"
        >
          {!logoError ? (
            <img
              src="/BP_logo.jpg"
              alt={t.brandName}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-8 h-8 rounded-md object-cover border border-[#dce0e8] dark:border-[#323640] shrink-0"
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

        <nav className="hidden sm:flex items-center gap-7 text-sm font-medium">
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <a
                key={item.page}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.page);
                }}
                className={`transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] rounded py-1 ${
                  isActive
                    ? 'text-[#14171c] dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#2285ee]'
                    : 'text-[#525b6c] dark:text-[#a3aab8] hover:text-[#14171c] dark:hover:text-white'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            title={theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            className="h-8 px-2.5 rounded-md bg-[#f1f3f6] dark:bg-[#121316] hover:bg-[#e6e9f0] dark:hover:bg-[#21242c] border border-[#dce0e8] dark:border-[#2a2d36] text-xs font-medium text-[#181b20] dark:text-[#eef0f4] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee]"
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 text-[#0284c7] shrink-0" aria-hidden="true" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden md:inline">
              {theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            </span>
          </button>

          <div
            className="inline-flex items-center gap-1 p-0.5 bg-[#f1f3f6] dark:bg-[#121316] border border-[#dce0e8] dark:border-[#2a2d36] rounded-md shrink-0"
            role="group"
            aria-label="Language"
          >
            <Globe className="w-3.5 h-3.5 text-[#646d7e] dark:text-[#7c8496] ml-2 mr-1" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onLangChange('ua')}
              aria-pressed={lang === 'ua'}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] ${
                lang === 'ua'
                  ? 'bg-white dark:bg-[#252831] text-[#14171c] dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-[#5c6473] dark:text-[#8c93a3] hover:text-[#14171c] dark:hover:text-white'
              }`}
            >
              UA
            </button>
            <button
              type="button"
              onClick={() => onLangChange('en')}
              aria-pressed={lang === 'en'}
              className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2285ee] ${
                lang === 'en'
                  ? 'bg-white dark:bg-[#252831] text-[#14171c] dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-[#5c6473] dark:text-[#8c93a3] hover:text-[#14171c] dark:hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
