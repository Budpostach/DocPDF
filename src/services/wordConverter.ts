import * as CFB from 'cfb';
import JSZip from 'jszip';
import * as pdfMakeModule from 'pdfmake/build/pdfmake';
import * as pdfFontsModule from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';

const pdfMake: any = (pdfMakeModule as any).default ?? pdfMakeModule;
const rawVfs: any =
  (pdfFontsModule as any).default ??
  (pdfFontsModule as any).pdfMake?.vfs ??
  pdfFontsModule;

let vfsInitialized = false;
function ensurePdfMakeFonts(): void {
  if (vfsInitialized) return;
  if (typeof pdfMake.addVirtualFileSystem === 'function' && rawVfs) {
    pdfMake.addVirtualFileSystem(rawVfs);
  } else if (rawVfs) {
    pdfMake.vfs = rawVfs;
  }
  vfsInitialized = true;
}

type DetectedFormat = 'docx' | 'doc_ole2' | 'rtf' | 'html';

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

function detectWordFormat(bytes: Uint8Array, fileName: string): DetectedFormat {
  if (startsWithBytes(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    return 'docx';
  }
  if (startsWithBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'doc_ole2';
  }

  const headAscii = new TextDecoder('ascii', { fatal: false })
    .decode(bytes.subarray(0, 256))
    .trimStart()
    .toLowerCase();

  if (headAscii.startsWith('{\\rtf')) {
    return 'rtf';
  }
  if (
    headAscii.startsWith('<!doctype html') ||
    headAscii.startsWith('<html') ||
    headAscii.includes('<html') ||
    headAscii.includes('<body')
  ) {
    return 'html';
  }

  return /\.docx$/i.test(fileName) ? 'docx' : 'doc_ole2';
}

/* -------------------------------------------------------------------------- */
/* XML & OOXML Helpers                                                        */
/* -------------------------------------------------------------------------- */

function parseXmlString(xml: string): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  return doc;
}

function localNameOf(node: Node): string {
  const el = node as Element;
  if (el.localName) return el.localName;
  const name = el.nodeName || '';
  const colonIdx = name.indexOf(':');
  return colonIdx >= 0 ? name.slice(colonIdx + 1) : name;
}

function directChildren(parent: Element | null | undefined, name?: string): Element[] {
  if (!parent) return [];
  const res: Element[] = [];
  const nodes = parent.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i];
    if (child.nodeType === 1) {
      if (!name || localNameOf(child) === name) {
        res.push(child as Element);
      }
    }
  }
  return res;
}

function firstChild(parent: Element | null | undefined, name: string): Element | null {
  if (!parent) return null;
  const nodes = parent.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i];
    if (child.nodeType === 1 && localNameOf(child) === name) {
      return child as Element;
    }
  }
  return null;
}

function findDescendants(root: Element | null | undefined, name: string): Element[] {
  const res: Element[] = [];
  if (!root) return res;
  const walk = (node: Element) => {
    const nodes = node.childNodes;
    for (let i = 0; i < nodes.length; i++) {
      const child = nodes[i];
      if (child.nodeType === 1) {
        const el = child as Element;
        // Skip AlternateContent Fallback branch when Choice is present
        if (localNameOf(el) === 'AlternateContent') {
          const choice = firstChild(el, 'Choice') ?? firstChild(el, 'Fallback');
          if (choice) walk(choice);
          continue;
        }
        if (localNameOf(el) === name) {
          res.push(el);
        }
        walk(el);
      }
    }
  };
  walk(root);
  return res;
}

function getAttr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const attrs = el.attributes;
  if (!attrs) return null;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i];
    const aLocal = a.localName || (a.name.includes(':') ? a.name.split(':').pop()! : a.name);
    if (aLocal === name) {
      return a.value;
    }
  }
  return null;
}

function twipsToPt(val: string | null | undefined, fallback = 0): number {
  if (!val) return fallback;
  const num = Number(val);
  return Number.isFinite(num) ? num / 20 : fallback;
}

function calibrateDocxFontSize(pt: number): number {
  // Roboto glyphs are ~6% wider than Word's default Calibri; gentle scaling keeps headings/lines matching Word breaks
  return Number(Math.max(6.5, pt * 0.94).toFixed(1));
}

function halfPtToPt(val: string | null | undefined): number | undefined {
  if (!val) return undefined;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num / 2 : undefined;
}

function emuToPt(val: string | null | undefined): number | undefined {
  if (!val) return undefined;
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? num / 12700 : undefined;
}

function emuToSignedPt(val: string | null | undefined): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const num = Number(val);
  return Number.isFinite(num) ? num / 12700 : undefined;
}

function normalizeHexColor(val: string | null | undefined): string | undefined {
  if (!val) return undefined;
  const clean = val.replace(/^#/, '').trim();
  if (!clean || clean.toLowerCase() === 'auto') return undefined;
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toLowerCase()}`;
  if (/^[0-9a-fA-F]{8}$/.test(clean)) return `#${clean.slice(2).toLowerCase()}`;
  return undefined;
}

function isToggleEnabled(el: Element | null): boolean | undefined {
  if (!el) return undefined;
  const val = getAttr(el, 'val');
  if (val === null) return true;
  const lower = val.toLowerCase();
  return lower !== '0' && lower !== 'false' && lower !== 'off';
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode(...sub));
  }
  return btoa(chunks.join(''));
}

/* -------------------------------------------------------------------------- */
/* OOXML Styles, Relationships & Media Resolution                             */
/* -------------------------------------------------------------------------- */

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  color?: string;
  highlight?: string;
}

interface ParagraphStyle {
  alignment?: 'left' | 'center' | 'right' | 'justify';
  spaceBefore?: number;
  spaceAfter?: number;
  lineHeight?: number;
  indentLeft?: number;
  indentRight?: number;
  firstLineIndent?: number;
  fillColor?: string;
  bottomBorder?: { width: number; color: string } | null;
  keepNext?: boolean;
  pageBreakBefore?: boolean;
  numId?: string;
  ilvl?: number;
  tabs?: Array<{ val: string; posPt: number }>;
  runStyle?: RunStyle;
}

interface BorderSpec {
  enabled: boolean;
  width: number;
  color: string;
}

interface TableBorderSet {
  top?: BorderSpec;
  bottom?: BorderSpec;
  left?: BorderSpec;
  right?: BorderSpec;
  insideH?: BorderSpec;
  insideV?: BorderSpec;
}

interface DocStyleEntry {
  styleId: string;
  type: string;
  basedOn?: string;
  pPr?: ParagraphStyle;
  rPr?: RunStyle;
  tblBorders?: TableBorderSet;
  tblCellMar?: [number, number, number, number]; // [left, top, right, bottom]
}

interface StylesContext {
  defaultRun: RunStyle;
  defaultParagraph: ParagraphStyle;
  styles: Map<string, DocStyleEntry>;
}

interface NumberingLevel {
  format: string;
  lvlText: string;
}

type NumberingMap = Map<string, Map<number, NumberingLevel>>;

interface RelEntry {
  target: string;
  type: string;
}

function parseRunStyle(rPr: Element | null | undefined): RunStyle {
  if (!rPr) return {};
  const style: RunStyle = {};
  const b = isToggleEnabled(firstChild(rPr, 'b'));
  if (b !== undefined) style.bold = b;

  const i = isToggleEnabled(firstChild(rPr, 'i'));
  if (i !== undefined) style.italic = i;

  const uEl = firstChild(rPr, 'u');
  if (uEl) {
    const uVal = getAttr(uEl, 'val');
    style.underline = uVal !== 'none';
  }

  const strike = isToggleEnabled(firstChild(rPr, 'strike'));
  if (strike !== undefined) style.strike = strike;

  const szEl = firstChild(rPr, 'sz');
  const szPt = halfPtToPt(getAttr(szEl, 'val'));
  if (szPt) style.fontSize = calibrateDocxFontSize(szPt);

  const colorEl = firstChild(rPr, 'color');
  const color = normalizeHexColor(getAttr(colorEl, 'val'));
  if (color) style.color = color;

  const shdEl = firstChild(rPr, 'shd');
  const fill = normalizeHexColor(getAttr(shdEl, 'fill'));
  if (fill && fill !== '#ffffff') style.highlight = fill;

  return style;
}

function parseBorderElement(el: Element | null | undefined): BorderSpec | undefined {
  if (!el) return undefined;
  const val = (getAttr(el, 'val') ?? '').toLowerCase();
  if (val === 'none' || val === 'nil') {
    return { enabled: false, width: 0, color: '#0f172a' };
  }
  if (!val && !getAttr(el, 'sz') && !getAttr(el, 'color')) {
    return undefined;
  }
  const szEighths = Number(getAttr(el, 'sz') ?? '4');
  const width = Number.isFinite(szEighths) && szEighths > 0 ? Math.max(0.45, Math.min(2.5, szEighths / 8)) : 0.6;
  const color = normalizeHexColor(getAttr(el, 'color')) ?? '#1e293b';
  return { enabled: true, width, color };
}

function parseTableBorders(tblBordersEl: Element | null | undefined): TableBorderSet {
  if (!tblBordersEl) return {};
  return {
    top: parseBorderElement(firstChild(tblBordersEl, 'top')),
    bottom: parseBorderElement(firstChild(tblBordersEl, 'bottom')),
    left: parseBorderElement(firstChild(tblBordersEl, 'left')) ?? parseBorderElement(firstChild(tblBordersEl, 'start')),
    right: parseBorderElement(firstChild(tblBordersEl, 'right')) ?? parseBorderElement(firstChild(tblBordersEl, 'end')),
    insideH: parseBorderElement(firstChild(tblBordersEl, 'insideH')),
    insideV: parseBorderElement(firstChild(tblBordersEl, 'insideV')),
  };
}

function parseCellMargins(marEl: Element | null | undefined): [number, number, number, number] | undefined {
  if (!marEl) return undefined;
  const left = twipsToPt(getAttr(firstChild(marEl, 'left') ?? firstChild(marEl, 'start'), 'w'), -1);
  const top = twipsToPt(getAttr(firstChild(marEl, 'top'), 'w'), -1);
  const right = twipsToPt(getAttr(firstChild(marEl, 'right') ?? firstChild(marEl, 'end'), 'w'), -1);
  const bottom = twipsToPt(getAttr(firstChild(marEl, 'bottom'), 'w'), -1);
  if (left < 0 && top < 0 && right < 0 && bottom < 0) return undefined;
  return [
    left >= 0 ? Math.min(12, Math.max(2, left)) : 4.5,
    top >= 0 ? Math.min(10, Math.max(1.5, top)) : 3,
    right >= 0 ? Math.min(12, Math.max(2, right)) : 4.5,
    bottom >= 0 ? Math.min(10, Math.max(1.5, bottom)) : 3,
  ];
}

