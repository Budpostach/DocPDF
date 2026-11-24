import { Language, PresetId } from '../types/pdf';

export interface TranslationDict {
  brandName: string;
  navConverter: string;
  navStandards: string;
  navPrivacy: string;
  darkThemeLabel: string;
  lightThemeLabel: string;
  workspaceTrailRoot: string;
  workspaceTrailActive: string;
  localBanner: string;
  presetsLabel: string;
  presets: Record<
    PresetId,
    {
      label: string;
      hint: string;
    }
  >;
  addFilesBtn: string;
  searchPlaceholder: string;
  clearSearchLabel: string;
  viewListLabel: string;
  viewGridLabel: string;
  dropOverlayTitle: string;
  localBadge: string;
  settingsTitle: string;
  outputModeLabel: string;
  outputModes: {
    split: string;
    merged: string;
  };
  sizeLimitLabel: string;
  sizeLimits: {
    490: string;
    950: string;
    1900: string;
    4500: string;
  };
  colorModeLabel: string;
  colorModes: {
    grayscale: string;
    bw_contrast: string;
    color: string;
  };
  convertBtn: string;
  convertingBtn: string;
  clearBtn: string;
  downloadAllBtn: string;
  filterAll: string;
  filterPending: string;
  filterDone: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
  noSearchResults: string;
  statusWait: string;
  statusWorking: string;
  statusDone: string;
  statusError: string;
  pagesLabel: string;
  pageShort: string;
  mergedLabel: string;
  allPagesLabel: string;
  pageProgress: (current: number, total: number) => string;
  withinLimitLabel: string;
  overLimitLabel: string;
  savedLabel: string;
  previewBtn: string;
  downloadBtn: string;
  removeBtn: string;
  reconvertBtn: string;
  closeBtn: string;
  prevPageBtn: string;
  nextPageBtn: string;
  outputsCount: (n: number) => string;
  statsFiles: (n: number) => string;
  statsPages: (n: number) => string;
  standardsTitle: string;
  standardsSubtitle: string;
  standardsCols: {
    portal: string;
    limit: string;
    mode: string;
    notes: string;
  };
  standardsRows: Array<{
    portal: string;
    limit: string;
    mode: string;
    notes: string;
  }>;
  privacyTitle: string;
  privacyPoints: Array<{
    title: string;
    desc: string;
  }>;
  footerCopy: string;
  footerNote: string;
}

