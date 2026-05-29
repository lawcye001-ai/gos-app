import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";

export type ActionStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "done"
  | "abandoned";

export type Action = {
  id: string;
  coachId: CoachId;
  text: string;
  status: ActionStatus;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  durationMinutes?: number;
  completedAt?: number;
  pausedAt?: number;
  pausedTotalMs?: number;
  goalId?: string;
};

const STORAGE_KEY = "gos.actions";

async function readAll(): Promise<Action[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list = parsed as Action[];
    // id 기준 dedupe(먼저 등장 유지). 과거 버그/레이스로 중복 저장된 행동 정리(records key 충돌 방지).
    const seen = new Set<string>();
    return list.filter((a) => {
      if (!a || typeof a.id !== "string") return false;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  } catch {
    return [];
  }
}

async function writeAll(actions: Action[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type SaveActionInput = {
  id?: string;
  coachId: CoachId;
  text: string;
  status: ActionStatus;
  durationMinutes?: number;
};

export async function saveAction(input: SaveActionInput): Promise<Action> {
  const now = Date.now();
  const all = await readAll();

  if (input.id) {
    const idx = all.findIndex((a) => a.id === input.id);
    if (idx >= 0) {
      const prev = all[idx];
      const updated: Action = {
        ...prev,
        text: input.text,
        status: input.status,
        updatedAt: now,
        durationMinutes:
          input.durationMinutes !== undefined
            ? input.durationMinutes
            : prev.durationMinutes,
        startedAt:
          input.status === "in_progress" && prev.startedAt === undefined
            ? now
            : prev.startedAt,
        completedAt:
          input.status === "done" && prev.completedAt === undefined
            ? now
            : prev.completedAt,
      };
      all[idx] = updated;
      await writeAll(all);
      return updated;
    }
  }

  // 동일 coachId에 in_progress/paused 행동이 있으면 새 행동 생성 거부(동시 행동 1개 원칙).
  // 버튼·LLM log_action·decision-card GO 공통 적용. 호출자가 catch해서 처리.
  const active = all.find(
    (a) =>
      a.coachId === input.coachId &&
      (a.status === "in_progress" || a.status === "paused"),
  );
  if (active) {
    throw new Error("이미 진행 중인 행동이 있다");
  }

  const created: Action = {
    id: input.id ?? generateId(),
    coachId: input.coachId,
    text: input.text,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    durationMinutes: input.durationMinutes,
    startedAt: input.status === "in_progress" ? now : undefined,
    completedAt: input.status === "done" ? now : undefined,
  };
  // 같은 id 재persist 무시(멱등) — messages.ts 패턴 동일.
  const dup = all.find((a) => a.id === created.id);
  if (dup) return dup;
  all.push(created);
  await writeAll(all);
  return created;
}

export async function getActions(
  coachId: CoachId,
  status?: ActionStatus,
): Promise<Action[]> {
  const all = await readAll();
  return all.filter(
    (a) => a.coachId === coachId && (status ? a.status === status : true),
  );
}

export async function updateActionStatus(
  id: string,
  status: ActionStatus,
): Promise<Action | null> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const prev = all[idx];
  const now = Date.now();
  const updated: Action = {
    ...prev,
    status,
    updatedAt: now,
    startedAt:
      status === "in_progress" && prev.startedAt === undefined
        ? now
        : prev.startedAt,
    completedAt:
      status === "done" && prev.completedAt === undefined ? now : prev.completedAt,
  };
  all[idx] = updated;
  await writeAll(all);
  return updated;
}

export async function getActionById(id: string): Promise<Action | null> {
  const all = await readAll();
  return all.find((a) => a.id === id) ?? null;
}

// in_progress 또는 paused 중 가장 최근 1개. in_progress 우선. 둘 다 없으면 undefined.
// 버튼(GO/HOLD/STOP) 핸들러가 "현재 대상 행동"을 잡는 데 사용.
export async function getCurrentAction(
  coachId: CoachId,
): Promise<Action | undefined> {
  const all = await readAll();
  const candidates = all.filter(
    (a) =>
      a.coachId === coachId &&
      (a.status === "in_progress" || a.status === "paused"),
  );
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
    const aTs = a.startedAt ?? a.updatedAt;
    const bTs = b.startedAt ?? b.updatedAt;
    return bTs - aTs;
  });
  return candidates[0];
}

// 상태머신 헬퍼(timeCheck)용 부분 갱신. updatedAt은 항상 now로 덮어씀.
// patch에 pausedAt: undefined를 주면 직렬화 시 필드 제거됨(재개 invariant).
export async function patchAction(
  id: string,
  patch: Partial<Action>,
): Promise<Action | null> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const updated: Action = { ...all[idx], ...patch, updatedAt: Date.now() };
  all[idx] = updated;
  await writeAll(all);
  return updated;
}

export async function getPendingActions(coachId: CoachId): Promise<Action[]> {
  const all = await readAll();
  return all.filter(
    (a) =>
      a.coachId === coachId &&
      (a.status === "pending" || a.status === "in_progress"),
  );
}

const LAST_NAG_PREFIX = "gos.lastNag.";

export async function getLastNagAt(coachId: CoachId): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(`${LAST_NAG_PREFIX}${coachId}`);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setLastNagAt(
  coachId: CoachId,
  at: number = Date.now(),
): Promise<void> {
  await AsyncStorage.setItem(`${LAST_NAG_PREFIX}${coachId}`, String(at));
}
