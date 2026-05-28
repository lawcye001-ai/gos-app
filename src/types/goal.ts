import type { CoachId } from "@/data/coaches";

export type { CoachId };

export type GoalFrequency =
  | { type: "daily" }
  | { type: "weekly"; daysOfWeek: number[] }
  | { type: "interval"; everyNDays: number };

export type GoalCreatedVia = "tab" | "chat";

export type Goal = {
  id: string;
  title: string;
  coachId: CoachId;
  frequency: GoalFrequency;
  timeOfDay: string;
  active: boolean;
  createdAt: number;
  createdVia: GoalCreatedVia;
  streakSkipped: number;
  totalCompleted: number;
  totalSkipped: number;
  lastNudgeAt?: number;
  scheduledNotificationIds: string[];
};

export type GoalCheckStatus = "pending" | "done" | "skipped" | "snoozed";

export type GoalCheck = {
  id: string;
  goalId: string;
  scheduledFor: number;
  status: GoalCheckStatus;
  respondedAt?: number;
  snoozeUntil?: number;
};
