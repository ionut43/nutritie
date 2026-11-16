/** Durate găsite în textul unui pas („fierbe 20 de minute”, „4–5 minute”, „1 oră și jumătate”) */
export interface StepTimer { label: string; seconds: number }

const NUM: Record<string, number> = { o: 1, un: 1, una: 1, doua: 2, două: 2, trei: 3, patru: 4, cinci: 5, zece: 10, cincisprezece: 15, douazeci: 20, douăzeci: 20 };

export function timersInStep(step: string): StepTimer[] {
  const s = step.toLowerCase();
  const out: StepTimer[] = [];
  const re = /(\d+(?:[.,]\d+)?|o|un|una|două|doua|trei|patru|cinci|zece|cincisprezece|douăzeci|douazeci)(?:\s*[–-]\s*(\d+))?\s*(?:de\s+)?(secunde|secundă|sec|minute|minut|min|ore|oră|ora)(?![a-zăâîșț])(\s+și\s+jumătate)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const a = NUM[m[1]] ?? parseFloat(m[1].replace(',', '.'));
    const b = m[2] ? parseFloat(m[2]) : undefined;
    let v = b ?? a;
    if (!Number.isFinite(v) || v <= 0) continue;
    const unit = m[3];
    if (m[4]) v += 0.5;
    const seconds = unit.startsWith('sec') ? v : unit.startsWith('min') ? v * 60 : v * 3600;
    if (seconds < 20 || seconds > 6 * 3600) continue;
    const label = seconds >= 3600
      ? `${Math.floor(seconds / 3600)} h${seconds % 3600 ? ` ${Math.round((seconds % 3600) / 60)} min` : ''}`
      : seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} s`;
    if (!out.some((x) => x.seconds === seconds)) out.push({ label, seconds });
  }
  return out;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}
