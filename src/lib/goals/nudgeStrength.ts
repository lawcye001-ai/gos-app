import type { Goal } from "@/types/goal";
import { NUDGE_TEMPLATES, type NudgeLevel } from "@/lib/goals/templates";

export function calcNudgeLevel(goal: Goal): NudgeLevel {
  if (goal.streakSkipped >= 3) return "severe";
  if (goal.streakSkipped >= 1) return "firm";
  return "normal";
}

export function pickTemplateMessage(goal: Goal): string {
  const level = calcNudgeLevel(goal);
  const pool = NUDGE_TEMPLATES[goal.coachId];
  let bucket = pool[level];
  if (bucket.length === 0 && level === "severe") {
    bucket = pool.firm;
  }
  if (bucket.length === 0) {
    bucket = pool.normal;
  }
  const idx = Math.floor(Math.random() * bucket.length);
  return bucket[idx] ?? "";
}
