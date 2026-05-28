import type { Goal, GoalFrequency } from "@/types/goal";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function formatFrequency(goal: Goal): string {
  return `${formatFrequencyPart(goal.frequency)} ${goal.timeOfDay}`;
}

function formatFrequencyPart(frequency: GoalFrequency): string {
  if (frequency.type === "daily") return "매일";
  if (frequency.type === "weekly") {
    if (frequency.daysOfWeek.length === 0) return "요일 미설정";
    const sorted = [...frequency.daysOfWeek]
      .filter((d) => d >= 0 && d <= 6)
      .sort((a, b) => a - b);
    return sorted.map((d) => DAY_NAMES[d]).join("");
  }
  const n = Math.max(1, Math.floor(frequency.everyNDays));
  return `${n}일마다`;
}
