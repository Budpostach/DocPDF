import { Language, PresetId } from '../types/pdf';

export interface TranslationDict {
  brandName: string;
  navConverter: string;
  navStandards: string;
  navPrivacy: string;
  heroTitle: string;
  heroSubtitle: string;
  presetsLabel: string;
  presets: Record<
    PresetId,
    {
      label: string;
      hint: string;
    }
  >;
  uploadTitle: string;
  uploadSubtitle: string;
  uploadButton: string;
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
  specResolution: string;
  specResolutionVal: string;
  specOutput: string;
  specOutputSplit: string;
  specOutputMerged: string;
  specPrivacy: string;
  specPrivacyVal: string;
  convertBtn: string;
  convertingBtn: string;
  clearBtn: string;
  queueTitle: string;
  downloadAllBtn: string;
  filterAll: string;
  filterPending: string;
  filterDone: string;
  emptyTitle: string;
  emptyBody: string;
  emptyCta: string;
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
    navConverter: 'Конвертер',
    navStandards: 'Вимоги банків і митниці',
    navPrivacy: 'Безпека даних',
    heroTitle: 'Підготовка PDF-документів для банків та митниці',
    heroSubtitle:
      'Посторінковий поділ, автоматичний підбір DPI під суворі ліміти розміру та підсилення контрасту для печаток — локально у вашому браузері.',
    presetsLabel: 'Швидкі профілі:',
    presets: {
      customs_strict: {
        label: 'Митниця · ≤ 490 КБ',
        hint: 'Окремі сторінки, Grayscale',
      },
      bank_split: {
        label: 'Банк (сторінки) · ≤ 1.9 МБ',
        hint: 'Окремі сторінки, Колір',
      },
      bank_single: {
        label: 'Банк (єдиний PDF) · ≤ 4.5 МБ',
        hint: 'Єдиний файл, Контрастний',
      },
      custom: {
        label: 'Власні параметри',
        hint: 'Ручне налаштування',
      },
    },
    uploadTitle: 'Оберіть PDF, Word або Excel',
    uploadSubtitle: 'PDF, DOC, DOCX, XLS, XLSX, CSV — інвойси, специфікації, ВМД',
    uploadButton: 'Обрати файли',
    localBadge: 'Обробка локально в оперативній пам’яті браузера. Документи нікуди не передаються.',
    settingsTitle: 'Параметри конвертації',
    outputModeLabel: 'Формат виводу',
    outputModes: {
      split: 'Посторінково',
      merged: 'Єдиний PDF',
    },
    sizeLimitLabel: 'Ліміт розміру файлу',
    sizeLimits: {
      490: 'До 490 КБ (Суворий · Єдине вікно митниці)',
      950: 'До 950 КБ (Стандарт · Електронні кабінети)',
      1900: 'До 1.9 МБ (Розширений · Банківські портали)',
      4500: 'До 4.5 МБ (Пакет документів · Валютний контроль)',
    },
    colorModeLabel: 'Колірна схема',
    colorModes: {
      grayscale: 'Чорно-білий (Grayscale)',
      bw_contrast: 'Контрастний скан (чіткі печатки)',
      color: 'Кольоровий (зберегти колір)',
    },
    specResolution: 'Роздільна здатність',
    specResolutionVal: 'Автопідбір 300 → 50 DPI',
    specOutput: 'Режим',
    specOutputSplit: '1 сторінка = 1 PDF',
    specOutputMerged: 'Весь документ = 1 PDF',
    specPrivacy: 'Передача даних',
    specPrivacyVal: '0 байт на сервер',
    convertBtn: 'Конвертувати документи',
    convertingBtn: 'Триває обробка...',
    clearBtn: 'Очистити',
    queueTitle: 'Черга документів та результати',
    downloadAllBtn: 'Завантажити все (ZIP)',
    filterAll: 'Усі',
    filterPending: 'У черзі',
    filterDone: 'Готові',
    emptyTitle: 'Черга порожня',
    emptyBody:
      'Додайте файли PDF, DOC/DOCX або XLS/XLSX/CSV зліва. Таблиці та документи автоматично перетворюються у PDF через JPEG-оптимізацію під обраний ліміт розміру.',
    emptyCta: 'Обрати файли',
    statusWait: 'У черзі',
    statusWorking: 'Обробка',
    statusDone: 'Готово',
    statusError: 'Помилка',
    pagesLabel: 'Сторінок',
    pageShort: 'Стор.',
    mergedLabel: 'Весь файл',
    allPagesLabel: 'сторінок',
    pageProgress: (current, total) => `стор. ${current} з ${total}`,
    withinLimitLabel: 'У межах ліміту',
    overLimitLabel: 'Перевищує ліміт (мін. DPI)',
    savedLabel: 'Стиснення',
    previewBtn: 'Перегляд',
    downloadBtn: 'Завантажити',
    removeBtn: 'Видалити',
    reconvertBtn: 'Переконвертувати',
    closeBtn: 'Закрити',
    prevPageBtn: 'Попередня',
    nextPageBtn: 'Наступна',
    statsFiles: (n) => `${n} файл(ів)`,
    statsPages: (n) => `${n} стор.`,
    standardsTitle: 'Типові вимоги банків і митних систем',
    standardsSubtitle:
      'Орієнтовні технічні обмеження для подання сканованих та електронних PDF-документів.',
    standardsCols: {
      portal: 'Система / Призначення',
      limit: 'Ліміт розміру',
      mode: 'Рекомендований режим',
      notes: 'Примітки для подання',
    },
    standardsRows: [
      {
        portal: 'ДМСУ · Єдине вікно / Митне оформлення',
        limit: '≤ 490 КБ / файл',
        mode: 'Посторінково · Grayscale',
        notes: 'Суворе обмеження на одне вкладення; автоматичний підбір DPI зберігає читабельність номерів ВМД та інвойсів.',
      },
      {
        portal: 'Банківський валютний контроль (ЗЕД)',
        limit: '≤ 1.9 МБ – 4.5 МБ',
        mode: 'Єдиний PDF або сторінки · Контраст / Колір',
        notes: 'Контракти, специфікації, акти та СМР з чіткими печатками та підписами сторін.',
      },
      {
        portal: 'Електронний документообіг (Вчасно / M.E.Doc / Клієнт-Банк)',
        limit: '≤ 950 КБ – 1.9 МБ',
        mode: 'Єдиний PDF · Контрастний скан',
        notes: 'Зменшує вагу багатосторінкових сканів у 3–8 разів без втрати розбірливості тексту.',
      },
    ],
    privacyTitle: 'Архітектура конфіденційності',
    privacyPoints: [
      {
        title: '100% клієнтська обробка',
        desc: 'Рендеринг PDF (PDF.js), розбір Word (DOC/DOCX) і Excel (XLS/XLSX/CSV) та складання підсумкового PDF відбуваються виключно у браузері.',
      },
      {
        title: 'Без сторонніх серверів',
        desc: 'Жоден контракт, інвойс, банківська виписка чи митна декларація не покидає вашу локальну сесію.',
      },
      {
        title: 'Локальні таблиці шрифтів',
        desc: 'Таблиці кодувань (CMap) та стандартні шрифти PDF завантажуються локально з цього домену — коректна робота з кирилицею та спецсимволами.',
      },
    ],
    footerCopy: 'DocGate PDF · Конвертер для банківських та митних документів',
    footerNote: 'Локальна обробка в браузері (UA / EN)',
  },
  en: {
    brandName: 'DocGate PDF',
    navConverter: 'Converter',
    navStandards: 'Bank & Customs Limits',
    navPrivacy: 'Data Privacy',
    heroTitle: 'PDF Preparation for Banks & Customs',
    heroSubtitle:
      'Page-by-page splitting, automatic DPI scaling to meet strict file-size caps, and scan contrast enhancement — processed entirely in your browser.',
    presetsLabel: 'Quick Presets:',
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
        label: 'Bank (Single PDF) · ≤ 4.5 MB',
        hint: 'Merged PDF, High Contrast',
      },
      custom: {
        label: 'Custom Settings',
        hint: 'Manual configuration',
      },
    },
    uploadTitle: 'Select PDF, Word, or Excel files',
    uploadSubtitle: 'PDF, DOC, DOCX, XLS, XLSX, CSV — invoices, packing lists, specs',
    uploadButton: 'Select Files',
    localBadge: 'Processed locally in browser memory. Documents are never uploaded to any server.',
    settingsTitle: 'Conversion Settings',
    outputModeLabel: 'Output Mode',
    outputModes: {
      split: 'Split by page',
      merged: 'Single PDF',
    },
    sizeLimitLabel: 'Target File Size Limit',
    sizeLimits: {
      490: 'Up to 490 KB (Strict · Customs Single Window)',
      950: 'Up to 950 KB (Standard · E-Portals)',
      1900: 'Up to 1.9 MB (Extended · Bank Portals)',
      4500: 'Up to 4.5 MB (Full Contract Package · FX Control)',
    },
    colorModeLabel: 'Color Mode',
    colorModes: {
      grayscale: 'Grayscale (Black & White)',
      bw_contrast: 'High-Contrast Scan (Crisp Stamps)',
      color: 'Full Color (Preserve Color)',
    },
    specResolution: 'Resolution',
    specResolutionVal: 'Auto-fit 300 → 50 DPI',
    specOutput: 'Mode',
    specOutputSplit: '1 page = 1 PDF',
    specOutputMerged: 'Full document = 1 PDF',
    specPrivacy: 'Network Upload',
    specPrivacyVal: '0 bytes uploaded',
    convertBtn: 'Convert Documents',
    convertingBtn: 'Processing...',
    clearBtn: 'Clear',
    queueTitle: 'Document Queue & Outputs',
    downloadAllBtn: 'Download All (ZIP)',
    filterAll: 'All',
    filterPending: 'Queued',
    filterDone: 'Complete',
    emptyTitle: 'Queue is empty',
    emptyBody:
      'Add PDF, DOC/DOCX, or XLS/XLSX/CSV files on the left. Spreadsheets and documents are converted locally to size-compliant PDFs.',
    emptyCta: 'Choose Files',
    statusWait: 'Queued',
    statusWorking: 'Processing',
    statusDone: 'Complete',
    statusError: 'Error',
    pagesLabel: 'Pages',
    pageShort: 'Page',
    mergedLabel: 'Full PDF',
    allPagesLabel: 'pages',
    pageProgress: (current, total) => `page ${current} of ${total}`,
    withinLimitLabel: 'Within limit',
    overLimitLabel: 'Above limit (min DPI)',
    savedLabel: 'Reduction',
    previewBtn: 'Preview',
    downloadBtn: 'Download',
    removeBtn: 'Remove',
    reconvertBtn: 'Re-convert',
    closeBtn: 'Close',
    prevPageBtn: 'Previous',
    nextPageBtn: 'Next',
    statsFiles: (n) => `${n} file(s)`,
    statsPages: (n) => `${n} page(s)`,
    standardsTitle: 'Common Bank & Customs PDF Requirements',
    standardsSubtitle:
      'Reference thresholds for submitting scanned contracts, invoices, and declarations.',
    standardsCols: {
      portal: 'Portal / Use Case',
      limit: 'Size Limit',
      mode: 'Recommended Profile',
      notes: 'Compliance Notes',
    },
    standardsRows: [
      {
        portal: 'Customs Single Window (e-Customs)',
        limit: '≤ 490 KB / file',
        mode: 'Split Pages · Grayscale',
        notes: 'Strict per-attachment ceiling; automatic DPI selection keeps declaration numbers and HS codes legible.',
      },
      {
        portal: 'Bank FX & Trade Compliance',
        limit: '≤ 1.9 MB – 4.5 MB',
        mode: 'Single PDF or Split · Contrast / Color',
        notes: 'Cross-border contracts, invoices, CMRs, and acts with clear stamps and signatures.',
      },
      {
        portal: 'Corporate Client-Bank & E-Doc Portals',
        limit: '≤ 950 KB – 1.9 MB',
        mode: 'Single PDF · High-Contrast Scan',
        notes: 'Reduces multi-page scan weight by 3–8x while preserving crisp document text.',
      },
    ],
    privacyTitle: 'Privacy-First Local Architecture',
    privacyPoints: [
      {
        title: '100% Client-Side Execution',
        desc: 'PDF rendering (PDF.js), Word (DOC/DOCX) and Excel (XLS/XLSX/CSV) parsing, and PDF assembly run strictly inside your browser memory.',
      },
      {
        title: 'Zero Server Uploads',
        desc: 'Sensitive contracts, invoices, bank statements, and customs declarations never leave your device.',
      },
      {
        title: 'Self-Hosted Font & CMap Assets',
        desc: 'CMap encoding tables and standard PDF fonts are bundled locally for reliable Cyrillic and multilingual rendering.',
      },
    ],
    footerCopy: 'DocGate PDF · Bank & Customs Document Converter',
    footerNote: 'Local Browser Processing (UA / EN)',
  },
};
