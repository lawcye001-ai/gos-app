import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";
import type { Action } from "@/lib/actions";
import { updateActionStatus, getActionById, patchAction } from "@/lib/actions";

export type ProgressZone =
  | "unknown"
  | "too_early"
  | "mid"
  | "almost"
  | "on_time"
  | "late";

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

  const pausedTotalMs = action.pausedTotalMs ?? 0;
  const currentPauseMs = action.pausedAt ? Math.max(0, now - action.pausedAt) : 0;
  const elapsedMs = Math.max(0, now - startedAt - pausedTotalMs - currentPauseMs);
  const elapsedMin = elapsedMs / 60000;
  const progressPercent = Math.min(999, (elapsedMin / expectedMin) * 100);
  const remainingMin = Math.max(0, expectedMin - elapsedMin);

  // elapsedMs > durationMs * 1.5 (= progressPercent > 150) → late. overshoot 상한.
  let zone: ProgressZone;
  if (progressPercent > 150) zone = "late";
  else if (progressPercent < 30) zone = "too_early";
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

// 가드 위반 시 console.warn + no-op(현재 action 그대로 반환). 상태 불변.
export async function startAction(actionId: string): Promise<Action | null> {
  const action = await getActionById(actionId);
  if (!action) return null;
  if (action.status !== "pending") {
    console.warn(
      `[timeCheck] startAction no-op: ${actionId} status=${action.status} (expected pending)`,
    );
    return action;
  }
  return patchAction(actionId, { status: "in_progress", startedAt: Date.now() });
}

export async function pauseAction(actionId: string): Promise<Action | null> {
  const action = await getActionById(actionId);
  if (!action) return null;
  if (action.status !== "in_progress") {
    console.warn(
      `[timeCheck] pauseAction no-op: ${actionId} status=${action.status} (expected in_progress)`,
    );
    return action;
  }
  return patchAction(actionId, { status: "paused", pausedAt: Date.now() });
}

export async function resumeAction(actionId: string): Promise<Action | null> {
  const action = await getActionById(actionId);
  if (!action) return null;
  if (action.status !== "paused") {
    console.warn(
      `[timeCheck] resumeAction no-op: ${actionId} status=${action.status} (expected paused)`,
    );
    return action;
  }
  const now = Date.now();
  const pausedTotalMs =
    (action.pausedTotalMs ?? 0) +
    (action.pausedAt ? Math.max(0, now - action.pausedAt) : 0);
  return patchAction(actionId, {
    status: "in_progress",
    pausedTotalMs,
    pausedAt: undefined,
  });
}

// 완수 보고: 코드가 zone 판정(LLM 아님). on_time/almost만 done 처리.
// too_early/mid/late/unknown은 상태 변경 X(코치가 톤으로 되돌림). 항상 zone 반환.
export async function reportCompletion(actionId: string): Promise<ProgressZone> {
  const action = await getActionById(actionId);
  if (!action) {
    console.warn(`[timeCheck] reportCompletion: action not found ${actionId}`);
    return "unknown";
  }
  const now = Date.now();
  const { zone } = calculateProgress(action, now);
  if (zone === "on_time" || zone === "almost") {
    await patchAction(actionId, { status: "done", completedAt: now });
  }
  return zone;
}
