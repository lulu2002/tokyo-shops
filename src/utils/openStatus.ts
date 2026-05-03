const DAY_MAP: Record<string, number> = {
  '週日': 0,
  '週一': 1,
  '週二': 2,
  '週三': 3,
  '週四': 4,
  '週五': 5,
  '週六': 6,
};

interface TimeRange {
  open: number;
  close: number;
}

interface DaySchedule {
  day: number;
  closed: boolean;
  ranges: TimeRange[];
}

function parseTime(s: string): number {
  // "12:00" -> 720
  const m = s.match(/(\d+):(\d+)/);
  if (!m) return -1;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

export function parseDayHours(line: string): DaySchedule | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return null;

  const dayStr = line.slice(0, colonIdx).trim();
  const rest = line.slice(colonIdx + 1).trim();
  const day = DAY_MAP[dayStr];
  if (day === undefined) return null;

  if (rest === '公休' || rest.includes('公休')) {
    return { day, closed: true, ranges: [] };
  }

  if (rest.includes('24') && rest.includes('小時營業')) {
    return { day, closed: false, ranges: [{ open: 0, close: 1440 }] };
  }

  const ranges: TimeRange[] = [];
  const parts = rest.split(',').map((p) => p.trim());
  for (const part of parts) {
    const [openStr, closeStr] = part.split('～').map((s) => s.trim());
    if (!openStr || !closeStr) continue;
    const open = parseTime(openStr);
    const close = parseTime(closeStr);
    if (open >= 0 && close >= 0) {
      ranges.push({ open, close: close <= open ? close + 1440 : close });
    }
  }

  return { day, closed: ranges.length === 0, ranges };
}

export function isOpenAt(hours: string[] | undefined, date: Date): boolean | null {
  if (!hours || hours.length === 0) return null;

  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();

  for (const line of hours) {
    const parsed = parseDayHours(line);
    if (!parsed || parsed.day !== day) continue;
    if (parsed.closed) return false;
    return parsed.ranges.some((r) => minutes >= r.open && minutes < r.close);
  }

  return null;
}

export function toJST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 3600000);
}
