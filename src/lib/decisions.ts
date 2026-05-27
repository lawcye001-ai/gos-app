import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";

export type DecisionCard = "GO" | "HOLD" | "STOP";
export type DecisionStatus = "active" | "overridden" | "resolved";

export type Decision = {
  id: string;
  coachId: CoachId;
  topic: string;
  card: DecisionCard;
  reason: string;
  questionsAsked: string[];
  userAnswers: string[];
  missingInfo?: string;
  diagnosis?: string;
  prescription?: string;
  linkedActionId?: string;
  status: DecisionStatus;
  createdAt: number;
};

const KEY_PREFIX = "gos.decisions.";

function keyFor(coachId: CoachId): string {
  return `${KEY_PREFIX}${coachId}`;
}

export async function getDecisions(coachId: CoachId): Promise<Decision[]> {
  const raw = await AsyncStorage.getItem(keyFor(coachId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Decision[]) : [];
  } catch {
    return [];
  }
}

export async function appendDecision(
  coachId: CoachId,
  decision: Decision,
): Promise<void> {
  const existing = await getDecisions(coachId);
  existing.push(decision);
  await AsyncStorage.setItem(keyFor(coachId), JSON.stringify(existing));
}

export async function updateDecision(
  coachId: CoachId,
  id: string,
  partial: Partial<Decision>,
): Promise<Decision | null> {
  const existing = await getDecisions(coachId);
  const idx = existing.findIndex((d) => d.id === id);
  if (idx < 0) return null;
  const updated: Decision = { ...existing[idx], ...partial, id: existing[idx].id };
  existing[idx] = updated;
  await AsyncStorage.setItem(keyFor(coachId), JSON.stringify(existing));
  return updated;
}

export async function getActiveDecisions(coachId: CoachId): Promise<Decision[]> {
  const all = await getDecisions(coachId);
  return all.filter((d) => d.status === "active");
}

export function generateDecisionId(): string {
  return `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
