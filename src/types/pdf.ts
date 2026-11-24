export type Language = 'ua' | 'en';

export type ThemeMode = 'light' | 'dark';

export type AppPage = 'files' | 'standards' | 'privacy';

export type PresetId = 'customs_strict' | 'bank_split' | 'bank_single' | 'custom';

export type OutputMode = 'split' | 'merged';

export type ColorMode = 'grayscale' | 'bw_contrast' | 'color';

export type SizeLimitKb = 490 | 950 | 1900 | 4500;

export interface ConversionSettings {
  preset: PresetId;
  outputMode: OutputMode;
  sizeLimitKb: SizeLimitKb;
  colorMode: ColorMode;
}

export interface PageOutput {
  id: string;
  pageNum: number;
  pageCount?: number;
  name: string;
  bytes: ArrayBuffer;
  previewUrl: string;
  dpi: number;
  withinLimit: boolean;
  isMergedDocument?: boolean;
}

export type QueueStatus = 'wait' | 'working' | 'done' | 'error';

export interface QueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  pages: number;
  currentPage: number;
  outputs: PageOutput[];
  error: string;
  usedSettings?: ConversionSettings;
}

export type QueueFilter = 'all' | 'pending' | 'done';