function parseParagraphStyle(pPr: Element | null | undefined): ParagraphStyle {
  if (!pPr) return {};
  const style: ParagraphStyle = {};

  const jcEl = firstChild(pPr, 'jc');
  const jcVal = (getAttr(jcEl, 'val') ?? '').toLowerCase();
  if (jcVal === 'center') style.alignment = 'center';
  else if (jcVal === 'right' || jcVal === 'end') style.alignment = 'right';
  else if (jcVal === 'both' || jcVal === 'distribute') style.alignment = 'justify';
  else if (jcVal === 'left' || jcVal === 'start') style.alignment = 'left';

  const spacingEl = firstChild(pPr, 'spacing');
  if (spacingEl) {
    const beforeAttr = getAttr(spacingEl, 'before');
    if (beforeAttr !== null) style.spaceBefore = Math.min(36, Math.max(0, twipsToPt(beforeAttr)));

    const afterAttr = getAttr(spacingEl, 'after');
    if (afterAttr !== null) style.spaceAfter = Math.min(36, Math.max(0, twipsToPt(afterAttr)));

    const lineAttr = getAttr(spacingEl, 'line');
    const lineRule = (getAttr(spacingEl, 'lineRule') ?? 'auto').toLowerCase();
    if (lineAttr !== null) {
      const lineNum = Number(lineAttr);
      if (Number.isFinite(lineNum) && lineNum > 0) {
        if (lineRule === 'auto') {
          style.lineHeight = Math.min(1.65, Math.max(1.08, lineNum / 240));
        } else {
          // Exact / atLeast in twips (approximate ratio assuming ~11pt base)
          const pt = lineNum / 20;
          style.lineHeight = Math.min(1.65, Math.max(1.08, pt / 11));
        }
      }
    }
  }

  const indEl = firstChild(pPr, 'ind');
  if (indEl) {
    const leftVal = getAttr(indEl, 'left') ?? getAttr(indEl, 'start');
    if (leftVal !== null) style.indentLeft = Math.max(0, Math.min(220, twipsToPt(leftVal)));

    const rightVal = getAttr(indEl, 'right') ?? getAttr(indEl, 'end');
    if (rightVal !== null) style.indentRight = Math.max(0, Math.min(220, twipsToPt(rightVal)));

    const firstLineVal = getAttr(indEl, 'firstLine');
    if (firstLineVal !== null) {
      style.firstLineIndent = Math.max(0, Math.min(120, twipsToPt(firstLineVal)));
    }
  }

  const shdEl = firstChild(pPr, 'shd');
  const fill = normalizeHexColor(getAttr(shdEl, 'fill'));
  if (fill && fill !== '#ffffff') style.fillColor = fill;

  const pBdrEl = firstChild(pPr, 'pBdr');
  if (pBdrEl) {
    const bottomBdr = parseBorderElement(firstChild(pBdrEl, 'bottom'));
    if (bottomBdr?.enabled) {
      style.bottomBorder = { width: bottomBdr.width, color: bottomBdr.color };
    }
  }

  if (firstChild(pPr, 'pageBreakBefore')) {
    style.pageBreakBefore = true;
  }

  const numPrEl = firstChild(pPr, 'numPr');
  if (numPrEl) {
    const numIdVal = getAttr(firstChild(numPrEl, 'numId'), 'val');
    const ilvlVal = getAttr(firstChild(numPrEl, 'ilvl'), 'val');
    if (numIdVal && numIdVal !== '0') {
      style.numId = numIdVal;
      style.ilvl = ilvlVal ? Number(ilvlVal) || 0 : 0;
    }
  }

  const tabsEl = firstChild(pPr, 'tabs');
  if (tabsEl) {
    const tabs: Array<{ val: string; posPt: number }> = [];
    for (const tab of directChildren(tabsEl, 'tab')) {
      const val = (getAttr(tab, 'val') ?? 'left').toLowerCase();
      if (val === 'clear') continue;
      const posPt = twipsToPt(getAttr(tab, 'pos'), 0);
      tabs.push({ val, posPt });
    }
    if (tabs.length > 0) {
      style.tabs = tabs;
    }
  }

  const rPrEl = firstChild(pPr, 'rPr');
  if (rPrEl) {
    style.runStyle = parseRunStyle(rPrEl);
  }

  return style;
}

function mergeRunStyle(base: RunStyle, over?: RunStyle): RunStyle {
  if (!over) return { ...base };
  return {
    bold: over.bold !== undefined ? over.bold : base.bold,
    italic: over.italic !== undefined ? over.italic : base.italic,
    underline: over.underline !== undefined ? over.underline : base.underline,
    strike: over.strike !== undefined ? over.strike : base.strike,
    fontSize: over.fontSize !== undefined ? over.fontSize : base.fontSize,
    color: over.color !== undefined ? over.color : base.color,
    highlight: over.highlight !== undefined ? over.highlight : base.highlight,
  };
}

function mergeParagraphStyle(base: ParagraphStyle, over?: ParagraphStyle): ParagraphStyle {
  if (!over) return { ...base, runStyle: base.runStyle ? { ...base.runStyle } : undefined };
  return {
    alignment: over.alignment ?? base.alignment,
    spaceBefore: over.spaceBefore !== undefined ? over.spaceBefore : base.spaceBefore,
    spaceAfter: over.spaceAfter !== undefined ? over.spaceAfter : base.spaceAfter,
    lineHeight: over.lineHeight !== undefined ? over.lineHeight : base.lineHeight,
    indentLeft: over.indentLeft !== undefined ? over.indentLeft : base.indentLeft,
    indentRight: over.indentRight !== undefined ? over.indentRight : base.indentRight,
    firstLineIndent:
      over.firstLineIndent !== undefined ? over.firstLineIndent : base.firstLineIndent,
    fillColor: over.fillColor ?? base.fillColor,
    bottomBorder: over.bottomBorder !== undefined ? over.bottomBorder : base.bottomBorder,
    pageBreakBefore: over.pageBreakBefore ?? base.pageBreakBefore,
    numId: over.numId ?? base.numId,
    ilvl: over.ilvl !== undefined ? over.ilvl : base.ilvl,
    tabs: over.tabs ?? base.tabs,
    runStyle: mergeRunStyle(base.runStyle ?? {}, over.runStyle),
  };
}

async function parseStylesXml(zip: JSZip): Promise<StylesContext> {
  const ctx: StylesContext = {
    defaultRun: { fontSize: calibrateDocxFontSize(10.5), color: '#0f172a' },
    defaultParagraph: { alignment: 'left', spaceBefore: 0, spaceAfter: 4, lineHeight: 1.16 },
    styles: new Map(),
  };

  const stylesFile = zip.file('word/styles.xml');
  if (!stylesFile) return ctx;

  const doc = parseXmlString(await stylesFile.async('string'));
  const root = doc.documentElement;
  if (!root) return ctx;

  const docDefaults = firstChild(root, 'docDefaults');
  if (docDefaults) {
    const rPrDef = firstChild(firstChild(docDefaults, 'rPrDefault'), 'rPr');
    if (rPrDef) {
      ctx.defaultRun = mergeRunStyle(ctx.defaultRun, parseRunStyle(rPrDef));
    }
    const pPrDef = firstChild(firstChild(docDefaults, 'pPrDefault'), 'pPr');
    if (pPrDef) {
      ctx.defaultParagraph = mergeParagraphStyle(ctx.defaultParagraph, parseParagraphStyle(pPrDef));
    }
  }

  for (const st of directChildren(root, 'style')) {
    const styleId = getAttr(st, 'styleId');
    if (!styleId) continue;
    const type = getAttr(st, 'type') ?? 'paragraph';
    const basedOn = getAttr(firstChild(st, 'basedOn'), 'val') ?? undefined;
    const pPr = parseParagraphStyle(firstChild(st, 'pPr'));
    const rPr = parseRunStyle(firstChild(st, 'rPr'));
    const tblPr = firstChild(st, 'tblPr');
    const tblBorders = tblPr ? parseTableBorders(firstChild(tblPr, 'tblBorders')) : undefined;
    const tblCellMar = tblPr ? parseCellMargins(firstChild(tblPr, 'tblCellMar')) : undefined;

    ctx.styles.set(styleId, {
      styleId,
      type,
      basedOn,
      pPr,
      rPr,
      tblBorders,
      tblCellMar,
    });
  }

  return ctx;
}

function resolveParagraphStyleChain(ctx: StylesContext, styleId?: string | null): ParagraphStyle {
  let acc: ParagraphStyle = mergeParagraphStyle(ctx.defaultParagraph, { runStyle: ctx.defaultRun });
  if (!styleId) return acc;

  const chain: DocStyleEntry[] = [];
  const visited = new Set<string>();
  let currId: string | undefined = styleId;
  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const entry = ctx.styles.get(currId);
    if (!entry) break;
    chain.unshift(entry);
    currId = entry.basedOn;
  }

  for (const item of chain) {
    if (item.pPr) acc = mergeParagraphStyle(acc, item.pPr);
    if (item.rPr) acc.runStyle = mergeRunStyle(acc.runStyle ?? {}, item.rPr);
  }
  return acc;
}

function resolveRunStyleChain(ctx: StylesContext, styleId?: string | null): RunStyle {
  if (!styleId) return {};
  const chain: DocStyleEntry[] = [];
  const visited = new Set<string>();
  let currId: string | undefined = styleId;
  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const entry = ctx.styles.get(currId);
    if (!entry) break;
    chain.unshift(entry);
    currId = entry.basedOn;
  }

  let acc: RunStyle = {};
  for (const item of chain) {
    if (item.rPr) acc = mergeRunStyle(acc, item.rPr);
  }
  return acc;
}

function resolveTableStyleChain(
  ctx: StylesContext,
  styleId?: string | null,
): { tblBorders?: TableBorderSet; tblCellMar?: [number, number, number, number] } {
  if (!styleId) return {};
  const chain: DocStyleEntry[] = [];
  const visited = new Set<string>();
  let currId: string | undefined = styleId;
  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const entry = ctx.styles.get(currId);
    if (!entry) break;
    chain.unshift(entry);
    currId = entry.basedOn;
  }

  let tblBorders: TableBorderSet = {};
  let tblCellMar: [number, number, number, number] | undefined;
  for (const item of chain) {
    if (item.tblBorders) tblBorders = { ...tblBorders, ...item.tblBorders };
    if (item.tblCellMar) tblCellMar = item.tblCellMar;
  }
  return { tblBorders, tblCellMar };
}

async function parseNumberingXml(zip: JSZip): Promise<NumberingMap> {
  const numMap: NumberingMap = new Map();
  const file = zip.file('word/numbering.xml');
  if (!file) return numMap;

  const doc = parseXmlString(await file.async('string'));
  const root = doc.documentElement;
  if (!root) return numMap;

  const abstractMap = new Map<string, Map<number, NumberingLevel>>();
  for (const abs of directChildren(root, 'abstractNum')) {
    const absId = getAttr(abs, 'abstractNumId');
    if (!absId) continue;
    const lvls = new Map<number, NumberingLevel>();
    for (const lvl of directChildren(abs, 'lvl')) {
      const ilvl = Number(getAttr(lvl, 'ilvl') ?? '0') || 0;
      const format = getAttr(firstChild(lvl, 'numFmt'), 'val') ?? 'decimal';
      const lvlText = getAttr(firstChild(lvl, 'lvlText'), 'val') ?? '%1.';
      lvls.set(ilvl, { format, lvlText });
    }
    abstractMap.set(absId, lvls);
  }

  for (const num of directChildren(root, 'num')) {
    const numId = getAttr(num, 'numId');
    const absId = getAttr(firstChild(num, 'abstractNumId'), 'val');
    if (numId && absId && abstractMap.has(absId)) {
      numMap.set(numId, abstractMap.get(absId)!);
    }
  }

  return numMap;
}

async function parseRelsFile(zip: JSZip, relsPath: string): Promise<Map<string, RelEntry>> {
  const map = new Map<string, RelEntry>();
  const file = zip.file(relsPath);
  if (!file) return map;

  const doc = parseXmlString(await file.async('string'));
  const root = doc.documentElement;
  if (!root) return map;

  for (const rel of directChildren(root, 'Relationship')) {
    const id = getAttr(rel, 'Id');
    const target = getAttr(rel, 'Target');
    const type = getAttr(rel, 'Type') ?? '';
    if (id && target) {
      map.set(id, { target, type });
    }
  }
  return map;
}

function resolveZipTarget(basePartDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = basePartDir ? basePartDir.split('/').filter(Boolean) : [];
  for (const seg of target.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

async function rasterizeImageToPngDataUri(dataUri: string): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUri;
  });
}

async function loadImageAsPdfMakeDataUri(
  zip: JSZip,
  zipPath: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(zipPath)) return cache.get(zipPath) ?? null;

  const entry = zip.file(zipPath);
  if (!entry) {
    cache.set(zipPath, null);
    return null;
  }

  const ext = zipPath.split('.').pop()?.toLowerCase() ?? '';
  const bytes = await entry.async('uint8array');
  const base64 = uint8ToBase64(bytes);

  if (ext === 'png') {
    const uri = `data:image/png;base64,${base64}`;
    cache.set(zipPath, uri);
    return uri;
  }
  if (ext === 'jpg' || ext === 'jpeg') {
    const uri = `data:image/jpeg;base64,${base64}`;
    cache.set(zipPath, uri);
    return uri;
  }

  const mimeMap: Record<string, string> = {
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  };
  const mime = mimeMap[ext];
  if (mime) {
    const pngUri = await rasterizeImageToPngDataUri(`data:${mime};base64,${base64}`);
    cache.set(zipPath, pngUri);
    return pngUri;
  }

  cache.set(zipPath, null);
  return null;
}

/* -------------------------------------------------------------------------- */
/* OOXML Paragraph, Image & Table Builders                                    */
/* -------------------------------------------------------------------------- */

interface AnchorSpec {
  behindDoc?: boolean;
  posHRel?: string;
  posHXPt?: number;
  alignH?: string;
  posVRel?: string;
  posVYPt?: number;
  alignV?: string;
}

