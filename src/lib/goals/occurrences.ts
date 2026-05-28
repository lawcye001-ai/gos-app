import type { Goal } from "@/types/goal";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseTimeOfDay(timeOfDay: string): { hour: number; minute: number } {
  const parts = timeOfDay.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function atTimeOfDay(date: Date, hour: number, minute: number): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function computeOccurrences(
  goal: Goal,
  daysAhead: number,
  from: number = Date.now(),
): Date[] {
  if (daysAhead <= 0) return [];

  const { hour, minute } = parseTimeOfDay(goal.timeOfDay);
  const fromDate = new Date(from);
  const startDay = startOfDay(fromDate);
  const occurrences: Date[] = [];

  if (goal.frequency.type === "daily") {
    for (let i = 0; i < daysAhead; i++) {
      const candidate = atTimeOfDay(addDays(startDay, i), hour, minute);
      if (candidate.getTime() >= from) occurrences.push(candidate);
    }
    return occurrences;
  }

  if (goal.frequency.type === "weekly") {
    const days = new Set(goal.frequency.daysOfWeek);
    for (let i = 0; i < daysAhead; i++) {
      const dayDate = addDays(startDay, i);
      if (!days.has(dayDate.getDay())) continue;
      const candidate = atTimeOfDay(dayDate, hour, minute);
      if (candidate.getTime() >= from) occurrences.push(candidate);
    }
    return occurrences;
  }

  if (goal.frequency.type === "interval") {
    const step = Math.max(1, Math.floor(goal.frequency.everyNDays));
    const createdStart = startOfDay(new Date(goal.createdAt));
    const dayDiff = Math.floor(
      (startDay.getTime() - createdStart.getTime()) / MS_PER_DAY,
    );
    let mod = dayDiff % step;
    if (mod < 0) mod += step;
    const offset = (step - mod) % step;
    for (let i = offset; i < daysAhead; i += step) {
      const candidate = atTimeOfDay(addDays(startDay, i), hour, minute);
      if (candidate.getTime() >= from) occurrences.push(candidate);
    }
    return occurrences;
  }

  return occurrences;
}
