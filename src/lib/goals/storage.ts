import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  CoachId,
  Goal,
  GoalCheck,
  GoalCheckStatus,
  GoalCreatedVia,
  GoalFrequency,
} from "@/types/goal";

const GOALS_KEY = "gos.goals";
const CHECKS_KEY = "gos.goalChecks";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readGoals(): Promise<Goal[]> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Goal[]) : [];
  } catch (e) {
    console.error("[goals.storage] readGoals failed", e);
    return [];
  }
}

async function writeGoals(goals: Goal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  } catch (e) {
    console.error("[goals.storage] writeGoals failed", e);
  }
}

async function readChecks(): Promise<GoalCheck[]> {
  try {
    const raw = await AsyncStorage.getItem(CHECKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GoalCheck[]) : [];
  } catch (e) {
    console.error("[goals.storage] readChecks failed", e);
    return [];
  }
}

async function writeChecks(checks: GoalCheck[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  } catch (e) {
    console.error("[goals.storage] writeChecks failed", e);
  }
}

export async function getAllGoals(): Promise<Goal[]> {
  return readGoals();
}

export async function getGoalById(id: string): Promise<Goal | null> {
  const all = await readGoals();
  return all.find((g) => g.id === id) ?? null;
}

export type CreateGoalInput = {
  title: string;
  coachId: CoachId;
  frequency: GoalFrequency;
  timeOfDay: string;
  active?: boolean;
  createdVia: GoalCreatedVia;
};

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const goal: Goal = {
    id: generateId("goal"),
    title: input.title,
    coachId: input.coachId,
    frequency: input.frequency,
    timeOfDay: input.timeOfDay,
    active: input.active ?? true,
    createdAt: Date.now(),
    createdVia: input.createdVia,
    streakSkipped: 0,
    totalCompleted: 0,
    totalSkipped: 0,
    scheduledNotificationIds: [],
  };
  const all = await readGoals();
  all.push(goal);
  await writeGoals(all);
  return goal;
}

export async function updateGoal(
  id: string,
  patch: Partial<Goal>,
): Promise<Goal> {
  const all = await readGoals();
  const idx = all.findIndex((g) => g.id === id);
  if (idx < 0) throw new Error(`Goal not found: ${id}`);
  const current = all[idx];
  const updated: Goal = { ...current, ...patch, id: current.id };
  all[idx] = updated;
  await writeGoals(all);
  return updated;
}

export async function deleteGoal(id: string): Promise<void> {
  const goals = await readGoals();
  await writeGoals(goals.filter((g) => g.id !== id));
  const checks = await readChecks();
  await writeChecks(checks.filter((c) => c.goalId !== id));
}

export async function getActiveGoals(): Promise<Goal[]> {
  const all = await readGoals();
  return all.filter((g) => g.active);
}

export async function getGoalsByCoach(coachId: CoachId): Promise<Goal[]> {
  const all = await readGoals();
  return all.filter((g) => g.coachId === coachId);
}

export async function getAllChecks(): Promise<GoalCheck[]> {
  return readChecks();
}

export async function getChecksByGoal(goalId: string): Promise<GoalCheck[]> {
  const all = await readChecks();
  return all.filter((c) => c.goalId === goalId);
}

export type CreateCheckInput = {
  goalId: string;
  scheduledFor: number;
  status?: GoalCheckStatus;
};

export async function createCheck(input: CreateCheckInput): Promise<GoalCheck> {
  const check: GoalCheck = {
    id: generateId("check"),
    goalId: input.goalId,
    scheduledFor: input.scheduledFor,
    status: input.status ?? "pending",
  };
  const all = await readChecks();
  all.push(check);
  await writeChecks(all);
  return check;
}

export async function updateCheck(
  id: string,
  patch: Partial<GoalCheck>,
): Promise<GoalCheck> {
  const all = await readChecks();
  const idx = all.findIndex((c) => c.id === id);
  if (idx < 0) throw new Error(`GoalCheck not found: ${id}`);
  const current = all[idx];
  const updated: GoalCheck = { ...current, ...patch, id: current.id };
  all[idx] = updated;
  await writeChecks(all);
  return updated;
}

export async function getPendingChecks(): Promise<GoalCheck[]> {
  const all = await readChecks();
  return all.filter((c) => c.status === "pending");
}

export async function markGoalCompleted(
  goalId: string,
  checkId: string,
): Promise<void> {
  const now = Date.now();
  await updateCheck(checkId, { status: "done", respondedAt: now });
  const goal = await getGoalById(goalId);
  if (!goal) return;
  await updateGoal(goalId, {
    streakSkipped: 0,
    totalCompleted: goal.totalCompleted + 1,
  });
}

export async function markGoalSkipped(
  goalId: string,
  checkId: string,
): Promise<void> {
  const now = Date.now();
  await updateCheck(checkId, { status: "skipped", respondedAt: now });
  const goal = await getGoalById(goalId);
  if (!goal) return;
  await updateGoal(goalId, {
    streakSkipped: goal.streakSkipped + 1,
    totalSkipped: goal.totalSkipped + 1,
    lastNudgeAt: now,
  });
}
