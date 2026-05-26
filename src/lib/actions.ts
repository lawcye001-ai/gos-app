import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";

export type ActionStatus = "pending" | "in_progress" | "done" | "abandoned";

export type Action = {
  id: string;
  coachId: CoachId;
  text: string;
  status: ActionStatus;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "gos.actions";

async function readAll(): Promise<Action[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Action[]) : [];
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
};

export async function saveAction(input: SaveActionInput): Promise<Action> {
  const now = Date.now();
  const all = await readAll();

  if (input.id) {
    const idx = all.findIndex((a) => a.id === input.id);
    if (idx >= 0) {
      const updated: Action = {
        ...all[idx],
        text: input.text,
        status: input.status,
        updatedAt: now,
      };
      all[idx] = updated;
      await writeAll(all);
      return updated;
    }
  }

  const created: Action = {
    id: input.id ?? generateId(),
    coachId: input.coachId,
    text: input.text,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
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
  const updated: Action = { ...all[idx], status, updatedAt: Date.now() };
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
