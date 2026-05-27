import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CoachId } from "@/data/coaches";

export type TextMessage = {
  id: string;
  coachId: CoachId;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type DecisionMessage = {
  id: string;
  coachId: CoachId;
  role: "decision";
  decisionId: string;
  createdAt: number;
};

export type Message = TextMessage | DecisionMessage;

const KEY_PREFIX = "gos.messages.";

function keyFor(coachId: CoachId): string {
  return `${KEY_PREFIX}${coachId}`;
}

function isKnownMessage(m: unknown): m is Message {
  if (!m || typeof m !== "object") return false;
  const role = (m as { role?: unknown }).role;
  return role === "user" || role === "assistant" || role === "decision";
}

export async function getMessages(coachId: CoachId): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(keyFor(coachId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isKnownMessage);
  } catch {
    return [];
  }
}

export async function appendMessage(
  coachId: CoachId,
  message: Message,
): Promise<void> {
  const existing = await getMessages(coachId);
  existing.push(message);
  await AsyncStorage.setItem(keyFor(coachId), JSON.stringify(existing));
}

export async function clearMessages(coachId: CoachId): Promise<void> {
  await AsyncStorage.removeItem(keyFor(coachId));
}
