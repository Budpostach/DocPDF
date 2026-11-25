import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PreviewModal } from './components/PreviewModal';
import { QueuePanel } from './components/QueuePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { PrivacyPage, StandardsPage } from './components/StandardsSection';
import { translations } from './i18n/translations';
import {
  convertPdfDocument,
  downloadAllOutputsAsZip,
  isSupportedDocumentFile,
  revokeItemOutputs,
} from './services/pdfConverter';
import {
  AppPage,
  ConversionSettings,
  Language,
  PresetId,
  QueueFilter,
  QueueItem,
  ThemeMode,
} from './types/pdf';

const THEME_STORAGE_KEY = 'docgate_theme';

const PRESET_CONFIGS: Record<Exclude<PresetId, 'custom'>, Omit<ConversionSettings, 'preset'>> = {
  customs_strict: {
    outputMode: 'split',
    sizeLimitKb: 490,
    colorMode: 'grayscale',
  },
  bank_split: {
    outputMode: 'split',
    sizeLimitKb: 1900,
    colorMode: 'color',
  },
  bank_single: {
    outputMode: 'merged',
    sizeLimitKb: 4500,
    colorMode: 'bw_contrast',
  },
};

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return 'light';
}

function getPageFromHash(): AppPage {
  const hash = window.location.hash.toLowerCase();
  if (hash === '#standards') return 'standards';
  if (hash === '#privacy') return 'privacy';
  return 'files';
}

export default function App() {
  const [lang, setLang] = useState<Language>('ua');
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [activePage, setActivePage] = useState<AppPage>(getPageFromHash);
  const [settings, setSettings] = useState<ConversionSettings>({
    preset: 'customs_strict',
    ...PRESET_CONFIGS.customs_strict,
  });
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [busy, setBusy] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{ itemId: string; index: number } | null>(
    null,
  );

  const t = translations[lang];

  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(getPageFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage access restrictions
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang === 'ua' ? 'uk' : 'en';
    document.title =
      lang === 'ua'
        ? 'DocGate PDF — Конвертер документів для банків і митниці'
        : 'DocGate PDF — Bank & Customs PDF Converter';
  }, [lang]);

  const handleNavigate = (page: AppPage) => {
    setActivePage(page);
    const nextHash = page === 'files' ? '#files' : `#${page}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleSelectPreset = (preset: PresetId) => {
    if (busy) return;
    if (preset === 'custom') {
      setSettings((prev) => ({ ...prev, preset: 'custom' }));
      return;
    }
    setSettings({
      preset,
      ...PRESET_CONFIGS[preset],
    });
  };

  const handleUpdateSettings = (patch: Partial<ConversionSettings>) => {
    if (busy) return;
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const handleAddFiles = (files: File[]) => {
    if (busy) return;
    const validFiles = files.filter(isSupportedDocumentFile);
    if (validFiles.length === 0) return;

    const newItems: QueueItem[] = validFiles.map((file) => ({
      id: `${file.name}_${file.size}_${crypto.randomUUID().slice(0, 8)}`,
      file,
      status: 'wait',
      pages: 0,
      currentPage: 0,
      outputs: [],
      error: '',
    }));

    setQueue((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    if (busy) return;
    setQueue((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokeItemOutputs(target.outputs);
      return prev.filter((item) => item.id !== id);
    });
    if (previewTarget?.itemId === id) {
      setPreviewTarget(null);
    }
  };

  const handleClearQueue = () => {
    if (busy) return;
    setQueue((prev) => {
      prev.forEach((item) => revokeItemOutputs(item.outputs));
      return [];
    });
    setPreviewTarget(null);
    setFilter('all');
  };

  const runConversionForIds = async (targetIds: Set<string>, activeSettings: ConversionSettings) => {
    setBusy(true);
    try {
      for (const id of targetIds) {
        const currentItem = queue.find((q) => q.id === id);
        if (!currentItem) continue;

        revokeItemOutputs(currentItem.outputs);

        setQueue((prev) =>
          prev.map((q) =>
            q.id === id
              ? { ...q, status: 'working', error: '', currentPage: 0, outputs: [] }
              : q,
          ),
        );

        try {
          const result = await convertPdfDocument(
            currentItem.file,
            activeSettings,
            (currentPage, totalPages) => {
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === id ? { ...q, pages: totalPages, currentPage } : q,
                ),
              );
            },
          );

          setQueue((prev) =>
            prev.map((q) =>
              q.id === id
                ? {
                    ...q,
                    status: 'done',
                    pages: result.totalPages,
                    currentPage: result.totalPages,
                    outputs: result.outputs,
                    usedSettings: activeSettings,
                  }
                : q,
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setQueue((prev) =>
            prev.map((q) =>
              q.id === id ? { ...q, status: 'error', error: message } : q,
            ),
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConvertPending = async () => {
    if (busy) return;
    const pendingIds = new Set(queue.filter((q) => q.status !== 'done').map((q) => q.id));
    if (pendingIds.size === 0) return;
    await runConversionForIds(pendingIds, settings);
  };

  const handleReconvertItem = async (id: string) => {
    if (busy) return;
    await runConversionForIds(new Set([id]), settings);
  };

  const handleDownloadAllZip = async () => {
    if (busy) return;
    await downloadAllOutputsAsZip(queue);
  };

  const canConvert = queue.some((item) => item.status !== 'done');
  const previewItem = previewTarget
    ? queue.find((item) => item.id === previewTarget.itemId)
    : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-[#fafafa] dark:bg-[#0b0c0f] text-neutral-900 dark:text-neutral-100 transition-colors">
      <Header
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activePage={activePage}
        onNavigate={handleNavigate}
        t={t}
      />

      <main id="converter" className="flex-1">
        {activePage === 'files' && (
          <div className="max-w-[1280px] mx-auto px-5 sm:px-8 pt-8 pb-14 grid lg:grid-cols-12 gap-8 items-start">
            <QueuePanel
              queue={queue}
              filter={filter}
              onFilterChange={setFilter}
              onAddFiles={handleAddFiles}
              onRemoveItem={handleRemoveItem}
              onReconvertItem={handleReconvertItem}
              onPreviewOutput={(item, index) =>
                setPreviewTarget({ itemId: item.id, index })
              }
              onDownloadAllZip={handleDownloadAllZip}
              busy={busy}
              t={t}
            />

            <SettingsPanel
              settings={settings}
              onSelectPreset={handleSelectPreset}
              onUpdateSettings={handleUpdateSettings}
              onConvert={handleConvertPending}
              onClear={handleClearQueue}
              busy={busy}
              canConvert={canConvert}
              hasItems={queue.length > 0}
              t={t}
            />
          </div>
        )}

        {activePage === 'standards' && (
          <StandardsPage onBackToFiles={() => handleNavigate('files')} t={t} />
        )}

        {activePage === 'privacy' && (
          <PrivacyPage onBackToFiles={() => handleNavigate('files')} t={t} />
        )}
      </main>

      <Footer onNavigate={handleNavigate} t={t} />

      {previewItem && previewTarget && (
        <PreviewModal
          outputs={previewItem.outputs}
          activeIndex={previewTarget.index}
          onSelectIndex={(index) =>
            setPreviewTarget({ itemId: previewItem.id, index })
          }
          onClose={() => setPreviewTarget(null)}
          t={t}
        />
      )}
      <Analytics />
    </div>
  );
}
