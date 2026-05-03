import { parseDayHours } from './openStatus';
import type { OpenWindow } from '../types/trip';

function minutesToStr(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h}:${min.toString().padStart(2, '0')}`;
}

/**
 * Given a shop's hours array and a date, return the open window for that day.
 * Returns null if hours data is missing/unparseable.
 * Returns { closed: true } scenario handled by caller checking the closed flag.
 */
export function getOpenWindow(
  hours: string[] | undefined,
  date: Date,
): { window: OpenWindow; closed: false } | { window: null; closed: true } | null {
  if (!hours || hours.length === 0) return null;

  const day = date.getDay();

  for (const line of hours) {
    const parsed = parseDayHours(line);
    if (!parsed || parsed.day !== day) continue;

    if (parsed.closed) {
      return { window: null, closed: true };
    }

    if (parsed.ranges.length === 0) {
      return { window: null, closed: true };
    }

    // Use the widest range (first open to last close)
    const open = Math.min(...parsed.ranges.map(r => r.open));
    const close = Math.max(...parsed.ranges.map(r => r.close));

    return {
      window: {
        open,
        close,
        openStr: minutesToStr(open),
        closeStr: minutesToStr(close > 1440 ? close - 1440 : close),
      },
      closed: false,
    };
  }

  return null; // no matching day found
}

/**
 * Format remaining open time in a human-friendly way.
 * e.g., "還剩 2.5 小時" or "還剩 30 分"
 */
export function formatRemainingTime(closeMinutes: number, currentMinutes: number): string {
  const remaining = closeMinutes - currentMinutes;
  if (remaining <= 0) return '已關門';
  if (remaining < 60) return `還剩 ${remaining} 分`;
  const hours = remaining / 60;
  return `還剩 ${hours % 1 === 0 ? hours : hours.toFixed(1)} 小時`;
}