interface PageGeometry {
  pageWidthPt: number;
  pageHeightPt: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  usableWidthPt: number;
}

interface RunToken {
  kind: 'text' | 'tab' | 'pageBreak' | 'image';
  text?: string;
  style?: RunStyle;
  imageUri?: string;
  widthPt?: number;
  heightPt?: number;
  anchor?: AnchorSpec;
}

interface ParsedParagraphResult {
  content: Content | null;
  estimatedHeightPt: number;
  hasPageBreak: boolean;
}

interface BuildContext {
  zip: JSZip;
  styles: StylesContext;
  numbering: NumberingMap;
  numCounters: Map<string, number>;
  imageCache: Map<string, string | null>;
  page: PageGeometry;
}

function parseVmlDimensionPt(
  styleStr: string | null,
  prop: string,
  allowSigned = false,
): number | undefined {
  if (!styleStr) return undefined;
  const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|;)\\s*${escapedProp}\\s*:\\s*(-?[0-9.]+)(pt|px|in|cm|mm)?`, 'i');
  const m = styleStr.match(regex);
  if (!m) return undefined;
  const val = Number(m[1]);
  if (!Number.isFinite(val)) return undefined;
  if (!allowSigned && val <= 0) return undefined;
  const unit = (m[2] ?? 'pt').toLowerCase();
  if (unit === 'pt') return val;
  if (unit === 'px') return val * 0.75;
  if (unit === 'in') return val * 72;
  if (unit === 'cm') return val * 28.3465;
  if (unit === 'mm') return val * 2.83465;
  return val;
}

function parseVmlCssText(styleStr: string | null, prop: string): string | undefined {
  if (!styleStr) return undefined;
  const escapedProp = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:^|;)\\s*${escapedProp}\\s*:\\s*([^;]+)`, 'i');
  const m = styleStr.match(regex);
  return m ? m[1].trim().toLowerCase() : undefined;
}

async function extractImagesFromDrawing(
  drawingEl: Element,
  rels: Map<string, RelEntry>,
  partDir: string,
  bctx: BuildContext,
): Promise<RunToken[]> {
  const tokens: RunToken[] = [];
  const anchorEl = firstChild(drawingEl, 'anchor');
  const inlineEl = firstChild(drawingEl, 'inline');
  const frameEl = anchorEl ?? inlineEl;

  const extEl = firstChild(frameEl, 'extent') ?? findDescendants(drawingEl, 'extent')[0];
  const wPt = emuToPt(getAttr(extEl, 'cx')) ?? 140;
  const hPt = emuToPt(getAttr(extEl, 'cy')) ?? 60;

  let anchor: AnchorSpec | undefined;
  if (anchorEl) {
    const positionH = firstChild(anchorEl, 'positionH');
    const positionV = firstChild(anchorEl, 'positionV');
    const posHRel = (getAttr(positionH, 'relativeFrom') ?? 'column').toLowerCase();
    const posVRel = (getAttr(positionV, 'relativeFrom') ?? 'paragraph').toLowerCase();
    const posHXPt = emuToSignedPt(firstChild(positionH, 'posOffset')?.textContent?.trim());
    const posVYPt = emuToSignedPt(firstChild(positionV, 'posOffset')?.textContent?.trim());
    const alignH = firstChild(positionH, 'align')?.textContent?.trim().toLowerCase();
    const alignV = firstChild(positionV, 'align')?.textContent?.trim().toLowerCase();
    const behindAttr = (getAttr(anchorEl, 'behindDoc') ?? '').toLowerCase();
    const behindDoc = behindAttr === '1' || behindAttr === 'true';

    anchor = {
      behindDoc,
      posHRel,
      posHXPt,
      alignH,
      posVRel,
      posVYPt,
      alignV,
    };
  }

  const blips = findDescendants(drawingEl, 'blip');
  for (const blip of blips) {
    const rId = getAttr(blip, 'embed') ?? getAttr(blip, 'link');
    if (!rId) continue;
    const rel = rels.get(rId);
    if (!rel) continue;
    const imgPath = resolveZipTarget(partDir, rel.target);
    const dataUri = await loadImageAsPdfMakeDataUri(bctx.zip, imgPath, bctx.imageCache);
    if (dataUri) {
      tokens.push({
        kind: 'image',
        imageUri: dataUri,
        widthPt: wPt,
        heightPt: hPt,
        anchor,
      });
    }
  }

  return tokens;
}

async function extractRunTokens(
  pEl: Element,
  baseRunStyle: RunStyle,
  rels: Map<string, RelEntry>,
  partDir: string,
  bctx: BuildContext,
): Promise<RunToken[]> {
  const tokens: RunToken[] = [];

  const processRun = async (rEl: Element, linkOverride?: RunStyle) => {
    const rPr = firstChild(rEl, 'rPr');
    const charStyleId = getAttr(firstChild(rPr, 'rStyle'), 'val');
    const charStyle = resolveRunStyleChain(bctx.styles, charStyleId);
    const directStyle = parseRunStyle(rPr);
    const finalStyle = mergeRunStyle(
      mergeRunStyle(mergeRunStyle(baseRunStyle, charStyle), linkOverride),
      directStyle,
    );

    const children = directChildren(rEl);
    for (const child of children) {
      const tag = localNameOf(child);
      if (tag === 't' || tag === 'delText') {
        const txt = child.textContent ?? '';
        if (txt.length > 0) {
          tokens.push({ kind: 'text', text: txt, style: finalStyle });
        }
      } else if (tag === 'tab' || tag === 'ptab') {
        tokens.push({ kind: 'tab', style: finalStyle });
      } else if (tag === 'br') {
        const brType = (getAttr(child, 'type') ?? '').toLowerCase();
        if (brType === 'page') {
          tokens.push({ kind: 'pageBreak' });
        } else {
          tokens.push({ kind: 'text', text: '\n', style: finalStyle });
        }
      } else if (tag === 'cr') {
        tokens.push({ kind: 'text', text: '\n', style: finalStyle });
      } else if (tag === 'noBreakHyphen') {
        tokens.push({ kind: 'text', text: '-', style: finalStyle });
      } else if (tag === 'drawing') {
        tokens.push(...(await extractImagesFromDrawing(child, rels, partDir, bctx)));
      } else if (tag === 'pict') {
        const imagedatas = findDescendants(child, 'imagedata');
        const shape =
          firstChild(child, 'shape') ??
          directChildren(child).find((el) => localNameOf(el) !== 'shapetype') ??
          child;
        const shapeStyle = getAttr(shape, 'style');
        const wPt = parseVmlDimensionPt(shapeStyle, 'width') ?? 140;
        const hPt = parseVmlDimensionPt(shapeStyle, 'height') ?? 60;

        let anchor: AnchorSpec | undefined;
        if (parseVmlCssText(shapeStyle, 'position') === 'absolute') {
          const zIdx = Number(parseVmlCssText(shapeStyle, 'z-index') ?? '0');
          const posHXPt =
            parseVmlDimensionPt(shapeStyle, 'margin-left', true) ??
            parseVmlDimensionPt(shapeStyle, 'left', true);
          const posVYPt =
            parseVmlDimensionPt(shapeStyle, 'margin-top', true) ??
            parseVmlDimensionPt(shapeStyle, 'top', true);
          const alignH = parseVmlCssText(shapeStyle, 'mso-position-horizontal');
          const alignV = parseVmlCssText(shapeStyle, 'mso-position-vertical');
          const relH = parseVmlCssText(shapeStyle, 'mso-position-horizontal-relative') ?? 'column';
          const relV = parseVmlCssText(shapeStyle, 'mso-position-vertical-relative') ?? 'paragraph';
          anchor = {
            behindDoc: Number.isFinite(zIdx) && zIdx < 0,
            posHRel: relH === 'text' ? 'column' : relH,
            posHXPt,
            alignH,
            posVRel: relV === 'text' ? 'paragraph' : relV,
            posVYPt,
            alignV,
          };
        }

        for (const im of imagedatas) {
          const rId = getAttr(im, 'id');
          if (!rId) continue;
          const rel = rels.get(rId);
          if (!rel) continue;
          const imgPath = resolveZipTarget(partDir, rel.target);
          const dataUri = await loadImageAsPdfMakeDataUri(bctx.zip, imgPath, bctx.imageCache);
          if (dataUri) {
            tokens.push({
              kind: 'image',
              imageUri: dataUri,
              widthPt: wPt,
              heightPt: hPt,
              anchor,
            });
          }
        }
      } else if (tag === 'AlternateContent') {
        const choice = firstChild(child, 'Choice') ?? firstChild(child, 'Fallback');
        if (choice) {
          for (const subDrawing of findDescendants(choice, 'drawing')) {
            tokens.push(...(await extractImagesFromDrawing(subDrawing, rels, partDir, bctx)));
          }
        }
      }
    }
  };

  for (const node of directChildren(pEl)) {
    const tag = localNameOf(node);
    if (tag === 'r') {
      await processRun(node);
    } else if (tag === 'hyperlink') {
      for (const rEl of directChildren(node, 'r')) {
        await processRun(rEl, { color: '#1d4ed8', underline: true });
      }
    } else if (tag === 'fldSimple') {
      const instr = getAttr(node, 'instr') ?? '';
      const isPageField = /\bPAGE\b/i.test(instr);
      const isNumPagesField = /\bNUMPAGES\b/i.test(instr);
      for (const rEl of directChildren(node, 'r')) {
        if (isPageField) {
          tokens.push({ kind: 'text', text: '{{PAGE}}', style: baseRunStyle });
        } else if (isNumPagesField) {
          tokens.push({ kind: 'text', text: '{{NUMPAGES}}', style: baseRunStyle });
        } else {
          await processRun(rEl);
        }
      }
    } else if (tag === 'sdt') {
      const sdtContent = firstChild(node, 'sdtContent');
      if (sdtContent) {
        for (const rEl of directChildren(sdtContent, 'r')) {
          await processRun(rEl);
        }
      }
    } else if (tag === 'ins') {
      for (const rEl of directChildren(node, 'r')) {
        await processRun(rEl);
      }
    }
  }

  return tokens;
}

function buildTextSpan(text: string, style?: RunStyle): any {
  const span: any = { text };
  if (style?.bold) span.bold = true;
  if (style?.italic) span.italics = true;
  if (style?.underline) span.decoration = 'underline';
  else if (style?.strike) span.decoration = 'lineThrough';
  if (style?.fontSize) span.fontSize = Number(style.fontSize.toFixed(1));
  if (style?.color) span.color = style.color;
  if (style?.highlight) span.background = style.highlight;
  return span;
}

function nextListPrefix(pStyle: ParagraphStyle, bctx: BuildContext): string | null {
  if (!pStyle.numId) return null;
  const lvl = pStyle.ilvl ?? 0;
  const levels = bctx.numbering.get(pStyle.numId);
  const spec = levels?.get(lvl);

  if (!spec || spec.format === 'bullet') {
    return '•  ';
  }
  const key = `${pStyle.numId}:${lvl}`;
  const count = (bctx.numCounters.get(key) ?? 0) + 1;
  bctx.numCounters.set(key, count);

  if (spec.format === 'lowerLetter') {
    const ch = String.fromCharCode(97 + ((count - 1) % 26));
    return `${ch}) `;
  }
  if (spec.format === 'upperLetter') {
    const ch = String.fromCharCode(65 + ((count - 1) % 26));
    return `${ch}. `;
  }
  return `${count}. `;
}

