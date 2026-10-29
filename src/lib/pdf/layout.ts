import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/** Tamaño A4 en puntos y márgenes del reporte. */
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BAND_H = 96;
const FOOTER_H = 34;

export const COLORS = {
  band: rgb(0.039, 0.055, 0.075),
  panel: rgb(0.067, 0.094, 0.125),
  ink: rgb(0.106, 0.133, 0.188),
  muted: rgb(0.353, 0.392, 0.467),
  line: rgb(0.82, 0.84, 0.88),
  zebra: rgb(0.955, 0.963, 0.973),
  accent: rgb(0.122, 0.373, 0.839),
  white: rgb(1, 1, 1),
  softWhite: rgb(0.78, 0.83, 0.88),
} as const;

/** Colores de nivel pensados para leerse sobre fondo blanco. */
export const LEVEL_TEXT_COLORS: Record<number, RGB> = {
  0: rgb(0.02, 0.5, 0.35),
  1: rgb(0.7, 0.45, 0.02),
  2: rgb(0.8, 0.31, 0.04),
  3: rgb(0.78, 0.09, 0.24),
};

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Deja solo caracteres que la fuente estándar del PDF (WinAnsi) puede dibujar.
 * Convierte subíndices a dígitos normales (CH₄ → CH4) y el signo menos a guion.
 */
export function pdfText(input: unknown): string {
  return String(input)
    .replace(/[₀-₉]/g, (c) => String(SUBSCRIPT_DIGITS.indexOf(c)))
    .replace(/[−–—]/g, '-')
    .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF]/g, '');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export interface Cell {
  text: string;
  color?: RGB;
  bold?: boolean;
}

export interface TableSpec {
  headers: string[];
  rows: (Cell | string)[][];
  /** Fracción del ancho útil para cada columna (suma 1). */
  widths: number[];
  align?: ('left' | 'right')[];
}

/** Documento PDF con cursor vertical: añade páginas cuando falta espacio y dibuja pie al final. */
export class PdfReport {
  private page!: PDFPage;
  private y = 0;
  private readonly pages: PDFPage[] = [];

