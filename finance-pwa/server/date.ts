import type { PeriodKey } from "./types.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime());
}

export function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

function startOfWeek(date: Date): Date {
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function startOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function endOfYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 11, 31));
}

function formatHumanDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatHumanMonth(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function enumerateDateKeys(startKey: string, endKey: string): string[] {
  const result: string[] = [];
  let cursor = parseDateKey(startKey);
  const end = parseDateKey(endKey);

  while (cursor <= end) {
    result.push(formatDateKey(cursor));
    cursor = addDays(cursor, 1);
  }

  return result;
}

export function diffDays(dateA: string, dateB: string): number {
  return Math.floor((parseDateKey(dateA).getTime() - parseDateKey(dateB).getTime()) / DAY_MS);
}

export function getPeriodRange(period: PeriodKey, anchor = todayKey()) {
  const anchorDate = parseDateKey(anchor);

  if (period === "day") {
    return {
      period,
      anchor,
      startKey: anchor,
      endKey: anchor,
      label: formatHumanDate(anchorDate),
    };
  }

  if (period === "week") {
    const start = startOfWeek(anchorDate);
    const end = endOfWeek(anchorDate);
    return {
      period,
      anchor,
      startKey: formatDateKey(start),
      endKey: formatDateKey(end),
      label: `${formatHumanDate(start)} - ${formatHumanDate(end)}`,
    };
  }

  if (period === "month") {
    const start = startOfMonth(anchorDate);
    const end = endOfMonth(anchorDate);
    return {
      period,
      anchor,
      startKey: formatDateKey(start),
      endKey: formatDateKey(end),
      label: formatHumanMonth(anchorDate),
    };
  }

  const start = startOfYear(anchorDate);
  const end = endOfYear(anchorDate);
  return {
    period,
    anchor,
    startKey: formatDateKey(start),
    endKey: formatDateKey(end),
    label: `${anchorDate.getUTCFullYear()} год`,
  };
}

export function monthKey(value: string): string {
  return value.slice(0, 7);
}

export function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parseDateKey(`${value}-01`));
}