function buildAnchoredImageNode(
  tok: RunToken,
  bctx: BuildContext,
  paraLeftMargin: number,
  insideCell: boolean,
): Content {
  const page = bctx.page;
  const anchor = tok.anchor ?? {};
  let w = tok.widthPt ?? 120;
  let h = tok.heightPt ?? 60;
  const maxAllowedW = Math.max(40, page.pageWidthPt - 16);
  if (w > maxAllowedW) {
    const s = maxAllowedW / w;
    w = maxAllowedW;
    h *= s;
  }

  const relH = (anchor.posHRel ?? 'column').toLowerCase();
  let originX = page.marginLeft;
  let regionW = page.usableWidthPt;
  if (relH === 'page') {
    originX = 0;
    regionW = page.pageWidthPt;
  } else if (relH === 'leftmargin') {
    originX = 0;
    regionW = page.marginLeft;
  } else if (relH === 'rightmargin' || relH === 'outsidemargin') {
    originX = page.pageWidthPt - page.marginRight;
    regionW = page.marginRight;
  } else if (relH === 'character') {
    originX = page.marginLeft + paraLeftMargin;
    regionW = Math.max(40, page.usableWidthPt - paraLeftMargin);
  }

  let absX: number;
  if (anchor.posHXPt !== undefined) {
    absX = originX + anchor.posHXPt;
  } else if (anchor.alignH === 'right' || anchor.alignH === 'outside') {
    absX = originX + regionW - w;
  } else if (anchor.alignH === 'center') {
    absX = originX + (regionW - w) / 2;
  } else {
    absX = originX;
  }
  absX = Math.max(4, Math.min(page.pageWidthPt - w - 4, absX));

  const relV = (anchor.posVRel ?? 'paragraph').toLowerCase();
  const isPageVertical =
    relV === 'page' ||
    relV === 'margin' ||
    relV === 'topmargin' ||
    relV === 'bottommargin' ||
    relV === 'insidemargin' ||
    relV === 'outsidemargin';

  if (isPageVertical) {
    let originY = page.marginTop;
    let regionH = Math.max(40, page.pageHeightPt - page.marginTop - page.marginBottom);
    if (relV === 'page') {
      originY = 0;
      regionH = page.pageHeightPt;
    } else if (relV === 'topmargin') {
      originY = 0;
      regionH = page.marginTop;
    } else if (relV === 'bottommargin') {
      originY = page.pageHeightPt - page.marginBottom;
      regionH = page.marginBottom;
    }

    let absY: number;
    if (anchor.posVYPt !== undefined) {
      absY = originY + anchor.posVYPt;
    } else if (anchor.alignV === 'bottom') {
      absY = originY + regionH - h;
    } else if (anchor.alignV === 'center') {
      absY = originY + (regionH - h) / 2;
    } else {
      absY = originY;
    }
    absY = Math.max(4, Math.min(page.pageHeightPt - h - 4, absY));

    return {
      image: tok.imageUri!,
      width: Number(w.toFixed(1)),
      height: Number(h.toFixed(1)),
      absolutePosition: {
        x: Number(absX.toFixed(1)),
        y: Number(absY.toFixed(1)),
      },
    };
  }

  // Paragraph / line relative anchor: pdfmake detached block starts at (page.marginLeft, currentY) at top level
  const relX = insideCell
    ? (anchor.posHXPt ?? 0)
    : absX - page.marginLeft;
  const relY = Math.max(-350, Math.min(500, anchor.posVYPt ?? 0));

  return {
    image: tok.imageUri!,
    width: Number(w.toFixed(1)),
    height: Number(h.toFixed(1)),
    relativePosition: {
      x: Number(relX.toFixed(1)),
      y: Number(relY.toFixed(1)),
    },
  };
}

function splitSpansOnWideSpaceGap(spans: any[]): [any[], any[]] | null {
  const fullText = spans.map((s) => s.text ?? '').join('');
  if (fullText.includes('\n')) return null;

  const match = fullText.match(/^(.+?\S)([ \u00A0]{6,})(\S.*)$/);
  if (!match) return null;

  const leftStr = match[1];
  const gapLen = match[2].length;
  const rightStr = match[3];
  if (leftStr.trim().length < 2 || rightStr.trim().length === 0 || rightStr.trim().length > 42) {
    return null;
  }

  const gapStart = leftStr.length;
  const gapEnd = gapStart + gapLen;

  const leftSpans: any[] = [];
  const rightSpans: any[] = [];
  let cursor = 0;

  for (const span of spans) {
    const txt: string = span.text ?? '';
    const spanStart = cursor;
    const spanEnd = cursor + txt.length;
    cursor = spanEnd;

    if (spanEnd <= gapStart) {
      leftSpans.push({ ...span });
    } else if (spanStart >= gapEnd) {
      rightSpans.push({ ...span });
    } else {
      if (spanStart < gapStart) {
        const part = txt.slice(0, gapStart - spanStart);
        if (part.length > 0) leftSpans.push({ ...span, text: part });
      }
      if (spanEnd > gapEnd) {
        const part = txt.slice(gapEnd - spanStart);
        if (part.length > 0) rightSpans.push({ ...span, text: part });
      }
    }
  }

  return leftSpans.length > 0 && rightSpans.length > 0 ? [leftSpans, rightSpans] : null;
}

function attachAnchoredImages(
  baseResult: ParsedParagraphResult,
  anchoredNodes: Content[],
): ParsedParagraphResult {
  if (anchoredNodes.length === 0 || !baseResult.content) {
    return baseResult;
  }

  const baseAny = baseResult.content as any;
  const hoistedPageBreak = baseAny.pageBreak === 'before' ? ('before' as const) : undefined;
  if (hoistedPageBreak) {
    delete baseAny.pageBreak;
  }

  return {
    content: {
      stack: [...anchoredNodes, baseResult.content],
      ...(hoistedPageBreak ? { pageBreak: hoistedPageBreak } : {}),
    },
    estimatedHeightPt: baseResult.estimatedHeightPt,
    hasPageBreak: baseResult.hasPageBreak,
  };
}

