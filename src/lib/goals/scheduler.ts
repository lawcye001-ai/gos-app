import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import type { Goal } from "@/types/goal";
import { getCoach } from "@/data/coaches";
import {
  createCheck,
  getActiveGoals,
  getChecksByGoal,
  updateGoal,
} from "@/lib/goals/storage";
import { computeOccurrences } from "@/lib/goals/occurrences";
import { pickTemplateMessage } from "@/lib/goals/nudgeStrength";

const CHANNEL_ID = "goal-nudge";
const SCHEDULE_WINDOW_DAYS = 7;

function isWebOrSSR(): boolean {
  return Platform.OS === "web";
}

export async function requestPermissions(): Promise<boolean> {
  if (isWebOrSSR()) {
    console.log("[scheduler] skipped on web");
    return false;
  }
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) {
      await ensureAndroidChannel();
      return true;
    }
    const req = await Notifications.requestPermissionsAsync();
    if (req.granted) {
      await ensureAndroidChannel();
      return true;
    }
    return false;
  } catch (e) {
    console.error("[scheduler] requestPermissions failed", e);
    return false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "목표 알림",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  } catch (e) {
    console.error("[scheduler] setNotificationChannelAsync failed", e);
  }
}

async function cancelByIds(ids: string[]): Promise<void> {
  if (isWebOrSSR()) return;
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (e) {
        console.warn("[scheduler] cancel failed", id, e);
      }
    }),
  );
}

export async function cancelGoalNotifications(goal: Goal): Promise<void> {
  if (isWebOrSSR()) {
    console.log("[scheduler] skipped on web");
    return;
  }
  await cancelByIds(goal.scheduledNotificationIds);
  if (goal.scheduledNotificationIds.length > 0) {
    try {
      await updateGoal(goal.id, { scheduledNotificationIds: [] });
    } catch (e) {
      console.error("[scheduler] clear ids failed", e);
    }
  }
}

export async function scheduleGoalNotifications(goal: Goal): Promise<string[]> {
  if (isWebOrSSR()) {
    console.log("[scheduler] skipped on web");
    return [];
  }
  if (!goal.active) {
    await cancelGoalNotifications(goal);
    return [];
  }

  await cancelByIds(goal.scheduledNotificationIds);

  const coach = getCoach(goal.coachId);
  const occurrences = computeOccurrences(goal, SCHEDULE_WINDOW_DAYS);
  const existingChecks = await getChecksByGoal(goal.id);
  const existingByTime = new Map(
    existingChecks
      .filter((c) => c.status === "pending")
      .map((c) => [c.scheduledFor, c]),
  );
  const newIds: string[] = [];

  for (const when of occurrences) {
    const ts = when.getTime();
    const body = pickTemplateMessage(goal);
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${coach.emoji} ${coach.name} · ${goal.title}`,
          body,
          data: { goalId: goal.id, scheduledFor: ts },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: CHANNEL_ID,
        },
      });
      newIds.push(id);
      if (!existingByTime.has(ts)) {
        try {
          await createCheck({ goalId: goal.id, scheduledFor: ts });
        } catch (e) {
          console.warn("[scheduler] createCheck failed", e);
        }
      }
    } catch (e) {
      console.error("[scheduler] scheduleNotificationAsync failed", e);
    }
  }

  try {
    await updateGoal(goal.id, { scheduledNotificationIds: newIds });
  } catch (e) {
    console.error("[scheduler] save scheduledNotificationIds failed", e);
  }
  return newIds;
}

export async function ensureFutureNotifications(): Promise<void> {
  if (isWebOrSSR()) {
    console.log("[scheduler] skipped on web");
    return;
  }
  try {
    const goals = await getActiveGoals();
    for (const g of goals) {
      await scheduleGoalNotifications(g);
    }
  } catch (e) {
    console.error("[scheduler] ensureFutureNotifications failed", e);
  }
}

export async function triggerImmediateDebugNotification(
  goal: Goal,
  delaySeconds = 5,
): Promise<void> {
  if (isWebOrSSR()) {
    console.log("[scheduler] skipped on web");
    return;
  }
  const coach = getCoach(goal.coachId);
  const body = pickTemplateMessage(goal);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `[DEV] ${coach.emoji} ${coach.name} · ${goal.title}`,
        body,
        data: { goalId: goal.id, debug: true },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, delaySeconds),
        channelId: CHANNEL_ID,
      },
    });
  } catch (e) {
    console.error("[scheduler] triggerImmediateDebugNotification failed", e);
  }
}
