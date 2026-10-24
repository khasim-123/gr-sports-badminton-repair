/**
 * Display formatting helpers (Indian locale).
 *   formatINR(1836)            -> "₹1,836"
 *   formatINR(149990)          -> "₹1,49,990"
 *   formatDate('2026-10-23')   -> "23 Oct 2026"
 *   formatDateTime(iso)        -> "23 Oct 2026, 4:30 PM"
 */

const inrFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** Rupee amount with Indian digit grouping. Non-numbers render as "₹0". */
export function formatINR(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (n === null || n === undefined || !Number.isFinite(n)) return '₹0';
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${inrFormatter.format(Math.abs(n))}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses an ISO timestamp, a "YYYY-MM-DD" date (as a local calendar date) or a
 * "YYYY-MM-DD HH:mm" timestamp (local time). Returns null when unparseable.
 */
export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  const s = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) return new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]);
  const local = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (local) return new Date(+local[1], +local[2] - 1, +local[3], +local[4], +local[5], +(local[6] || 0));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "23 Oct 2026" (or the fallback when the value can't be parsed). */
export function formatDate(value: string | number | Date | null | undefined, fallback = '—'): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : fallback;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "4:30 PM" */
export function formatTime(d: Date): string {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "23 Oct 2026, 4:30 PM" (or the fallback when the value can't be parsed). */
export function formatDateTime(value: string | number | Date | null | undefined, fallback = '—'): string {
  const d = parseDate(value);
  if (!d) return typeof value === 'string' && value.trim() ? value : fallback;
  return `${formatDate(d)}, ${formatTime(d)}`;
}

/** Whole calendar days from `from` to `to` (local dates; time of day ignored). */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** "1 day" / "3 days" */
export function pluralDays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
}

/** Builds one CSV line; quotes every cell and neutralises spreadsheet formulas. */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((cell) => {
      let s = cell === null || cell === undefined ? '' : String(cell);
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(',');
}

/** Triggers a browser download of CSV text (UTF-8 with BOM so Excel shows ₹ correctly). */
export function downloadCsv(filename: string, lines: string[]): void {
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