async function buildParagraphContent(
  pEl: Element,
  maxWidthPt: number,
  rels: Map<string, RelEntry>,
  partDir: string,
  bctx: BuildContext,
  insideCell: boolean,
  hasFollowingPageBreak = false,
): Promise<ParsedParagraphResult> {
  const pPrEl = firstChild(pEl, 'pPr');
  const styleId = getAttr(firstChild(pPrEl, 'pStyle'), 'val');
  const baseStyle = resolveParagraphStyleChain(bctx.styles, styleId);
  const directP = parseParagraphStyle(pPrEl);
  const pStyle = mergeParagraphStyle(baseStyle, directP);

  const hasPageBreak = Boolean(pStyle.pageBreakBefore);
  const tokens = await extractRunTokens(
    pEl,
    pStyle.runStyle ?? {},
    rels,
    partDir,
    bctx,
  );

  let foundInlinePageBreak = false;
  const cleanTokens: RunToken[] = [];
  for (const t of tokens) {
    if (t.kind === 'pageBreak') {
      foundInlinePageBreak = true;
    } else {
      cleanTokens.push(t);
    }
  }

  const baseFontSize = pStyle.runStyle?.fontSize ?? 9.9;
  const lineHeight = pStyle.lineHeight ?? 1.16;
  const spaceBefore = insideCell ? Math.min(pStyle.spaceBefore ?? 0, 2) : (pStyle.spaceBefore ?? 0);
  const spaceAfter = insideCell
    ? Math.min(pStyle.spaceAfter ?? 1, 2.5)
    : (pStyle.spaceAfter ?? 3);

  const inlineImages = cleanTokens.filter((t) => t.kind === 'image' && !t.anchor);
  const anchoredImages = cleanTokens.filter((t) => t.kind === 'image' && Boolean(t.anchor));
  const hasVisibleText = cleanTokens.some(
    (t) => t.kind === 'text' && (t.text ?? '').replace(/\s+/g, '').length > 0,
  );

  const listPrefix = nextListPrefix(pStyle, bctx);
  let leftMargin = insideCell ? 0 : (pStyle.indentLeft ?? 0);
  const rightMargin = insideCell ? 0 : (pStyle.indentRight ?? 0);
  if (!insideCell && pStyle.numId) {
    leftMargin += 14 * ((pStyle.ilvl ?? 0) + 1);
  }

  // Clamp horizontal margins so narrow columns never collapse
  if (leftMargin + rightMargin > maxWidthPt * 0.55) {
    leftMargin = Math.min(leftMargin, maxWidthPt * 0.35);
  }

  const availableW = Math.max(30, maxWidthPt - leftMargin - rightMargin);

  const anchoredNodes: Content[] = anchoredImages.map((im) =>
    buildAnchoredImageNode(im, bctx, leftMargin, insideCell),
  );

  // Empty paragraph containing only floating anchored image(s)
  if (!hasVisibleText && inlineImages.length === 0 && anchoredNodes.length > 0) {
    const wrapped: Content =
      anchoredNodes.length === 1 && !hasPageBreak && !foundInlinePageBreak && !hasFollowingPageBreak
        ? anchoredNodes[0]
        : {
            stack: anchoredNodes,
            ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
            ...(foundInlinePageBreak || hasFollowingPageBreak ? { pageBreak: 'after' as const } : {}),
          };
    return {
      content: wrapped,
      estimatedHeightPt: 0,
      hasPageBreak: hasPageBreak || foundInlinePageBreak,
    };
  }

  // Empty spacer paragraph
  if (!hasVisibleText && inlineImages.length === 0) {
    if (foundInlinePageBreak || hasPageBreak || hasFollowingPageBreak) {
      return {
        content: {
          text: '',
          fontSize: 1,
          margin: [0, 0, 0, 0],
          pageBreak: hasPageBreak ? 'before' : 'after',
        },
        estimatedHeightPt: 0,
        hasPageBreak: true,
      };
    }
    const spacerH = insideCell ? 3 : Math.max(4, Math.min(14, baseFontSize * 0.65));
    return {
      content: { text: ' ', fontSize: Math.max(3, Math.round(spacerH * 0.7)), margin: [0, 0, 0, 0] },
      estimatedHeightPt: spacerH,
      hasPageBreak: false,
    };
  }

  // Pure inline image paragraph (common for company logos in header or body)
  if (!hasVisibleText && inlineImages.length > 0) {
    const imgItems: Content[] = inlineImages.map((im, idx) => {
      let w = im.widthPt ?? 120;
      let h = im.heightPt ?? 60;
      if (w > availableW) {
        const scale = availableW / w;
        w = availableW;
        h = h * scale;
      }
      return {
        image: im.imageUri!,
        width: Number(w.toFixed(1)),
        height: Number(h.toFixed(1)),
        alignment: pStyle.alignment === 'justify' ? 'left' : (pStyle.alignment ?? 'left'),
        margin: [
          leftMargin,
          idx === 0 ? spaceBefore : 2,
          rightMargin,
          idx === inlineImages.length - 1 ? spaceAfter : 2,
        ],
        ...(hasPageBreak && idx === 0 ? { pageBreak: 'before' as const } : {}),
      };
    });

    const totalImgH = imgItems.reduce((sum: number, item: any) => sum + (item.height ?? 40), 0);
    return attachAnchoredImages(
      {
        content: imgItems.length === 1 ? imgItems[0] : { stack: imgItems },
        estimatedHeightPt: totalImgH + spaceBefore + spaceAfter,
        hasPageBreak: hasPageBreak || foundInlinePageBreak,
      },
      anchoredNodes,
    );
  }

  // Paragraph contains inline image(s) alongside text: emit stack of text + images safely
  if (inlineImages.length > 0) {
    const stackItems: Content[] = [];
    let currentSpans: any[] = [];
    let estH = spaceBefore + spaceAfter;

    const flushSpans = () => {
      if (currentSpans.length === 0) return;
      stackItems.push({
        text: currentSpans,
        fontSize: Number(baseFontSize.toFixed(1)),
        lineHeight,
        alignment: pStyle.alignment ?? 'left',
        margin: [leftMargin, 0, rightMargin, 2],
      });
      estH += baseFontSize * lineHeight * 1.3;
      currentSpans = [];
    };

    if (listPrefix) {
      currentSpans.push(buildTextSpan(listPrefix, pStyle.runStyle));
    }

    for (const tok of cleanTokens) {
      if (tok.kind === 'text' && tok.text) {
        currentSpans.push(buildTextSpan(tok.text, tok.style));
      } else if (tok.kind === 'tab') {
        currentSpans.push(buildTextSpan('   ', tok.style));
      } else if (tok.kind === 'image' && !tok.anchor && tok.imageUri) {
        flushSpans();
        let w = tok.widthPt ?? 120;
        let h = tok.heightPt ?? 60;
        if (w > availableW) {
          const s = availableW / w;
          w = availableW;
          h *= s;
        }
        stackItems.push({
          image: tok.imageUri,
          width: Number(w.toFixed(1)),
          height: Number(h.toFixed(1)),
          alignment: pStyle.alignment === 'justify' ? 'left' : (pStyle.alignment ?? 'left'),
          margin: [leftMargin, 2, rightMargin, 2],
        });
        estH += h + 4;
      }
    }
    flushSpans();

    return attachAnchoredImages(
      {
        content: {
          stack: stackItems,
          margin: [0, spaceBefore, 0, spaceAfter],
          ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
        },
        estimatedHeightPt: estH,
        hasPageBreak: hasPageBreak || foundInlinePageBreak,
      },
      anchoredNodes,
    );
  }

  // Split text tokens into tab-separated groups
  const tabGroups: any[][] = [[]];
  for (const tok of cleanTokens) {
    if (tok.kind === 'tab') {
      tabGroups.push([]);
    } else if (tok.kind === 'text' && tok.text) {
      tabGroups[tabGroups.length - 1].push(buildTextSpan(tok.text, tok.style));
    }
  }

  const nonEmptyGroupIndices: number[] = [];
  tabGroups.forEach((grp, idx) => {
    const txt = grp.map((s) => s.text).join('').trim();
    if (txt.length > 0) nonEmptyGroupIndices.push(idx);
  });

  // Handle leading tabs before the first text (e.g. "\tЛист щодо...")
  if (
    !insideCell &&
    tabGroups.length > 1 &&
    nonEmptyGroupIndices.length === 1 &&
    nonEmptyGroupIndices[0] > 0
  ) {
    const leadingTabsCount = nonEmptyGroupIndices[0];
    const tabPos = pStyle.tabs?.[leadingTabsCount - 1]?.posPt;
    const extraIndent = tabPos && tabPos > leftMargin ? Math.min(180, tabPos) : leftMargin + leadingTabsCount * 28;
    const spans = tabGroups[nonEmptyGroupIndices[0]];
    if (listPrefix) spans.unshift(buildTextSpan(listPrefix, pStyle.runStyle));
    const totalChars = spans.map((s) => s.text).join('').length;
    const estLines = Math.max(1, Math.ceil((totalChars * baseFontSize * 0.52) / Math.max(40, availableW - extraIndent)));

    return attachAnchoredImages(
      {
        content: {
          text: spans,
          fontSize: Number(baseFontSize.toFixed(1)),
          lineHeight,
          alignment: pStyle.alignment ?? 'left',
          margin: [extraIndent, spaceBefore, rightMargin, spaceAfter],
          ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
        },
        estimatedHeightPt: estLines * baseFontSize * lineHeight + spaceBefore + spaceAfter,
        hasPageBreak: hasPageBreak || foundInlinePageBreak,
      },
      anchoredNodes,
    );
  }

  // Signature / multi-column tab lines at top level (e.g. "Директор ПП «Будпостач» \t Шитлін Д.В.")
  if (!insideCell && tabGroups.length >= 2 && nonEmptyGroupIndices.length >= 2) {
    const activeGroups = tabGroups
      .filter((grp) => grp.map((s) => s.text).join('').trim().length > 0)
      .slice(0, 4);

    if (activeGroups.length === 2) {
      const rightTab = pStyle.tabs?.[pStyle.tabs.length - 1];
      const rightAlign =
        rightTab?.val === 'center' ? 'center' : 'right';
      return attachAnchoredImages(
        {
          content: {
            columns: [
              {
                width: '*',
                text: activeGroups[0],
                fontSize: Number(baseFontSize.toFixed(1)),
                lineHeight,
                alignment: 'left',
              },
              {
                width: 'auto',
                text: activeGroups[1],
                fontSize: Number(baseFontSize.toFixed(1)),
                lineHeight,
                alignment: rightAlign,
              },
            ],
            columnGap: 12,
            margin: [leftMargin, spaceBefore, rightMargin, spaceAfter],
            ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
          },
          estimatedHeightPt: baseFontSize * lineHeight + spaceBefore + spaceAfter,
          hasPageBreak: hasPageBreak || foundInlinePageBreak,
        },
        anchoredNodes,
      );
    }

    if (activeGroups.length >= 3) {
      return attachAnchoredImages(
        {
          content: {
            columns: activeGroups.map((grp, i) => ({
              width: '*',
              text: grp,
              fontSize: Number(baseFontSize.toFixed(1)),
              lineHeight,
              alignment: i === activeGroups.length - 1 ? 'right' : 'left',
            })),
            columnGap: 8,
            margin: [leftMargin, spaceBefore, rightMargin, spaceAfter],
            ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
          },
          estimatedHeightPt: baseFontSize * lineHeight + spaceBefore + spaceAfter,
          hasPageBreak: hasPageBreak || foundInlinePageBreak,
        },
        anchoredNodes,
      );
    }
  }

  // Handle manual space-aligned two-part lines (e.g. "To: PE «BUDPOSTACH»        25.11.2026")
  if (
    !insideCell &&
    !listPrefix &&
    nonEmptyGroupIndices.length === 1 &&
    (pStyle.alignment ?? 'left') === 'left'
  ) {
    const spaceSplit = splitSpansOnWideSpaceGap(tabGroups[nonEmptyGroupIndices[0]]);
    if (spaceSplit) {
      return attachAnchoredImages(
        {
          content: {
            columns: [
              {
                width: '*',
                text: spaceSplit[0],
                fontSize: Number(baseFontSize.toFixed(1)),
                lineHeight,
                alignment: 'left',
              },
              {
                width: 'auto',
                text: spaceSplit[1],
                fontSize: Number(baseFontSize.toFixed(1)),
                lineHeight,
                alignment: 'right',
              },
            ],
            columnGap: 12,
            margin: [leftMargin, spaceBefore, rightMargin, spaceAfter],
            ...(hasPageBreak ? { pageBreak: 'before' as const } : {}),
          },
          estimatedHeightPt: baseFontSize * lineHeight + spaceBefore + spaceAfter,
          hasPageBreak: hasPageBreak || foundInlinePageBreak,
        },
        anchoredNodes,
      );
    }
  }

  // Standard paragraph
  const mergedSpans: any[] = [];
  if (listPrefix) {
    mergedSpans.push(buildTextSpan(listPrefix, pStyle.runStyle));
  }
  tabGroups.forEach((grp, idx) => {
    if (idx > 0 && grp.length > 0) {
      mergedSpans.push(buildTextSpan('   ', pStyle.runStyle));
    }
    mergedSpans.push(...grp);
  });

  const plainText = mergedSpans.map((s) => s.text).join('');
  const estLines = Math.max(
    plainText.split('\n').length,
    Math.ceil((plainText.length * baseFontSize * 0.52) / availableW),
  );

  const node: any = {
    text: mergedSpans,
    fontSize: Number(baseFontSize.toFixed(1)),
    lineHeight,
    alignment: pStyle.alignment ?? 'left',
    margin: [leftMargin, spaceBefore, rightMargin, spaceAfter],
  };

  if (!insideCell && pStyle.firstLineIndent && pStyle.firstLineIndent > 0 && !pStyle.numId) {
    node.leadingIndent = Number(pStyle.firstLineIndent.toFixed(1));
  }
  if (hasPageBreak) {
    node.pageBreak = 'before';
  }
  if (foundInlinePageBreak || hasFollowingPageBreak) {
    node.pageBreak = 'after';
  }

  if (pStyle.bottomBorder) {
    return attachAnchoredImages(
      {
        content: {
          stack: [
            node,
            {
              canvas: [
                {
                  type: 'line',
                  x1: leftMargin,
                  y1: 0,
                  x2: maxWidthPt - rightMargin,
                  y2: 0,
                  lineWidth: pStyle.bottomBorder.width,
                  lineColor: pStyle.bottomBorder.color,
                },
              ],
              margin: [0, 1, 0, Math.max(2, spaceAfter)],
            },
          ],
        },
        estimatedHeightPt: estLines * baseFontSize * lineHeight + spaceBefore + spaceAfter + 4,
        hasPageBreak: hasPageBreak || foundInlinePageBreak,
      },
      anchoredNodes,
    );
  }

  return attachAnchoredImages(
    {
      content: node,
      estimatedHeightPt: estLines * baseFontSize * lineHeight + spaceBefore + spaceAfter,
      hasPageBreak: hasPageBreak || foundInlinePageBreak,
    },
    anchoredNodes,
  );
}

interface TableCellData {
  isCovered: boolean;
  colSpan: number;
  rowSpan: number;
  stackContent: Content[];
  fillColor?: string;
  borders: [boolean, boolean, boolean, boolean]; // [left, top, right, bottom]
  borderColors: [string, string, string, string];
  borderWidths: [number, number, number, number];
}

function resolveEffectiveBorder(
  cellSpec: BorderSpec | undefined,
  tableEdgeSpec: BorderSpec | undefined,
  tableInsideSpec: BorderSpec | undefined,
  isEdge: boolean,
): BorderSpec {
  if (cellSpec !== undefined) return cellSpec;
  if (isEdge && tableEdgeSpec !== undefined) return tableEdgeSpec;
  if (!isEdge && tableInsideSpec !== undefined) return tableInsideSpec;
  if (tableEdgeSpec !== undefined) return tableEdgeSpec;
  return { enabled: false, width: 0, color: '#1e293b' };
}

