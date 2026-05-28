import type { Goal } from "@/types/goal";
import {
  cancelGoalNotifications,
  scheduleGoalNotifications,
} from "@/lib/goals/scheduler";

function frequencyEquals(a: Goal["frequency"], b: Goal["frequency"]): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "daily" && b.type === "daily") return true;
  if (a.type === "interval" && b.type === "interval") {
    return a.everyNDays === b.everyNDays;
  }
  if (a.type === "weekly" && b.type === "weekly") {
    if (a.daysOfWeek.length !== b.daysOfWeek.length) return false;
    const aSorted = [...a.daysOfWeek].sort();
    const bSorted = [...b.daysOfWeek].sort();
    return aSorted.every((d, i) => d === bSorted[i]);
  }
  return false;
}

export async function syncOnCreate(goal: Goal): Promise<void> {
  if (!goal.active) return;
  await scheduleGoalNotifications(goal);
}

export async function syncOnUpdate(
  goal: Goal,
  prev: Goal,
): Promise<void> {
  const scheduleAffected =
    goal.active !== prev.active ||
    goal.timeOfDay !== prev.timeOfDay ||
    goal.coachId !== prev.coachId ||
    goal.title !== prev.title ||
    !frequencyEquals(goal.frequency, prev.frequency);

  if (!scheduleAffected) return;

  if (!goal.active) {
    await cancelGoalNotifications(goal);
    return;
  }
  await scheduleGoalNotifications(goal);
}

export async function syncOnDelete(goal: Goal): Promise<void> {
  await cancelGoalNotifications(goal);
}

export async function syncOnActiveToggle(goal: Goal): Promise<void> {
  if (goal.active) {
    await scheduleGoalNotifications(goal);
  } else {
    await cancelGoalNotifications(goal);
  }
}
