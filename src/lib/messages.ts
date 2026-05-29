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
    const known = parsed.filter(isKnownMessage);
    // id 기준 dedupe (최초 등장 우선). 과거 버그/seed 재persist 레이스로
    // 중복 저장된 항목을 정리해 FlatList key 충돌을 막는다.
    const seen = new Set<string>();
    return known.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  } catch {
    return [];
  }
}

export async function appendMessage(
  coachId: CoachId,
  message: Message,
): Promise<void> {
  const existing = await getMessages(coachId);
  // 같은 id 재persist 무시 → seed 재로드/레이스에서도 멱등.
  // (existing은 getMessages에서 이미 dedupe되어 옛 중복도 이때 정리·재기록됨)
  if (existing.some((m) => m.id === message.id)) return;
  existing.push(message);
  await AsyncStorage.setItem(keyFor(coachId), JSON.stringify(existing));
}

export async function clearMessages(coachId: CoachId): Promise<void> {
  await AsyncStorage.removeItem(keyFor(coachId));
}
