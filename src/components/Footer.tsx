import { Phone } from 'lucide-react';
import { TranslationDict } from '../i18n/translations';
import { AppPage } from '../types/pdf';

interface FooterProps {
  onNavigate: (page: AppPage) => void;
  t: TranslationDict;
}

const PHONES = [{ display: '+380660647854', href: 'tel:+380660647854' }];

export function Footer({ onNavigate, t }: FooterProps) {
  return (
    <footer className="border-t border-neutral-200/80 dark:border-white/[0.08] bg-[#fafafa] dark:bg-[#0b0c0f] transition-colors">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1.5">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">{t.footerCopy}</span>
          <span aria-hidden="true">·</span>
          <span>{t.footerNote}</span>
          <span className="sm:hidden inline-flex items-center gap-3 ml-1">
            <a
              href="#files"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('files');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
            >
              {t.navConverter}
            </a>
            <a
              href="#standards"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('standards');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
            >
              {t.navStandards}
            </a>
            <a
              href="#privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('privacy');
              }}
              className="hover:text-neutral-900 dark:hover:text-white underline underline-offset-2"
            >
              {t.navPrivacy}
            </a>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 tabular-nums">
            {PHONES.map((phone) => (
              <a
                key={phone.href}
                href={phone.href}
                className="inline-flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 hover:text-[#2563eb] dark:hover:text-white transition-colors font-mono text-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] rounded"
              >
                <Phone className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
                <span>{phone.display}</span>
              </a>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <a
              href="https://t.me/+380660647854"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              title="Telegram"
              className="w-8 h-8 rounded-full hover:bg-neutral-200/70 dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 hover:text-[#229ED9] dark:hover:text-[#38bdf8] inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </a>

            <a
              href="viber://chat?number=%2B380660647854"
              aria-label="Viber"
              title="Viber"
              className="w-8 h-8 rounded-full hover:bg-neutral-200/70 dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 hover:text-[#7360F2] dark:hover:text-[#9c8eff] inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.4 0C5.8 0 1.4 3.7 1.4 9.1c0 3.1 1.5 5.6 3.9 7.2v3.3c0 .4.5.7.8.4l2.7-2.2c.8.2 1.7.3 2.6.3 5.6 0 10.2-3.7 10.2-9C21.6 3.7 17 0 11.4 0zm4.9 12.9c-.2.6-1.2 1.1-1.7 1.2-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.2.5.8 1.9.8 2 .1.1.1.3 0 .5-.1.2-.2.3-.3.4-.2.2-.3.3-.4.5-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 .9.8 1.8 1.1 2.1 1.3.3.1.5.1.7-.1.2-.2.8-.9 1-1.2.2-.3.4-.2.7-.1.3.1 1.8.8 2.1 1 .3.2.5.2.6.4.1.2.1.8-.1 1.4zM12 4.3a4.3 4.3 0 0 1 4.2 4.2.5.5 0 0 1-1 0A3.3 3.3 0 0 0 12 5.3a.5.5 0 0 1 0-1zm0 1.8a2.5 2.5 0 0 1 2.4 2.4.5.5 0 0 1-1 0c0-.8-.6-1.4-1.4-1.4a.5.5 0 0 1 0-1z" />
              </svg>
            </a>

            <a
              href="https://wa.me/380660647854"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp"
              className="w-8 h-8 rounded-full hover:bg-neutral-200/70 dark:hover:bg-white/[0.08] text-neutral-500 dark:text-neutral-400 hover:text-[#16a34a] dark:hover:text-[#4ade80] inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.119.553 4.187 1.604 6.008L.056 23.694l5.792-1.519a11.983 11.983 0 0 0 6.183 1.714h.005c6.645 0 12.031-5.386 12.031-12.031C24.067 5.385 18.676 0 12.031 0zm6.991 17.105c-.296.832-1.737 1.594-2.404 1.693-.624.094-1.416.133-2.286-.144-.528-.168-1.207-.392-2.067-.765-3.635-1.57-6.008-5.236-6.189-5.477-.182-.241-1.477-1.964-1.477-3.748 0-1.783.934-2.66 1.265-3.021.331-.362.724-.452.965-.452.241 0 .483.002.694.013.222.011.521-.085.815.621.302.724 1.026 2.507 1.116 2.688.09.181.151.392.03.633-.121.241-.181.392-.362.603-.181.211-.381.472-.544.633-.181.181-.37.378-.159.74.211.362.938 1.547 2.014 2.506 1.384 1.234 2.55 1.617 2.912 1.798.362.181.573.151.784-.091.211-.241.904-1.055 1.145-1.417.241-.362.483-.302.815-.181.331.121 2.111.995 2.473 1.176.362.181.603.271.694.422.09.151.09.874-.206 1.706z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
