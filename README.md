# DocGate PDF

**DocGate PDF** is a 100% browser-local document conversion and optimization tool tailored for **banking and customs compliance** (Єдине вікно митниці, currency control, foreign trade contracts, invoices, and packing lists), with a bilingual interface (**Українська / English**).

All parsing, rendering, image filtering, and PDF compilation happen strictly inside the user's browser memory — **0 bytes are uploaded to external servers**.

---

## Key Features

### Supported Input Formats & Pipelines
- **PDF (`.pdf`)** → `PDF.js → Canvas → JPEG → jsPDF`
  Splits multi-page PDFs into individual page PDFs or merges/re-optimizes into a single compressed PDF.
- **Word (`.docx`, `.doc`)** → `Isolated DOM / OLE2 Parser → Canvas → JPEG → jsPDF`
  Renders `.docx` styling (`docx-preview` in a sandboxed iframe) and legacy binary `.doc` / RTF (`cfb` OLE2 reader with UTF-16LE & Windows-1251 support) into compliant PDFs.
- **Excel & Spreadsheets (`.xlsx`, `.xls`, `.xlsm`, `.ods`, `.csv`)** → `Excel → Vector PDF → JPEG → PDF`
  1. Parses real column widths, merged cells, borders, colors, alignments, number/date formats, and page orientation via `ExcelJS` / `SheetJS`.
  2. Emulates Excel horizontal overflow across empty adjacent cells and solves optimal per-sheet scaling so each sheet fits cleanly on **1 A4 page** without right-edge clipping (`pdfmake` with Roboto TTF for Cyrillic & Extended Latin).
  3. Rasterizes the intermediate PDF through `PDF.js → JPEG → jsPDF` to meet exact file-size limits and color requirements.

### Compliance Presets & Size Optimization
- **Strict File Size Limits**: `≤ 490 KB` (Customs Single Window), `≤ 950 KB`, `≤ 1.9 MB` (Bank per-page), `≤ 4.5 MB` (Bank single merged PDF).
- **Adaptive DPI & Quality Solver**: Automatically steps across `300 → 50 DPI` and performs a binary search on JPEG quality (`0.90 → 0.12`) so both single-page and multi-page merged documents strictly stay within the selected size limit.
- **Output Modes**:
  - **Split** — one PDF per page (`filename_page_1.pdf`, …)
  - **Merged** — one combined PDF (`filename.pdf` / `filename_optimized.pdf`)
- **Color Profiles**: Grayscale, High-Contrast B&W (for stamps & signatures), and Full Color.
- **Batch Queue, Live Preview & ZIP Export**: Drag-and-drop multiple files, inspect every output page in a modal preview (`←` / `→` / `Esc`), or download all results in one `DocGate_PDF_Documents.zip`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
- **PDF & Image Processing**: `pdfjs-dist`, `jspdf`, `jszip`, `pdfmake`
- **Office Document Parsing**: `exceljs`, `xlsx`, `docx-preview`, `cfb`, `html2canvas`

---

## Getting Started

### Prerequisites
- Node.js `v18+` (recommended `v20+`)

### Installation
```bash
npm install
```

### Environment Variables
Copy `.env.example` to `.env` if needed for local configuration:
```bash
cp .env.example .env
```

### Development
```bash
npm run dev
```
Runs the local development server on `http://localhost:3000`.

### Type Check & Production Build
```bash
npm run lint
npm run build
```
Outputs the static production bundle to `dist/`.

---

## Deployment

The application builds to a static `dist/` bundle (`npm run build`) with all `pdfjs-dist` worker, CMaps, and standard fonts served locally from `public/pdfjs/`, making it ready for zero-config static hosting on **Vercel** or any CDN.