export const translations: Record<Language, TranslationDict> = {
  ua: {
    brandName: 'DocGate PDF',
    navConverter: 'Файли',
    navStandards: 'Вимоги',
    navPrivacy: 'Безпека',
    darkThemeLabel: 'Темна тема',
    lightThemeLabel: 'Світла тема',
    workspaceTrailRoot: 'Конвертер',
    workspaceTrailActive: 'PDF · Word · Excel',
    localBanner: 'Обробка відбувається локально у браузері — файли не завантажуються на сервер',
    presetsLabel: 'Швидкий профіль',
    presets: {
      customs_strict: {
        label: 'Митниця · ≤ 490 КБ',
        hint: 'Посторінково, Grayscale',
      },
      bank_split: {
        label: 'Банк (сторінки) · ≤ 1.9 МБ',
        hint: 'Посторінково, Колір',
      },
      bank_single: {
        label: 'Банк (єдиний) · ≤ 4.5 МБ',
        hint: 'Єдиний PDF, Контрастний скан',
      },
      custom: {
        label: 'Власні',
        hint: 'Ручні налаштування',
      },
    },
    addFilesBtn: 'Додати',
    searchPlaceholder: 'Пошук',
    clearSearchLabel: 'Очистити пошук',
    viewListLabel: 'Список',
    viewGridLabel: 'Плитка',
    dropOverlayTitle: 'Відпустіть файли для додавання в чергу',
    localBadge: '0 байт передано на сервер. Усе працює локально у вашому браузері.',
    settingsTitle: 'Параметри',
    outputModeLabel: 'Формат виводу',
    outputModes: {
      split: 'Посторінково',
      merged: 'Єдиний PDF',
    },
    sizeLimitLabel: 'Ліміт розміру',
    sizeLimits: {
      490: 'До 490 КБ (Митниця)',
      950: 'До 950 КБ (Е-кабінети)',
      1900: 'До 1.9 МБ (Банки)',
      4500: 'До 4.5 МБ (Пакет документів)',
    },
    colorModeLabel: 'Колір',
    colorModes: {
      grayscale: 'Чорно-білий (Grayscale)',
      bw_contrast: 'Контрастний скан',
      color: 'Кольоровий',
    },
    convertBtn: 'Конвертувати',
    convertingBtn: 'Обробка...',
    clearBtn: 'Очистити все',
    downloadAllBtn: 'Завантажити ZIP',
    filterAll: 'Усі файли',
    filterPending: 'У черзі',
    filterDone: 'Готові',
    emptyTitle: 'Додайте документи для конвертації',
    emptyBody: 'Перетягніть сюди файли PDF, DOC, DOCX, XLS, XLSX або CSV — або натисніть «Додати».',
    emptyCta: 'Додати файли',
    noSearchResults: 'За вашим запитом файлів не знайдено.',
    statusWait: 'У черзі',
    statusWorking: 'Обробка',
    statusDone: 'Готово',
    statusError: 'Помилка',
    pagesLabel: 'Сторінок',
    pageShort: 'Стор.',
    mergedLabel: 'Єдиний файл',
    allPagesLabel: 'стор.',
    pageProgress: (current, total) => `${current} з ${total}`,
    withinLimitLabel: 'У межах ліміту',
    overLimitLabel: 'Понад ліміт',
    savedLabel: 'економії',
    previewBtn: 'Перегляд',
    downloadBtn: 'Завантажити',
    removeBtn: 'Видалити',
    reconvertBtn: 'Повторити',
    closeBtn: 'Закрити',
    prevPageBtn: 'Попередня',
    nextPageBtn: 'Наступна',
    outputsCount: (n) => `${n} PDF`,
    statsFiles: (n) => `${n} файл(ів)`,
    statsPages: (n) => `${n} стор.`,
    standardsTitle: 'Вимоги банків і митних систем',
    standardsSubtitle: 'Орієнтовні обмеження для подання PDF-документів.',
    standardsCols: {
      portal: 'Система / Призначення',
      limit: 'Ліміт',
      mode: 'Рекомендований режим',
      notes: 'Примітки',
    },
    standardsRows: [
      {
        portal: 'ДМСУ · Єдине вікно / Митниця',
        limit: '≤ 490 КБ',
        mode: 'Посторінково · Grayscale',
        notes: 'Автоматичний підбір DPI (300 → 50) зберігає читабельність номерів ВМД та інвойсів.',
      },
      {
        portal: 'Банківський валютний контроль',
        limit: '≤ 1.9 – 4.5 МБ',
        mode: 'Єдиний PDF або сторінки · Контраст',
        notes: 'Контракти, інвойси, специфікації та СМР із чіткими печатками й підписами.',
      },
      {
        portal: 'Вчасно / M.E.Doc / Клієнт-Банк',
        limit: '≤ 950 КБ – 1.9 МБ',
        mode: 'Єдиний PDF · Контрастний скан',
        notes: 'Зменшує вагу багатосторінкових документів у 3–8 разів без втрати якості тексту.',
      },
    ],
    privacyTitle: 'Безпека даних',
    privacyPoints: [
      {
        title: 'Локальна обробка',
        desc: 'Рендеринг PDF (PDF.js), Word (DOC/DOCX) і Excel (Excel → PDF → JPEG → PDF) виконується виключно у браузері.',
      },
      {
        title: 'Без завантаження на сервер',
        desc: 'Жоден інвойс, контракт чи митна декларація не покидає ваш пристрій.',
      },
      {
        title: 'Автономні ресурси',
        desc: 'Таблиці кодувань CMap і стандартні шрифти підключаються локально з цього домену.',
      },
    ],
    footerCopy: 'DocGate PDF',
    footerNote: 'Локальний конвертер документів (UA / EN)',
  },
  en: {
    brandName: 'DocGate PDF',
    navConverter: 'Files',
    navStandards: 'Limits',
    navPrivacy: 'Privacy',
    darkThemeLabel: 'Dark theme',
    lightThemeLabel: 'Light theme',
    workspaceTrailRoot: 'Converter',
    workspaceTrailActive: 'PDF · Word · Excel',
    localBanner: '100% browser-local processing — your files never leave this device',
    presetsLabel: 'Quick Preset',
    presets: {
      customs_strict: {
        label: 'Customs · ≤ 490 KB',
        hint: 'Split pages, Grayscale',
      },
      bank_split: {
        label: 'Bank (Split) · ≤ 1.9 MB',
        hint: 'Split pages, Color',
      },
      bank_single: {
        label: 'Bank (Single) · ≤ 4.5 MB',
        hint: 'Single PDF, High Contrast',
      },
      custom: {
        label: 'Custom',
        hint: 'Manual settings',
      },
    },
    addFilesBtn: 'Add Files',
    searchPlaceholder: 'Search',
    clearSearchLabel: 'Clear search',
    viewListLabel: 'List view',
    viewGridLabel: 'Grid view',
    dropOverlayTitle: 'Drop files to add to the queue',
    localBadge: '0 bytes uploaded. Everything runs locally in your browser.',
    settingsTitle: 'Settings',
    outputModeLabel: 'Output Mode',
    outputModes: {
      split: 'Split pages',
      merged: 'Single PDF',
    },
    sizeLimitLabel: 'Size Limit',
    sizeLimits: {
      490: 'Up to 490 KB (Customs)',
      950: 'Up to 950 KB (E-Portals)',
      1900: 'Up to 1.9 MB (Banks)',
      4500: 'Up to 4.5 MB (Full Package)',
    },
    colorModeLabel: 'Color Mode',
    colorModes: {
      grayscale: 'Grayscale (B&W)',
      bw_contrast: 'High-Contrast Scan',
      color: 'Full Color',
    },
    convertBtn: 'Convert',
    convertingBtn: 'Processing...',
    clearBtn: 'Clear all',
    downloadAllBtn: 'Download ZIP',
    filterAll: 'All files',
    filterPending: 'Queued',
    filterDone: 'Ready',
    emptyTitle: 'Add documents to convert',
    emptyBody: 'Drag & drop PDF, DOC, DOCX, XLS, XLSX, or CSV files here — or click Add Files.',
    emptyCta: 'Add Files',
    noSearchResults: 'No files match your search.',
    statusWait: 'Queued',
    statusWorking: 'Processing',
    statusDone: 'Ready',
    statusError: 'Error',
    pagesLabel: 'Pages',
    pageShort: 'Page',
    mergedLabel: 'Single PDF',
    allPagesLabel: 'pages',
    pageProgress: (current, total) => `${current} of ${total}`,
    withinLimitLabel: 'Within limit',
    overLimitLabel: 'Over limit',
    savedLabel: 'saved',
    previewBtn: 'Preview',
    downloadBtn: 'Download',
    removeBtn: 'Remove',
    reconvertBtn: 'Re-run',
    closeBtn: 'Close',
    prevPageBtn: 'Previous',
    nextPageBtn: 'Next',
    outputsCount: (n) => `${n} PDF`,
    statsFiles: (n) => `${n} file(s)`,
    statsPages: (n) => `${n} page(s)`,
    standardsTitle: 'Bank & Customs PDF Requirements',
    standardsSubtitle: 'Reference file limits for compliance document submissions.',
    standardsCols: {
      portal: 'Portal / Use Case',
      limit: 'Limit',
      mode: 'Recommended Mode',
      notes: 'Notes',
    },
    standardsRows: [
      {
        portal: 'Customs Single Window (e-Customs)',
        limit: '≤ 490 KB',
        mode: 'Split Pages · Grayscale',
        notes: 'Adaptive 300 → 50 DPI keeps declaration numbers and HS codes sharp.',
      },
      {
        portal: 'Bank FX & Trade Control',
        limit: '≤ 1.9 – 4.5 MB',
        mode: 'Single PDF or Split · Contrast',
        notes: 'Contracts, invoices, packing lists, and CMRs with clear stamps and signatures.',
      },
      {
        portal: 'Corporate Client-Bank & E-Doc',
        limit: '≤ 950 KB – 1.9 MB',
        mode: 'Single PDF · High-Contrast Scan',
        notes: 'Reduces multi-page scan file sizes by 3–8x while maintaining crisp text.',
      },
    ],
    privacyTitle: 'Data Privacy',
    privacyPoints: [
      {
        title: 'Local Browser Execution',
        desc: 'PDF rendering (PDF.js), Word (DOC/DOCX), and Excel (Excel → PDF → JPEG → PDF) run strictly inside browser memory.',
      },
      {
        title: 'Zero Server Uploads',
        desc: 'No invoice, contract, or customs declaration ever leaves your device.',
      },
      {
        title: 'Self-Hosted Assets',
        desc: 'CMap tables and standard PDF fonts load locally from this origin.',
      },
    ],
    footerCopy: 'DocGate PDF',
    footerNote: 'Local Document Converter (UA / EN)',
  },
};
