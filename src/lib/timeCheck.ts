import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";
import type { Action } from "@/lib/actions";
import { updateActionStatus } from "@/lib/actions";

export type ProgressZone =
  | "unknown"
  | "too_early"
  | "mid"
  | "almost"
  | "on_time";

export type Progress = {
  zone: ProgressZone;
  elapsedMin: number;
  expectedMin: number;
  progressPercent: number;
  remainingMin: number;
};

const STORAGE_KEY = "gos.actions";

export function calculateProgress(action: Action, now: number = Date.now()): Progress {
  const startedAt = action.startedAt;
  const expectedMin = action.durationMinutes;

  if (startedAt === undefined || expectedMin === undefined || expectedMin <= 0) {
    return {
      zone: "unknown",
      elapsedMin: 0,
      expectedMin: 0,
      progressPercent: 0,
      remainingMin: 0,
    };
  }

  const elapsedMs = Math.max(0, now - startedAt);
  const elapsedMin = elapsedMs / 60000;
  const progressPercent = Math.min(999, (elapsedMin / expectedMin) * 100);
  const remainingMin = Math.max(0, expectedMin - elapsedMin);

  let zone: ProgressZone;
  if (progressPercent < 30) zone = "too_early";
  else if (progressPercent < 80) zone = "mid";
  else if (progressPercent < 95) zone = "almost";
  else zone = "on_time";

  return {
    zone,
    elapsedMin: Math.round(elapsedMin * 10) / 10,
    expectedMin,
    progressPercent: Math.round(progressPercent),
    remainingMin: Math.round(remainingMin * 10) / 10,
  };
}

async function readAll(): Promise<Action[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Action[]) : [];
  } catch (e) {
    console.error("[timeCheck] readAll failed", e);
    return [];
  }
}

export async function getActiveAction(
  coachId?: CoachId,
): Promise<Action | null> {
  const all = await readAll();
  const filtered = all.filter(
    (a) =>
      a.status === "in_progress" && (coachId ? a.coachId === coachId : true),
  );
  if (filtered.length === 0) return null;
  filtered.sort((a, b) => {
    const aTs = a.startedAt ?? a.updatedAt;
    const bTs = b.startedAt ?? b.updatedAt;
    return bTs - aTs;
  });
  return filtered[0];
}

export async function completeAction(actionId: string): Promise<Action | null> {
  return updateActionStatus(actionId, "done");
}