async function buildTableContent(
  tblEl: Element,
  maxWidthPt: number,
  rels: Map<string, RelEntry>,
  partDir: string,
  bctx: BuildContext,
): Promise<{ content: Content; estimatedHeightPt: number }> {
  const tblPr = firstChild(tblEl, 'tblPr');
  const tblStyleId = getAttr(firstChild(tblPr, 'tblStyle'), 'val');
  const styleResolved = resolveTableStyleChain(bctx.styles, tblStyleId);

  const directBorders = parseTableBorders(firstChild(tblPr, 'tblBorders'));
  const tblBorders: TableBorderSet = {
    top: directBorders.top ?? styleResolved.tblBorders?.top,
    bottom: directBorders.bottom ?? styleResolved.tblBorders?.bottom,
    left: directBorders.left ?? styleResolved.tblBorders?.left,
    right: directBorders.right ?? styleResolved.tblBorders?.right,
    insideH: directBorders.insideH ?? styleResolved.tblBorders?.insideH,
    insideV: directBorders.insideV ?? styleResolved.tblBorders?.insideV,
  };

  const cellMar =
    parseCellMargins(firstChild(tblPr, 'tblCellMar')) ??
    styleResolved.tblCellMar ?? [4.5, 3, 4.5, 3];

  const [padLeft, padTop, padRight, padBottom] = cellMar;

  // Determine raw column widths from tblGrid
  const tblGrid = firstChild(tblEl, 'tblGrid');
  const rawColPts: number[] = [];
  if (tblGrid) {
    for (const gc of directChildren(tblGrid, 'gridCol')) {
      rawColPts.push(Math.max(16, twipsToPt(getAttr(gc, 'w'), 80)));
    }
  }

  const trList = directChildren(tblEl, 'tr');
  let detectedCols = rawColPts.length;
  for (const tr of trList) {
    const trPr = firstChild(tr, 'trPr');
    const beforeCols = Number(getAttr(firstChild(trPr, 'gridBefore'), 'val') ?? '0') || 0;
    const afterCols = Number(getAttr(firstChild(trPr, 'gridAfter'), 'val') ?? '0') || 0;
    let rowCols = beforeCols + afterCols;
    for (const tc of directChildren(tr, 'tc')) {
      const tcPr = firstChild(tc, 'tcPr');
      const span = Number(getAttr(firstChild(tcPr, 'gridSpan'), 'val') ?? '1') || 1;
      rowCols += span;
    }
    if (rowCols > detectedCols) detectedCols = rowCols;
  }

  const numCols = Math.max(1, detectedCols);
  while (rawColPts.length < numCols) {
    rawColPts.push(maxWidthPt / numCols);
  }

  // Check requested table width
  const tblWEl = firstChild(tblPr, 'tblW');
  const tblWType = (getAttr(tblWEl, 'type') ?? 'dxa').toLowerCase();
  const tblWVal = Number(getAttr(tblWEl, 'w') ?? '0');
  const rawGridSum = rawColPts.slice(0, numCols).reduce((a, b) => a + b, 0) || maxWidthPt;

  let targetOuterWidth = maxWidthPt;
  if (tblWType === 'pct' && tblWVal > 0) {
    const ratio = Math.min(1, tblWVal / 5000);
    targetOuterWidth = Math.max(80, maxWidthPt * ratio);
  } else if (tblWType === 'dxa' && tblWVal > 0) {
    targetOuterWidth = Math.min(maxWidthPt, Math.max(80, tblWVal / 20));
  } else if (rawGridSum > 40) {
    targetOuterWidth = Math.min(maxWidthPt, rawGridSum);
  }

  // Reserve space for cell horizontal paddings & vertical grid lines so table never clips right margin
  const strokeReserve = 1.0;
  const tableChromeWidth = numCols * (padLeft + padRight) + (numCols + 1) * strokeReserve + 1;
  const availableInnerWidth = Math.max(40, targetOuterWidth - tableChromeWidth);
  const scaleFactor = availableInnerWidth / Math.max(1, rawGridSum);
  const widths = rawColPts
    .slice(0, numCols)
    .map((w) => Math.max(12, Number((w * scaleFactor).toFixed(2))));

  const grid: TableCellData[][] = [];
  const activeVerticalOrigins: Array<TableCellData | null> = new Array(numCols).fill(null);
  let totalEstHeight = 8;

  for (let r = 0; r < trList.length; r++) {
    const tr = trList[r];
    const rowCells: TableCellData[] = new Array(numCols);
    const trPr = firstChild(tr, 'trPr');
    const gridBefore = Number(getAttr(firstChild(trPr, 'gridBefore'), 'val') ?? '0') || 0;

    let c = 0;
    for (let k = 0; k < gridBefore && c < numCols; k++, c++) {
      activeVerticalOrigins[c] = null;
      rowCells[c] = {
        isCovered: false,
        colSpan: 1,
        rowSpan: 1,
        stackContent: [{ text: '', fontSize: 1, margin: [0, 0, 0, 0] }],
        borders: [false, false, false, false],
        borderColors: ['#1e293b', '#1e293b', '#1e293b', '#1e293b'],
        borderWidths: [0.6, 0.6, 0.6, 0.6],
      };
    }

    const tcs = directChildren(tr, 'tc');
    let rowMaxEstH = 14;

    for (const tc of tcs) {
      if (c >= numCols) break;
      const tcPr = firstChild(tc, 'tcPr');
      const rawSpan = Number(getAttr(firstChild(tcPr, 'gridSpan'), 'val') ?? '1') || 1;
      const colSpan = Math.min(rawSpan, numCols - c);

      const vMergeEl = firstChild(tcPr, 'vMerge');
      const vMergeVal = vMergeEl ? (getAttr(vMergeEl, 'val') ?? 'continue').toLowerCase() : 'none';

      const tcBordersEl = firstChild(tcPr, 'tcBorders');
      const cellLeftSpec = parseBorderElement(firstChild(tcBordersEl, 'left') ?? firstChild(tcBordersEl, 'start'));
      const cellTopSpec = parseBorderElement(firstChild(tcBordersEl, 'top'));
      const cellRightSpec = parseBorderElement(firstChild(tcBordersEl, 'right') ?? firstChild(tcBordersEl, 'end'));
      const cellBottomSpec = parseBorderElement(firstChild(tcBordersEl, 'bottom'));

      const effLeft = resolveEffectiveBorder(cellLeftSpec, tblBorders.left, tblBorders.insideV, c === 0);
      const effTop = resolveEffectiveBorder(cellTopSpec, tblBorders.top, tblBorders.insideH, r === 0);
      const effRight = resolveEffectiveBorder(
        cellRightSpec,
        tblBorders.right,
        tblBorders.insideV,
        c + colSpan >= numCols,
      );
      const effBottom = resolveEffectiveBorder(
        cellBottomSpec,
        tblBorders.bottom,
        tblBorders.insideH,
        r === trList.length - 1,
      );

      if (vMergeVal === 'continue' && activeVerticalOrigins[c]) {
        const origin = activeVerticalOrigins[c]!;
        origin.rowSpan += 1;
        // Propagate bottom border onto origin once merge extends downward
        if (effBottom.enabled) {
          origin.borders[3] = true;
          origin.borderColors[3] = effBottom.color;
          origin.borderWidths[3] = effBottom.width;
        }
        for (let spanOffset = 0; spanOffset < colSpan; spanOffset++) {
          rowCells[c + spanOffset] = {
            isCovered: true,
            colSpan: 1,
            rowSpan: 1,
            stackContent: [{ text: '' }],
            borders: [effLeft.enabled, effTop.enabled, effRight.enabled, effBottom.enabled],
            borderColors: [effLeft.color, effTop.color, effRight.color, effBottom.color],
            borderWidths: [effLeft.width, effTop.width, effRight.width, effBottom.width],
          };
        }
        c += colSpan;
        continue;
      }

      const shdEl = firstChild(tcPr, 'shd');
      const shdFill = normalizeHexColor(getAttr(shdEl, 'fill'));
      const fillColor = shdFill && shdFill !== '#ffffff' ? shdFill : undefined;

      // Span width across merged columns
      let cellInnerW = 0;
      for (let k = 0; k < colSpan; k++) {
        cellInnerW += widths[c + k] ?? 60;
      }
      cellInnerW = Math.max(20, cellInnerW + Math.max(0, colSpan - 1) * (padLeft + padRight));

      // Collect cell paragraphs & nested tables cleanly
      const cellStack: Content[] = [];
      let cellEstH = 0;
      for (const child of directChildren(tc)) {
        const tag = localNameOf(child);
        if (tag === 'p') {
          const parsedP = await buildParagraphContent(
            child,
            cellInnerW,
            rels,
            partDir,
            bctx,
            true,
          );
          if (parsedP.content) {
            cellStack.push(parsedP.content);
            cellEstH += parsedP.estimatedHeightPt;
          }
        } else if (tag === 'tbl') {
          const nested = await buildTableContent(child, cellInnerW, rels, partDir, bctx);
          cellStack.push(nested.content);
          cellEstH += nested.estimatedHeightPt;
        }
      }

      if (cellStack.length === 0) {
        cellStack.push({ text: '', fontSize: 8, margin: [0, 0, 0, 0] });
      }
      if (cellEstH > rowMaxEstH) rowMaxEstH = cellEstH;

      const entry: TableCellData = {
        isCovered: false,
        colSpan,
        rowSpan: 1,
        stackContent: cellStack,
        fillColor,
        borders: [effLeft.enabled, effTop.enabled, effRight.enabled, effBottom.enabled],
        borderColors: [effLeft.color, effTop.color, effRight.color, effBottom.color],
        borderWidths: [effLeft.width, effTop.width, effRight.width, effBottom.width],
      };

      rowCells[c] = entry;
      for (let spanOffset = 1; spanOffset < colSpan; spanOffset++) {
        rowCells[c + spanOffset] = {
          isCovered: true,
          colSpan: 1,
          rowSpan: 1,
          stackContent: [{ text: '' }],
          borders: [false, effTop.enabled, effRight.enabled, effBottom.enabled],
          borderColors: [effLeft.color, effTop.color, effRight.color, effBottom.color],
          borderWidths: [effLeft.width, effTop.width, effRight.width, effBottom.width],
        };
      }

      for (let spanOffset = 0; spanOffset < colSpan; spanOffset++) {
        activeVerticalOrigins[c + spanOffset] = vMergeVal === 'restart' ? entry : null;
      }

      c += colSpan;
    }

    while (c < numCols) {
      activeVerticalOrigins[c] = null;
      rowCells[c] = {
        isCovered: false,
        colSpan: 1,
        rowSpan: 1,
        stackContent: [{ text: '', fontSize: 1, margin: [0, 0, 0, 0] }],
        borders: [false, false, false, false],
        borderColors: ['#1e293b', '#1e293b', '#1e293b', '#1e293b'],
        borderWidths: [0.6, 0.6, 0.6, 0.6],
      };
      c++;
    }

    grid.push(rowCells);
    totalEstHeight += rowMaxEstH + padTop + padBottom;
  }

  // Ensure empty-table safety
  if (grid.length === 0) {
    return {
      content: { text: '', fontSize: 1, margin: [0, 0, 0, 0] },
      estimatedHeightPt: 0,
    };
  }

  const body: TableCell[][] = grid.map((row) =>
    row.map((cell): TableCell => {
      if (cell.isCovered) {
        return { text: '' };
      }

      const out: any = {
        stack: cell.stackContent,
        border: cell.borders,
        borderColor: cell.borderColors,
        margin: [0, 0, 0, 0],
      };

      if (cell.colSpan > 1) out.colSpan = cell.colSpan;
      if (cell.rowSpan > 1) out.rowSpan = cell.rowSpan;
      if (cell.fillColor) out.fillColor = cell.fillColor;
      return out;
    }),
  );

  // Pick representative line width/color for table layout
  let defaultLineWidth = 0.6;
  let defaultLineColor = '#1e293b';
  for (const row of grid) {
    for (const cell of row) {
      if (cell.borders.some(Boolean)) {
        const idx = cell.borders.findIndex(Boolean);
        defaultLineWidth = cell.borderWidths[idx] ?? 0.6;
        defaultLineColor = cell.borderColors[idx] ?? '#1e293b';
        break;
      }
    }
  }

  const tblAlign = (getAttr(firstChild(tblPr, 'jc'), 'val') ?? 'left').toLowerCase();
  const wrapperMarginLeft =
    tblAlign === 'center' && maxWidthPt > targetOuterWidth + 8
      ? Number(((maxWidthPt - targetOuterWidth) / 2).toFixed(1))
      : tblAlign === 'right' && maxWidthPt > targetOuterWidth + 8
        ? Number((maxWidthPt - targetOuterWidth).toFixed(1))
        : 0;

  return {
    content: {
      table: {
        widths,
        body,
        dontBreakRows: true,
      },
      layout: {
        hLineWidth: () => defaultLineWidth,
        vLineWidth: () => defaultLineWidth,
        hLineColor: () => defaultLineColor,
        vLineColor: () => defaultLineColor,
        paddingLeft: () => padLeft,
        paddingRight: () => padRight,
        paddingTop: () => padTop,
        paddingBottom: () => padBottom,
      },
      margin: [wrapperMarginLeft, 2, 0, 6],
    },
    estimatedHeightPt: totalEstHeight,
  };
}

async function parseBlockElements(
  container: Element,
  maxWidthPt: number,
  rels: Map<string, RelEntry>,
  partDir: string,
  bctx: BuildContext,
): Promise<{ items: Content[]; estimatedHeightPt: number }> {
  const items: Content[] = [];
  let totalHeight = 0;

  for (const child of directChildren(container)) {
    const tag = localNameOf(child);
    if (tag === 'p') {
      const pPr = firstChild(child, 'pPr');
      const hasSectionBreak = Boolean(firstChild(pPr, 'sectPr'));
      const res = await buildParagraphContent(
        child,
        maxWidthPt,
        rels,
        partDir,
        bctx,
        false,
        hasSectionBreak,
      );
      if (res.content) {
        items.push(res.content);
        totalHeight += res.estimatedHeightPt;
      }
    } else if (tag === 'tbl') {
      const tbl = await buildTableContent(child, maxWidthPt, rels, partDir, bctx);
      items.push(tbl.content);
      totalHeight += tbl.estimatedHeightPt;
    } else if (tag === 'sdt') {
      const sdtContent = firstChild(child, 'sdtContent');
      if (sdtContent) {
        const sub = await parseBlockElements(sdtContent, maxWidthPt, rels, partDir, bctx);
        items.push(...sub.items);
        totalHeight += sub.estimatedHeightPt;
      }
    }
  }

  return { items, estimatedHeightPt: totalHeight };
}

function replacePagePlaceholders(node: any, currentPage: number, pageCount: number): any {
  if (typeof node === 'string') {
    return node
      .replace(/\{\{PAGE\}\}/g, String(currentPage))
      .replace(/\{\{NUMPAGES\}\}/g, String(pageCount));
  }
  if (Array.isArray(node)) {
    return node.map((item) => replacePagePlaceholders(item, currentPage, pageCount));
  }
  if (node && typeof node === 'object') {
    const cloned: any = {};
    for (const [k, v] of Object.entries(node)) {
      cloned[k] = replacePagePlaceholders(v, currentPage, pageCount);
    }
    return cloned;
  }
  return node;
}

async function parseHeaderOrFooterPart(
  zip: JSZip,
  targetPath: string,
  usableWidthPt: number,
  bctx: BuildContext,
): Promise<{ items: Content[]; estimatedHeightPt: number }> {
  const xmlFile = zip.file(targetPath);
  if (!xmlFile) return { items: [], estimatedHeightPt: 0 };

  const lastSlash = targetPath.lastIndexOf('/');
  const partDir = lastSlash >= 0 ? targetPath.slice(0, lastSlash) : 'word';
  const fileName = lastSlash >= 0 ? targetPath.slice(lastSlash + 1) : targetPath;
  const partRelsPath = `${partDir}/_rels/${fileName}.rels`;

  const rels = await parseRelsFile(zip, partRelsPath);
  const doc = parseXmlString(await xmlFile.async('string'));
  const root = doc.documentElement;
  if (!root) return { items: [], estimatedHeightPt: 0 };

  const parsed = await parseBlockElements(root, usableWidthPt, rels, partDir, bctx);

  // Trim trailing spacer paragraphs in headers/footers to keep margins clean
  while (parsed.items.length > 0) {
    const last = parsed.items[parsed.items.length - 1] as any;
    if (typeof last?.text === 'string' && last.text.trim() === '' && !last.pageBreak) {
      parsed.items.pop();
    } else {
      break;
    }
  }

  return parsed;
}

