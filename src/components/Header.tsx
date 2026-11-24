import { Moon, Sun } from 'lucide-react';
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
    <header className="sticky top-0 z-30 bg-[#fafafa]/85 dark:bg-[#0b0c0f]/85 backdrop-blur-md border-b border-neutral-200/80 dark:border-white/[0.08] transition-colors">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#files"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('files');
          }}
          className="inline-flex items-center gap-2.5 font-display text-base font-semibold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded-lg"
        >
          {!logoError ? (
            <img
              src="/BP_logo.jpg"
              alt={t.brandName}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-7 h-7 rounded-md object-cover shrink-0"
            />
          ) : (
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect width="28" height="28" rx="7" fill="#18181b" />
              <path
                d="M8.5 7.5H15.5L19.5 11.5V20.5H8.5V7.5Z"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M15 7.5V12H19.5"
                stroke="#3b82f6"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span>{t.brandName}</span>
        </a>

        <nav className="hidden sm:flex items-center gap-7 text-sm">
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
                className={`relative py-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded ${
                  isActive
                    ? 'text-neutral-950 dark:text-white font-semibold'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#2563eb] dark:bg-[#3b82f6] rounded-full"
                  />
                )}
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            title={theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            className="h-9 px-2.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/[0.07] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="hidden md:inline">
              {theme === 'light' ? t.darkThemeLabel : t.lightThemeLabel}
            </span>
          </button>

          <div
            className="inline-flex items-center p-0.5 bg-neutral-200/70 dark:bg-white/[0.06] rounded-lg shrink-0"
            role="group"
            aria-label="Language"
          >
            <button
              type="button"
              onClick={() => onLangChange('ua')}
              aria-pressed={lang === 'ua'}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                lang === 'ua'
                  ? 'bg-white dark:bg-[#1e2128] text-neutral-950 dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              UA
            </button>
            <button
              type="button"
              onClick={() => onLangChange('en')}
              aria-pressed={lang === 'en'}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
                lang === 'en'
                  ? 'bg-white dark:bg-[#1e2128] text-neutral-950 dark:text-white shadow-2xs dark:shadow-none'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
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
