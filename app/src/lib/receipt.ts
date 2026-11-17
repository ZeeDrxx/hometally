/**
 * Pull the useful fields out of OCR'd receipt text: total, merchant, date.
 * OCR output is noisy, so every function is conservative and the user confirms before saving.
 */

const TOTAL_WORDS = /(total(\s*ttc)?|net\s*[aà]\s*payer|montant(\s*(ttc|total))?|[aà]\s*payer|المجموع|المبلغ)/i;
const SKIP_WORDS = /(tva|tax|rendu|monnaie|esp[eè]ces|change|remise|sous[-\s]?total|ht\b)/i;
// 1 234,50 · 1234.50 · 32,00 · 1.234,50 · 45 (with optional DH/MAD)
const AMOUNT = /(\d{1,3}(?:[ .  ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:dh|mad|dhs|درهم)?/gi;
const MAX_CENTS = 1_000_000_00;

export function parseAmounts(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT)) {
    const whole = m[1].replace(/[ .  ]/g, "");
    const frac = (m[2] ?? "").padEnd(2, "0");
    const cents = Number(whole) * 100 + Number(frac || "0");
    if (Number.isFinite(cents) && cents > 0 && cents < MAX_CENTS) out.push(cents);
  }
  return out;
}

/** The total in centimes, or null. Prefers the last "TOTAL"-like line; falls back to the largest amount. */
export function extractTotalCents(text: string): number | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!TOTAL_WORDS.test(line) || SKIP_WORDS.test(line)) continue;
    const here = parseAmounts(line.replace(TOTAL_WORDS, " "));
    if (here.length) return here[here.length - 1];
    const next = lines[i + 1] ? parseAmounts(lines[i + 1]) : []; // "TOTAL" on one line, amount on the next
    if (next.length) return next[0];
  }
  const all = lines.filter((l) => !/\d{2}[/.-]\d{2}[/.-]\d{2,4}/.test(l) && !/ice|tel|t[eé]l|rc\b|if\b/i.test(l)).flatMap(parseAmounts);
  return all.length ? Math.max(...all) : null;
}

/** First line that looks like a name: mostly letters, not an address, not a date. */
export function extractMerchant(text: string): string | null {
  for (const raw of text.split(/\r?\n/).slice(0, 5)) {
    const line = raw.trim();
    const letters = line.replace(/[^\p{L}]/gu, "").length;
    if (letters >= 3 && letters / line.length > 0.6 && !/\b(bd|rue|av|avenue|tel|ice)\b/i.test(line)) {
      return line.length > 40 ? line.slice(0, 40) : line;
    }
  }
  return null;
}

/** dd/mm/yyyy (or dd-mm-yy, dd.mm.yyyy) as a local Date, or null. */
export function extractDate(text: string, now = new Date()): Date | null {
  const m = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(year, Number(mo) - 1, Number(d), 12);
  if (date.getMonth() !== Number(mo) - 1 || date > now || year < now.getFullYear() - 2) return null;
  return date;
}

export function formatMAD(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${whole},${(abs % 100).toString().padStart(2, "0")} MAD`;
}

/** "12,5" / "12.50" / "1 200" → centimes, or null. */
export function parseUserAmount(input: string): number | null {
  const s = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents < MAX_CENTS ? cents : null;
}

/** Local calendar month [start, end) in ms, offset months from `now`. */
export function monthRange(offset = 0, now = new Date()): { from: number; to: number; label: string } {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from: start.getTime(), to: end.getTime(), label: start.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
}