async function convertDocxToPdfBytes(buffer: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(buffer);
  const docEntry = zip.file('word/document.xml');
  if (!docEntry) {
    throw new Error('Invalid .docx archive: missing word/document.xml');
  }

  const docXml = await docEntry.async('string');
  const docDom = parseXmlString(docXml);
  const bodyEl = firstChild(docDom.documentElement, 'body');
  if (!bodyEl) {
    throw new Error('Invalid .docx archive: missing document body');
  }

  const [styles, numbering, docRels] = await Promise.all([
    parseStylesXml(zip),
    parseNumberingXml(zip),
    parseRelsFile(zip, 'word/_rels/document.xml.rels'),
  ]);

  const sectPrList = directChildren(bodyEl, 'sectPr');
  const sectPr = sectPrList[sectPrList.length - 1] ?? findDescendants(bodyEl, 'sectPr').pop() ?? null;

  const pgSzEl = firstChild(sectPr, 'pgSz');
  let pageWidthPt = twipsToPt(getAttr(pgSzEl, 'w'), 595.28);
  let pageHeightPt = twipsToPt(getAttr(pgSzEl, 'h'), 841.89);
  const orientAttr = (getAttr(pgSzEl, 'orient') ?? '').toLowerCase();
  if (orientAttr === 'landscape' && pageWidthPt < pageHeightPt) {
    [pageWidthPt, pageHeightPt] = [pageHeightPt, pageWidthPt];
  }
  const orientation: 'portrait' | 'landscape' =
    pageWidthPt > pageHeightPt ? 'landscape' : 'portrait';

  const pgMarEl = firstChild(sectPr, 'pgMar');
  let marginTop = Math.max(24, Math.min(110, twipsToPt(getAttr(pgMarEl, 'top'), 56.7)));
  const marginRight = Math.max(24, Math.min(110, twipsToPt(getAttr(pgMarEl, 'right'), 42.5)));
  let marginBottom = Math.max(24, Math.min(110, twipsToPt(getAttr(pgMarEl, 'bottom'), 56.7)));
  const marginLeft = Math.max(24, Math.min(110, twipsToPt(getAttr(pgMarEl, 'left'), 68.0)));
  const headerTopOffset = Math.max(12, Math.min(48, twipsToPt(getAttr(pgMarEl, 'header'), 20)));
  const footerBottomOffset = Math.max(12, Math.min(48, twipsToPt(getAttr(pgMarEl, 'footer'), 20)));

  const usableWidthPt = Math.max(200, pageWidthPt - marginLeft - marginRight);

  const bctx: BuildContext = {
    zip,
    styles,
    numbering,
    numCounters: new Map(),
    imageCache: new Map(),
    page: {
      pageWidthPt,
      pageHeightPt,
      marginLeft,
      marginRight,
      marginTop,
      marginBottom,
      usableWidthPt,
    },
  };

  // Parse headers & footers referenced by sectPr
  const headerRefs = sectPr ? directChildren(sectPr, 'headerReference') : [];
  const footerRefs = sectPr ? directChildren(sectPr, 'footerReference') : [];

  const titlePg = Boolean(sectPr && firstChild(sectPr, 'titlePg'));
  const headerByType = new Map<string, { items: Content[]; estimatedHeightPt: number }>();
  const footerByType = new Map<string, { items: Content[]; estimatedHeightPt: number }>();

  for (const href of headerRefs) {
    const rId = getAttr(href, 'id');
    const type = (getAttr(href, 'type') ?? 'default').toLowerCase();
    if (!rId) continue;
    const rel = docRels.get(rId);
    if (!rel) continue;
    const targetPath = resolveZipTarget('word', rel.target);
    headerByType.set(
      type,
      await parseHeaderOrFooterPart(zip, targetPath, usableWidthPt, bctx),
    );
  }

  for (const fref of footerRefs) {
    const rId = getAttr(fref, 'id');
    const type = (getAttr(fref, 'type') ?? 'default').toLowerCase();
    if (!rId) continue;
    const rel = docRels.get(rId);
    if (!rel) continue;
    const targetPath = resolveZipTarget('word', rel.target);
    footerByType.set(
      type,
      await parseHeaderOrFooterPart(zip, targetPath, usableWidthPt, bctx),
    );
  }

  let maxHeaderHeight = 0;
  for (const h of headerByType.values()) {
    if (h.items.length > 0 && h.estimatedHeightPt > maxHeaderHeight) {
      maxHeaderHeight = h.estimatedHeightPt;
    }
  }
  if (maxHeaderHeight > 0) {
    marginTop = Math.max(marginTop, Math.ceil(headerTopOffset + maxHeaderHeight + 12));
  }

  let maxFooterHeight = 0;
  for (const f of footerByType.values()) {
    if (f.items.length > 0 && f.estimatedHeightPt > maxFooterHeight) {
      maxFooterHeight = f.estimatedHeightPt;
    }
  }
  if (maxFooterHeight > 0) {
    marginBottom = Math.max(marginBottom, Math.ceil(footerBottomOffset + maxFooterHeight + 10));
  }

  bctx.page.marginTop = marginTop;
  bctx.page.marginBottom = marginBottom;

  const bodyParsed = await parseBlockElements(bodyEl, usableWidthPt, docRels, 'word', bctx);

  // Trim trailing empty spacer paragraphs from document body so stray trailing blank page does not appear
  while (bodyParsed.items.length > 1) {
    const last = bodyParsed.items[bodyParsed.items.length - 1] as any;
    if (typeof last?.text === 'string' && last.text.trim() === '' && !last.pageBreak) {
      bodyParsed.items.pop();
    } else {
      break;
    }
  }

  if (bodyParsed.items.length === 0 && maxHeaderHeight === 0) {
    throw new Error('Document contains no renderable content');
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: {
      width: Number(pageWidthPt.toFixed(2)),
      height: Number(pageHeightPt.toFixed(2)),
    },
    pageOrientation: orientation,
    pageMargins: [marginLeft, marginTop, marginRight, marginBottom],
    defaultStyle: {
      font: 'Roboto',
      fontSize: Number((styles.defaultRun.fontSize ?? 10.5).toFixed(1)),
      color: styles.defaultRun.color ?? '#0f172a',
      lineHeight: styles.defaultParagraph.lineHeight ?? 1.16,
    },
    content: bodyParsed.items.length > 0 ? bodyParsed.items : [{ text: '' }],
  };

  if (maxHeaderHeight > 0) {
    docDefinition.header = (currentPage: number, pageCount: number) => {
      const part = titlePg
        ? currentPage === 1
          ? headerByType.get('first') ?? headerByType.get('default')
          : headerByType.get('default')
        : headerByType.get('default') ?? headerByType.get('first');
      if (!part || part.items.length === 0) return { text: '' };
      return {
        stack: replacePagePlaceholders(part.items, currentPage, pageCount),
        margin: [marginLeft, headerTopOffset, marginRight, 0],
      };
    };
  }

  if (maxFooterHeight > 0) {
    docDefinition.footer = (currentPage: number, pageCount: number) => {
      const part = titlePg
        ? currentPage === 1
          ? footerByType.get('first') ?? footerByType.get('default')
          : footerByType.get('default')
        : footerByType.get('default') ?? footerByType.get('first');
      if (!part || part.items.length === 0) return { text: '' };
      return {
        stack: replacePagePlaceholders(part.items, currentPage, pageCount),
        margin: [marginLeft, 4, marginRight, footerBottomOffset],
      };
    };
  }

  const pdfDoc = pdfMake.createPdf(docDefinition);
  const outBuffer: Uint8Array = await pdfDoc.getBuffer();
  return outBuffer instanceof Uint8Array ? outBuffer : new Uint8Array(outBuffer);
}

/* -------------------------------------------------------------------------- */
/* Legacy .doc (OLE2), .rtf, HTML-as-.doc Extractors & Vector PDF Builder      */
/* -------------------------------------------------------------------------- */

function cleanWordText(raw: string): string {
  let text = raw.replace(/\x13[^\x14\x15]*\x14/g, '');
  text = text.replace(/[\x13\x14\x15]/g, '');
  text = text.replace(/\x07/g, '\t');
  text = text.replace(/[\x0b\x0c]/g, '\n');
  text = text.replace(/\r\n?/g, '\n');
  text = text.replace(/[\x00-\x08\x0e-\x1f]/g, '');
  return text;
}

function extractTextFromOle2Doc(bytes: Uint8Array): string {
  const container = CFB.read(bytes, { type: 'array' });
  const wordEntry = CFB.find(container, 'WordDocument') ?? CFB.find(container, '/WordDocument');
  if (!wordEntry || !wordEntry.content) {
    throw new Error('Invalid .doc file: missing WordDocument stream');
  }

  const wBytes =
    wordEntry.content instanceof Uint8Array
      ? wordEntry.content
      : new Uint8Array(wordEntry.content);
  const wView = new DataView(wBytes.buffer, wBytes.byteOffset, wBytes.byteLength);

  if (wBytes.length < 0x1a8) {
    throw new Error('Corrupted .doc header');
  }

  const flags = wView.getUint16(0x000a, true);
  const tableName = (flags & 0x0200) !== 0 ? '1Table' : '0Table';
  const tableEntry = CFB.find(container, tableName) ?? CFB.find(container, `/${tableName}`);

  let pos = 32;
  const csw = wView.getUint16(pos, true);
  pos += 2 + csw * 2;
  const cslw = wView.getUint16(pos, true);
  const ccpText = cslw > 3 && pos + 2 + 16 <= wBytes.length ? wView.getInt32(pos + 2 + 3 * 4, true) : 0;
  pos += 2 + cslw * 4;
  const cbRgFcLcb = pos + 2 <= wBytes.length ? wView.getUint16(pos, true) : 0;
  pos += 2;

  const fcClxOffset = pos + 33 * 8;
  const hasClx =
    tableEntry &&
    tableEntry.content &&
    cbRgFcLcb > 33 &&
    fcClxOffset + 8 <= wBytes.length;

  if (hasClx && tableEntry?.content) {
    const tBytes =
      tableEntry.content instanceof Uint8Array
        ? tableEntry.content
        : new Uint8Array(tableEntry.content);
    const tView = new DataView(tBytes.buffer, tBytes.byteOffset, tBytes.byteLength);

    const fcClx = wView.getUint32(fcClxOffset, true);
    const lcbClx = wView.getUint32(fcClxOffset + 4, true);

    if (fcClx + lcbClx <= tBytes.length && lcbClx > 0) {
      let clxPos = fcClx;
      const clxEnd = fcClx + lcbClx;

      while (clxPos < clxEnd && tBytes[clxPos] === 0x01) {
        if (clxPos + 3 > clxEnd) break;
        const cbGrpprl = tView.getUint16(clxPos + 1, true);
        clxPos += 3 + cbGrpprl;
      }

      if (clxPos + 5 <= clxEnd && tBytes[clxPos] === 0x02) {
        const lcbPlcPcd = tView.getUint32(clxPos + 1, true);
        const plcStart = clxPos + 5;
        const plcEnd = Math.min(plcStart + lcbPlcPcd, tBytes.length);
        const nPieces = Math.floor((plcEnd - plcStart - 4) / 12);

        if (nPieces > 0) {
          const cpBase = plcStart;
          const pcdBase = plcStart + (nPieces + 1) * 4;
          const win1251 = new TextDecoder('windows-1251', { fatal: false });
          const utf16 = new TextDecoder('utf-16le', { fatal: false });
          const chunks: string[] = [];
          let collectedChars = 0;

          for (let i = 0; i < nPieces; i++) {
            const cpStart = tView.getUint32(cpBase + i * 4, true);
            const cpEnd = tView.getUint32(cpBase + (i + 1) * 4, true);
            let charCount = cpEnd - cpStart;
            if (charCount <= 0) continue;

            if (ccpText > 0 && collectedChars >= ccpText) break;
            if (ccpText > 0 && collectedChars + charCount > ccpText) {
              charCount = ccpText - collectedChars;
            }

            const pcdOffset = pcdBase + i * 8;
            if (pcdOffset + 8 > plcEnd) break;
            const fcRaw = tView.getUint32(pcdOffset + 2, true);
            const isCompressed = (fcRaw & 0x40000000) !== 0;

            if (isCompressed) {
              const byteStart = (fcRaw & ~0x40000000) >>> 1;
              const byteEnd = Math.min(byteStart + charCount, wBytes.length);
              if (byteStart < byteEnd) {
                chunks.push(win1251.decode(wBytes.subarray(byteStart, byteEnd)));
              }
            } else {
              const byteStart = fcRaw;
              const byteEnd = Math.min(byteStart + charCount * 2, wBytes.length);
              if (byteStart < byteEnd) {
                chunks.push(utf16.decode(wBytes.subarray(byteStart, byteEnd)));
              }
            }

            collectedChars += charCount;
          }

          const joined = cleanWordText(chunks.join(''));
          if (joined.trim().length > 0) {
            return joined;
          }
        }
      }
    }
  }

  const fcMin = wView.getUint32(0x0018, true);
  const fcMac = wView.getUint32(0x001c, true);
  if (fcMac > fcMin && fcMac <= wBytes.length) {
    const slice = wBytes.subarray(fcMin, fcMac);
    let zeroOrCyrHigh = 0;
    const sampleLen = Math.min(slice.length, 512);
    for (let i = 1; i < sampleLen; i += 2) {
      if (slice[i] === 0x00 || slice[i] === 0x04) zeroOrCyrHigh++;
    }
    const isUtf16 = sampleLen > 10 && zeroOrCyrHigh / (sampleLen / 2) > 0.35;
    const decoded = new TextDecoder(isUtf16 ? 'utf-16le' : 'windows-1251', { fatal: false }).decode(
      slice,
    );
    const cleaned = cleanWordText(decoded);
    if (cleaned.trim().length > 0) {
      return cleaned;
    }
  }

  throw new Error('Could not extract readable text from .doc file');
}

