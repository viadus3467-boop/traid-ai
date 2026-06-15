import type { PeriodKey } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDays(value: string, days: number) {
  return new Date(parseDateKey(value).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function shiftAnchor(period: PeriodKey, anchor: string, delta: number) {
  const date = parseDateKey(anchor);

  if (period === "day") {
    return addDays(anchor, delta);
  }

  if (period === "week") {
    return addDays(anchor, delta * 7);
  }

  if (period === "month") {
    const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, date.getUTCDate()));
    return next.toISOString().slice(0, 10);
  }

  const next = new Date(Date.UTC(date.getUTCFullYear() + delta, date.getUTCMonth(), date.getUTCDate()));
  return next.toISOString().slice(0, 10);
}

export function getHistoryRange(period: PeriodKey, anchor: string) {
  const date = parseDateKey(anchor);

  if (period === "day") {
    return { from: anchor, to: anchor };
  }

  if (period === "week") {
    const weekday = (date.getUTCDay() + 6) % 7;
    const from = addDays(anchor, -weekday);
    return { from, to: addDays(from, 6) };
  }

  if (period === "month") {
    const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    return { from, to };
  }

  const from = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(date.getUTCFullYear(), 11, 31)).toISOString().slice(0, 10);
  return { from, to };
}