  private constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly footerLeft: string,
  ) {}

  static async create(footerLeft: string): Promise<PdfReport> {
    const doc = await PDFDocument.create();
    doc.setCreator('VIGIA · monitoreo ambiental (simulación)');
    doc.setProducer('VIGIA');
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new PdfReport(doc, font, bold, footerLeft);
  }

  /** Encabezado de portada: franja oscura con título, subtítulo y acento de color. */
  cover(title: string, subtitle: string, accent: RGB) {
    this.newPage();
    this.page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: COLORS.band });
    this.page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: 6, height: BAND_H, color: accent });
    this.page.drawText(pdfText('VIGIA'), { x: MARGIN, y: PAGE_H - 34, size: 10, font: this.bold, color: COLORS.softWhite });
    this.page.drawText(pdfText(title), { x: MARGIN, y: PAGE_H - 60, size: 20, font: this.bold, color: COLORS.white });
    this.page.drawText(pdfText(subtitle), { x: MARGIN, y: PAGE_H - 80, size: 9.5, font: this.font, color: COLORS.softWhite });
    this.y = PAGE_H - BAND_H - 26;
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 10;
    this.page.drawText(pdfText(text), { x: MARGIN, y: this.y, size: 12, font: this.bold, color: COLORS.accent });
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.8,
      color: COLORS.line,
    });
    this.y -= 12;
  }

  paragraph(text: string, size = 9.5, color: RGB = COLORS.muted) {
    for (const line of wrap(pdfText(text), this.font, size, CONTENT_W)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font: this.font, color });
      this.y -= size + 4;
    }
    this.y -= 4;
  }

  /** Tarjetas de indicadores en una fila. */
  kpis(items: { label: string; value: string; color?: RGB }[]) {
    this.ensure(70);
    const gap = 10;
    const width = (CONTENT_W - gap * (items.length - 1)) / items.length;
    const height = 58;
    const top = this.y;
    items.forEach((item, i) => {
      const x = MARGIN + i * (width + gap);
      this.page.drawRectangle({ x, y: top - height, width, height, color: COLORS.zebra, borderColor: COLORS.line, borderWidth: 0.6 });
      this.page.drawText(pdfText(item.label), { x: x + 10, y: top - 18, size: 8, font: this.font, color: COLORS.muted });
      this.page.drawText(pdfText(item.value), {
        x: x + 10,
        y: top - 44,
        size: 15,
        font: this.bold,
        color: item.color ?? COLORS.ink,
      });
    });
    this.y = top - height - 14;
  }

  /** Pares etiqueta-valor, en dos columnas de texto alineadas. */
  keyValues(rows: [string, string | Cell][]) {
    const labelW = 165;
    for (const [label, raw] of rows) {
      const cell: Cell = typeof raw === 'string' ? { text: raw } : raw;
      const lines = wrap(pdfText(cell.text), this.font, 9.5, CONTENT_W - labelW);
      this.ensure(lines.length * 13 + 4);
      this.page.drawText(pdfText(label), { x: MARGIN, y: this.y, size: 9, font: this.font, color: COLORS.muted });
      lines.forEach((line, i) => {
        this.page.drawText(line, {
          x: MARGIN + labelW,
          y: this.y - i * 13,
          size: 9.5,
          font: cell.bold ? this.bold : this.font,
          color: cell.color ?? COLORS.ink,
        });
      });
      this.y -= lines.length * 13 + 4;
    }
    this.y -= 4;
  }

  /** Tabla con encabezado oscuro, filas alternas y saltos de página que repiten el encabezado. */
  table(spec: TableSpec) {
    const widths = spec.widths.map((f) => f * CONTENT_W);
    const align = spec.align ?? spec.widths.map(() => 'left' as const);
    const size = 8.5;
    const lineH = 11;
    const pad = 4;

    const drawHeader = () => {
      const headerH = 20;
      this.ensure(headerH + 30);
      this.page.drawRectangle({ x: MARGIN, y: this.y - headerH, width: CONTENT_W, height: headerH, color: COLORS.panel });
      let x = MARGIN;
      spec.headers.forEach((h, i) => {
        const textW = this.bold.widthOfTextAtSize(pdfText(h), size);
        const tx = align[i] === 'right' ? x + widths[i] - textW - pad : x + pad;
        this.page.drawText(pdfText(h), { x: tx, y: this.y - 13, size, font: this.bold, color: COLORS.white });
        x += widths[i];
      });
      this.y -= headerH;
    };

    drawHeader();
    spec.rows.forEach((row, rowIndex) => {
      const cells: Cell[] = row.map((c) => (typeof c === 'string' ? { text: c } : c));
      const wrapped = cells.map((c, i) => wrap(pdfText(c.text), c.bold ? this.bold : this.font, size, widths[i] - pad * 2));
      const lines = Math.max(1, ...wrapped.map((w) => w.length));
      const rowH = lines * lineH + pad * 2;

      if (this.y - rowH < MARGIN + FOOTER_H) {
        this.newPage();
        drawHeader();
      }

      if (rowIndex % 2 === 1) {
        this.page.drawRectangle({ x: MARGIN, y: this.y - rowH, width: CONTENT_W, height: rowH, color: COLORS.zebra });
      }
      let x = MARGIN;
      wrapped.forEach((lines2, i) => {
        const cell = cells[i];
        lines2.forEach((line, li) => {
          const textW = (cell.bold ? this.bold : this.font).widthOfTextAtSize(line, size);
          const tx = align[i] === 'right' ? x + widths[i] - textW - pad : x + pad;
          this.page.drawText(line, {
            x: tx,
            y: this.y - pad - 8 - li * lineH,
            size,
            font: cell.bold ? this.bold : this.font,
            color: cell.color ?? COLORS.ink,
          });
        });
        x += widths[i];
      });
      this.y -= rowH;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y },
        end: { x: PAGE_W - MARGIN, y: this.y },
        thickness: 0.4,
        color: COLORS.line,
      });
    });
    this.y -= 12;
  }

  /** Texto de vacío cuando una sección no tiene datos. */
  empty(text: string) {
    this.paragraph(text, 9.5, COLORS.muted);
  }

  /** Dibuja el pie en todas las páginas y devuelve el PDF. */
  async save(): Promise<Uint8Array> {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      page.drawLine({
        start: { x: MARGIN, y: MARGIN + 14 },
        end: { x: PAGE_W - MARGIN, y: MARGIN + 14 },
        thickness: 0.5,
        color: COLORS.line,
      });
      page.drawText(pdfText(this.footerLeft), { x: MARGIN, y: MARGIN, size: 7.5, font: this.font, color: COLORS.muted });
      const label = pdfText(`Página ${i + 1} de ${total}`);
      const w = this.font.widthOfTextAtSize(label, 7.5);
      page.drawText(label, { x: PAGE_W - MARGIN - w, y: MARGIN, size: 7.5, font: this.font, color: COLORS.muted });
    });
    return this.doc.save();
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
    this.page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: COLORS.band });
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER_H) this.newPage();
  }
}
