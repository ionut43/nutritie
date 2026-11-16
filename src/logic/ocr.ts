/** Rând OCR cu poziție relativă (0–1) */
export interface OcrLine { text: string; x: number; y: number; w: number; h: number }

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[ŞŢ]/g, (c) => (c === 'Ş' ? 'S' : 'T'));

/** Reface rândurile vizuale (bucăți de text aflate la aceeași înălțime), de sus în jos */
export function linesToRows(lines: OcrLine[]): string[] {
  const items = lines.filter((l) => l.text.trim()).map((l) => ({ ...l, cy: l.y + l.h / 2 }));
  items.sort((a, b) => a.cy - b.cy);
  const rows: { cy: number; h: number; parts: typeof items }[] = [];
  for (const it of items) {
    const row = rows.find((r) => Math.abs(r.cy - it.cy) < Math.max(r.h, it.h) * 0.55);
    if (row) {
      row.parts.push(it);
      row.cy = (row.cy * (row.parts.length - 1) + it.cy) / row.parts.length;
      row.h = Math.max(row.h, it.h);
    } else rows.push({ cy: it.cy, h: it.h, parts: [it] });
  }
  return rows.sort((a, b) => a.cy - b.cy).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.text.trim()).join('   '));
}

export const toNum = (s: string) => parseFloat(s.replace(/\s/g, '').replace(',', '.'));