function extractTextFromRtf(bytes: Uint8Array): string {
  const raw = new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
  const win1251 = new TextDecoder('windows-1251', { fatal: false });
  const output: string[] = [];
  let skipGroupDepth = 0;
  let depth = 0;
  let ucSkip = 1;

  const skipDestinations = new Set([
    'fonttbl',
    'colortbl',
    'stylesheet',
    'info',
    'pict',
    'object',
    'header',
    'footer',
    'headerl',
    'headerr',
    'headerf',
    'footerl',
    'footerr',
    'footerf',
    'fldinst',
    'xmlopen',
    'datastore',
    'themedata',
    'colorschememapping',
    'latentstyles',
    'listtable',
    'listoverridetable',
  ]);

  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];

    if (ch === '{') {
      depth++;
      i++;
      continue;
    }

    if (ch === '}') {
      if (skipGroupDepth === depth) {
        skipGroupDepth = 0;
      }
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }

    if (skipGroupDepth > 0 && depth >= skipGroupDepth) {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= raw.length) break;
      const next = raw[i];

      if (next === '\\' || next === '{' || next === '}') {
        output.push(next);
        i++;
        continue;
      }

      if (next === '*') {
        skipGroupDepth = depth;
        i++;
        continue;
      }

      if (next === '\'') {
        const hex = raw.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          output.push(win1251.decode(new Uint8Array([parseInt(hex, 16)])));
          i += 3;
          continue;
        }
      }

      if (next === '\r' || next === '\n') {
        output.push('\n');
        i++;
        continue;
      }

      const match = raw.slice(i).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (match) {
        const word = match[1];
        const param = match[2] !== undefined ? Number(match[2]) : undefined;
        i += match[0].length;

        if (skipDestinations.has(word)) {
          skipGroupDepth = depth;
        } else if (word === 'par' || word === 'line') {
          output.push('\n');
        } else if (word === 'tab') {
          output.push('\t');
        } else if (word === 'uc' && param !== undefined) {
          ucSkip = Math.max(0, param);
        } else if (word === 'u' && param !== undefined) {
          const codePoint = param < 0 ? param + 65536 : param;
          output.push(String.fromCharCode(codePoint));
          let skipped = 0;
          while (skipped < ucSkip && i < raw.length) {
            if (raw[i] === '\\' && raw[i + 1] === "'") {
              i += 4;
            } else {
              i++;
            }
            skipped++;
          }
        }
        continue;
      }

      i++;
      continue;
    }

    if (ch !== '\r' && ch !== '\n') {
      output.push(ch);
    }
    i++;
  }

  return output.join('');
}

function structuredTextToPdfContent(text: string): Content[] {
  const lines = text.split('\n');
  const content: Content[] = [];
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;

    // Single two-column line like a signature row -> clean split columns instead of heavy grid
    if (tableRows.length === 1 && tableRows[0].length === 2) {
      content.push({
        columns: [
          { width: '*', text: tableRows[0][0].trim(), alignment: 'left' },
          { width: 'auto', text: tableRows[0][1].trim(), alignment: 'right' },
        ],
        margin: [0, 4, 0, 4],
      });
      tableRows = [];
      return;
    }

    const numCols = Math.max(1, ...tableRows.map((r) => r.length));
    const usableW = 595.28 - 48 - 48;
    const chromeW = numCols * 9 + (numCols + 1) * 0.6 + 1;
    const colW = Number((Math.max(30, (usableW - chromeW) / numCols)).toFixed(2));
    const widths = new Array(numCols).fill(colW);

    const body: TableCell[][] = tableRows.map((row, rIdx) => {
      const cells: TableCell[] = [];
      for (let c = 0; c < numCols; c++) {
        cells.push({
          text: (row[c] ?? '').trim(),
          fontSize: 9.5,
          bold: rIdx === 0,
          fillColor: rIdx === 0 ? '#f1f5f9' : undefined,
          margin: [0, 0, 0, 0],
        });
      }
      return cells;
    });

    content.push({
      table: {
        widths,
        body,
        dontBreakRows: true,
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => '#475569',
        vLineColor: () => '#475569',
        paddingLeft: () => 4.5,
        paddingRight: () => 4.5,
        paddingTop: () => 3,
        paddingBottom: () => 3,
      },
      margin: [0, 4, 0, 6],
    });
    tableRows = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.includes('\t')) {
      const cells = line.split('\t').filter((c, idx, arr) => !(idx === arr.length - 1 && c === ''));
      if (cells.length > 1) {
        tableRows.push(cells);
        continue;
      }
    }

    flushTable();
    const trimmed = line.trim();
    if (!trimmed) {
      content.push({ text: ' ', fontSize: 5, margin: [0, 0, 0, 0] });
    } else {
      content.push({
        text: trimmed,
        fontSize: 10.5,
        lineHeight: 1.18,
        margin: [0, 0, 0, 4],
      });
    }
  }

  flushTable();
  return content;
}

function htmlTableToPdfMake(tableEl: Element, maxWidthPt: number): Content {
  const trEls = Array.from(tableEl.querySelectorAll('tr'));
  if (trEls.length === 0) return { text: '' };

  let maxCols = 1;
  for (const tr of trEls) {
    let cols = 0;
    for (const cell of Array.from(tr.children)) {
      if (cell.tagName === 'TD' || cell.tagName === 'TH') {
        cols += Math.max(1, Number(cell.getAttribute('colspan') ?? '1') || 1);
      }
    }
    if (cols > maxCols) maxCols = cols;
  }

  const occupied: boolean[][] = trEls.map(() => new Array(maxCols).fill(false));
  const body: TableCell[][] = [];

  for (let r = 0; r < trEls.length; r++) {
    const row: any[] = new Array(maxCols).fill(null);
    const cells = Array.from(trEls[r].children).filter(
      (el) => el.tagName === 'TD' || el.tagName === 'TH',
    );
    let c = 0;
    for (const cellEl of cells) {
      while (c < maxCols && occupied[r][c]) c++;
      if (c >= maxCols) break;

      const colSpan = Math.min(maxCols - c, Math.max(1, Number(cellEl.getAttribute('colspan') ?? '1') || 1));
      const rowSpan = Math.min(trEls.length - r, Math.max(1, Number(cellEl.getAttribute('rowspan') ?? '1') || 1));

      for (let rr = r; rr < r + rowSpan; rr++) {
        for (let cc = c; cc < c + colSpan; cc++) {
          if (rr !== r || cc !== c) {
            occupied[rr][cc] = true;
          }
        }
      }

      const isTh = cellEl.tagName === 'TH';
      const cellObj: any = {
        text: (cellEl.textContent ?? '').replace(/\s+/g, ' ').trim(),
        fontSize: 9.5,
        bold: isTh,
        fillColor: isTh ? '#f1f5f9' : undefined,
        margin: [0, 0, 0, 0],
      };
      if (colSpan > 1) cellObj.colSpan = colSpan;
      if (rowSpan > 1) cellObj.rowSpan = rowSpan;

      row[c] = cellObj;
      c += colSpan;
    }

    for (let k = 0; k < maxCols; k++) {
      if (!row[k]) row[k] = { text: '' };
    }
    body.push(row);
  }

  const chromeW = maxCols * 9 + (maxCols + 1) * 0.6 + 1;
  const colW = Number(Math.max(24, (maxWidthPt - chromeW) / maxCols).toFixed(2));

  return {
    table: {
      widths: new Array(maxCols).fill(colW),
      body,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => '#475569',
      vLineColor: () => '#475569',
      paddingLeft: () => 4.5,
      paddingRight: () => 4.5,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 4, 0, 6],
  };
}

function htmlDocToPdfContent(bytes: Uint8Array): Content[] {
  const raw = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(raw, 'text/html');
  parsed.querySelectorAll('script, style, iframe, object, embed').forEach((el) => el.remove());

  const root = parsed.body;
  if (!root) return structuredTextToPdfContent(raw);

  const usableW = 595.28 - 96;
  const blocks: Content[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const txt = (node.textContent ?? '').trim();
      if (txt) {
        blocks.push({ text: txt, fontSize: 10.5, margin: [0, 0, 0, 4] });
      }
      return;
    }
    if (node.nodeType !== 1) return;

    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    if (tag === 'TABLE') {
      blocks.push(htmlTableToPdfMake(el, usableW));
      return;
    }
    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const sizes = [16, 14, 12.5, 11.5, 11, 10.5];
      const txt = (el.textContent ?? '').trim();
      if (txt) {
        blocks.push({
          text: txt,
          fontSize: sizes[level - 1] ?? 11,
          bold: true,
          margin: [0, 6, 0, 4],
        });
      }
      return;
    }
    if (tag === 'P' || tag === 'LI') {
      const txt = (el.textContent ?? '').trim();
      if (txt) {
        blocks.push({
          text: tag === 'LI' ? `•  ${txt}` : txt,
          fontSize: 10.5,
          margin: [tag === 'LI' ? 12 : 0, 0, 0, 4],
        });
      }
      return;
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child);
    }
  };

  for (const child of Array.from(root.childNodes)) {
    walk(child);
  }

  return blocks.length > 0 ? blocks : structuredTextToPdfContent(root.textContent ?? '');
}

async function buildSimpleDocPdfBytes(content: Content[]): Promise<Uint8Array> {
  const safeContent: Content[] = content.length > 0 ? content : [{ text: '' }];
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [48, 48, 48, 48],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10.5,
      color: '#0f172a',
      lineHeight: 1.18,
    },
    content: safeContent,
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  const outBuffer: Uint8Array = await pdfDoc.getBuffer();
  return outBuffer instanceof Uint8Array ? outBuffer : new Uint8Array(outBuffer);
}

/**
 * Step 1 of Word -> PDF -> JPEG -> PDF:
 * Converts a Word document (.docx, .doc, .rtf, HTML-as-doc) into a clean
 * vector PDF (Uint8Array) with accurate page layout, embedded images, tables,
 * merged cells, borders, and Cyrillic/Latin typography, eliminating HTML/canvas
 * baseline distortion and border clipping.
 */
export async function convertWordToIntermediatePdf(file: File): Promise<Uint8Array> {
  ensurePdfMakeFonts();

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectWordFormat(bytes, file.name);

  if (format === 'docx') {
    return convertDocxToPdfBytes(buffer);
  }

  if (format === 'html') {
    return buildSimpleDocPdfBytes(htmlDocToPdfContent(bytes));
  }

  const text = format === 'rtf' ? extractTextFromRtf(bytes) : extractTextFromOle2Doc(bytes);
  return buildSimpleDocPdfBytes(structuredTextToPdfContent(text));
}
