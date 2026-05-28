import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSession } from "@/state/session";
import { getCoach } from "@/data/coaches";
import {
  ChatBubble,
  type ChatMessage,
  type TextChatMessage,
} from "@/components/ChatBubble";
import { DecisionCard } from "@/components/DecisionCard";
import { colors, radius, spacing } from "@/theme/colors";
import { streamCoachReply, type ChatTurn } from "@/lib/coach";
import {
  getPendingActions,
  getLastNagAt,
  setLastNagAt,
  type Action,
} from "@/lib/actions";
import {
  getMessages,
  appendMessage,
  clearMessages,
  type Message,
} from "@/lib/messages";
import { getDecisions, type Decision } from "@/lib/decisions";

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_GAP_MS = 3 * 60 * 60 * 1000;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatDeclaredAt(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function formatGap(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `약 ${minutes}분 경과`;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 24) return `약 ${hours}시간 경과`;
  const days = Math.round(hours / 24);
  return `약 ${days}일 경과`;
}

function toChatMessage(
  m: Message,
  decisionsById: Map<string, Decision>,
): ChatMessage | null {
  if (m.role === "decision") {
    const decision = decisionsById.get(m.decisionId);
    if (!decision) return null;
    return {
      id: m.id,
      role: "decision",
      decision,
      time: formatTime(m.createdAt),
    };
  }
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "coach",
    text: m.content,
    time: formatTime(m.createdAt),
  };
}

function toChatTurns(saved: Message[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let prevTs: number | null = null;
  for (const m of saved) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const gap = prevTs !== null ? m.createdAt - prevTs : 0;
    if (gap >= SESSION_GAP_MS) {
      turns.push({
        role: "user",
        content: `[세션 휴지: ${formatGap(gap)}]`,
      });
    }
    turns.push({ role: m.role, content: m.content });
    prevTs = m.createdAt;
  }
  return turns;
}

function relativeDays(ts: number, now: number): string {
  const days = Math.round((dayStart(now) - dayStart(ts)) / DAY_MS);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  return `${days}일 전`;
}

function buildPendingContext(actions: Action[], now: number): string {
  const lines = actions.map(
    (a) =>
      `- "${a.text}" (선언: ${relativeDays(a.createdAt, now)} ${formatDeclaredAt(a.createdAt)}, 상태: ${a.status})`,
  );
  return `다음 미완료 행동들이 있다:\n${lines.join("\n")}`;
}

const initialMessages: Record<string, TextChatMessage[]> = {
  luna: [
    {
      id: "1",
      role: "coach",
      text: "안녕, 왔구나 🌙 오늘 하루 어떻게 보냈어?",
      time: "오전 09:12",
    },
    {
      id: "2",
      role: "coach",
      text: "무리하진 않았어? 천천히 이야기해줘. 듣고 있을게.",
      time: "오전 09:12",
    },
  ],
  rex: [
    {
      id: "1",
      role: "coach",
      text: "왔다. 인사는 됐고, 본론으로.",
      time: "오전 09:12",
    },
    {
      id: "2",
      role: "coach",
      text: "오늘 목표 뭐였지? 했나, 안 했나. 둘 중 하나로 대답해.",
      time: "오전 09:12",
    },
  ],
  zero: [
    {
      id: "1",
      role: "coach",
      text: "닥터 ZERO입니다. 진료 시작하죠.",
      time: "오전 09:12",
    },
    {
      id: "2",
      role: "coach",
      text: "현재 가지고 계신 결정이나 진행 중인 행동 있으시면 알려주세요. 차트에 기입할게요.",
      time: "오전 09:12",
    },
  ],
  nova: [],
};

export default function ChatScreen() {
  const router = useRouter();
  const { selectedCoach } = useSession();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!selectedCoach) return;
    const coachId = selectedCoach;
    let cancelled = false;

    (async () => {
      try {
        const [saved, decisions] = await Promise.all([
          getMessages(coachId),
          getDecisions(coachId),
        ]);
        if (cancelled) return;
        const decisionsById = new Map(decisions.map((d) => [d.id, d]));
        if (saved.length > 0) {
          const converted = saved
            .map((m) => toChatMessage(m, decisionsById))
            .filter((m): m is ChatMessage => m !== null);
          setMessages(converted);
          return;
        }

        const greetings = initialMessages[coachId] ?? [];
        if (greetings.length === 0) {
          setMessages([]);
          return;
        }

        const now = Date.now();
        const persisted: Message[] = greetings.map((g) => ({
          id: g.id,
          coachId,
          role: "assistant",
          content: g.text,
          createdAt: now,
        }));
        setMessages(
          persisted
            .map((m) => toChatMessage(m, decisionsById))
            .filter((m): m is ChatMessage => m !== null),
        );

        try {
          for (const m of persisted) {
            if (cancelled) break;
            await appendMessage(coachId, m);
          }
        } catch (err) {
          console.warn("greeting persist failed", err);
        }
      } catch (err) {
        console.warn("messages load failed", err);
        if (!cancelled) setMessages(initialMessages[coachId] ?? []);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCoach, reloadKey]);

  useEffect(() => {
    if (!selectedCoach) return;
    let cancelled = false;
    const coachId = selectedCoach;

    (async () => {
      try {
        const pending = await getPendingActions(coachId);
        if (cancelled || pending.length === 0) return;

        const now = Date.now();
        const lastNagAt = await getLastNagAt(coachId);
        if (lastNagAt !== null && now - lastNagAt < DAY_MS) return;
        if (cancelled) return;

        const saved = await getMessages(coachId);
        if (cancelled) return;
        const baseHistory: ChatTurn[] = toChatTurns(saved);

        const lastSavedTs =
          saved.length > 0 ? saved[saved.length - 1].createdAt : null;
        const reconnectGap = lastSavedTs !== null ? now - lastSavedTs : 0;
        const reconnectContent =
          reconnectGap >= SESSION_GAP_MS
            ? `[세션 휴지: ${formatGap(reconnectGap)}]\n(접속)`
            : "(접속)";

        const time = formatTime(now);
        const coachMsgId = `nag_${now}`;
        const coachMsg: ChatMessage = {
          id: coachMsgId,
          role: "coach",
          text: "",
          time,
        };
        setMessages((prev) => [...prev, coachMsg]);
        setSending(true);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

        let finalText = "";
        try {
          await streamCoachReply({
            coachId,
            history: [
              ...baseHistory,
              { role: "user", content: reconnectContent },
            ],
            extraContext: buildPendingContext(pending, now),
            onDelta: (chunk) => {
              finalText += chunk;
              if (cancelled) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === coachMsgId
                    ? m.role === "decision"
                      ? m
                      : { ...m, text: m.text + chunk }
                    : m,
                ),
              );
              listRef.current?.scrollToEnd({ animated: true });
            },
            onDecisionCard: (decision) => {
              if (cancelled) return;
              const createdAt = Date.now();
              const msgId = `dec_${decision.id}`;
              setMessages((prev) => [
                ...prev,
                {
                  id: msgId,
                  role: "decision",
                  decision,
                  time: formatTime(createdAt),
                },
              ]);
              setTimeout(
                () => listRef.current?.scrollToEnd({ animated: true }),
                50,
              );
              appendMessage(coachId, {
                id: msgId,
                coachId,
                role: "decision",
                decisionId: decision.id,
                createdAt,
              }).catch((err) => console.warn("decision msg persist failed", err));
            },
          });

          if (finalText) {
            try {
              await appendMessage(coachId, {
                id: coachMsgId,
                coachId,
                role: "assistant",
                content: finalText,
                createdAt: now,
              });
            } catch (err) {
              console.warn("nag persist failed", err);
            }
          }

          try {
            await setLastNagAt(coachId, now);
          } catch (err) {
            console.warn("lastNag save failed", err);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "응답 중 오류가 발생했어";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === coachMsgId && m.role !== "decision"
                ? { ...m, text: `⚠️ ${message}` }
                : m,
            ),
          );
        } finally {
          if (!cancelled) setSending(false);
        }
      } catch (err) {
        console.warn("auto-nag failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCoach]);

  if (!selectedCoach) {
    return <NoCoachState onSelect={() => router.push("/")} />;
  }

  const coach = getCoach(selectedCoach);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    Haptics.selectionAsync().catch(() => {});
    const coachId = selectedCoach;
    const now = Date.now();
    const time = formatTime(now);
    const userMsgId = String(now);
    const coachMsgId = String(now + 1);
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text,
      time,
    };
    const coachMsg: ChatMessage = {
      id: coachMsgId,
      role: "coach",
      text: "",
      time,
    };

    setMessages((prev) => [...prev, userMsg, coachMsg]);
    setInput("");
    setSending(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      await appendMessage(coachId, {
        id: userMsgId,
        coachId,
        role: "user",
        content: text,
        createdAt: now,
      });
    } catch (err) {
      console.warn("user msg persist failed", err);
    }

    const saved = await getMessages(coachId);
    const history: ChatTurn[] = toChatTurns(saved);

    let finalText = "";
    try {
      await streamCoachReply({
        coachId,
        history,
        onDelta: (chunk) => {
          finalText += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === coachMsgId
                ? m.role === "decision"
                  ? m
                  : { ...m, text: m.text + chunk }
                : m,
            ),
          );
          listRef.current?.scrollToEnd({ animated: true });
        },
        onDecisionCard: (decision) => {
          const createdAt = Date.now();
          const msgId = `dec_${decision.id}`;
          setMessages((prev) => [
            ...prev,
            {
              id: msgId,
              role: "decision",
              decision,
              time: formatTime(createdAt),
            },
          ]);
          setTimeout(
            () => listRef.current?.scrollToEnd({ animated: true }),
            50,
          );
          appendMessage(coachId, {
            id: msgId,
            coachId,
            role: "decision",
            decisionId: decision.id,
            createdAt,
          }).catch((err) => console.warn("decision msg persist failed", err));
        },
      });

      if (finalText) {
        try {
          await appendMessage(coachId, {
            id: coachMsgId,
            coachId,
            role: "assistant",
            content: finalText,
            createdAt: Date.now(),
          });
        } catch (err) {
          console.warn("coach msg persist failed", err);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "응답 중 오류가 발생했어";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === coachMsgId && m.role !== "decision"
            ? { ...m, text: `⚠️ ${message}` }
            : m,
        ),
      );
    } finally {
      setSending(false);
    }
  };

  const handleMenuPress = async () => {
    if (!__DEV__) return;
    if (selectedCoach !== "nova") return;
    const coachId = selectedCoach;
    const title = "[DEV] NOVA 대화 초기화";
    const message = "저장된 NOVA 채팅 기록을 모두 삭제하고 초기 인사로 리셋할까요?";

    const confirmed =
      Platform.OS === "web"
        ? typeof window !== "undefined" &&
          window.confirm(`${title}\n\n${message}`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(title, message, [
              { text: "취소", style: "cancel", onPress: () => resolve(false) },
              {
                text: "초기화",
                style: "destructive",
                onPress: () => resolve(true),
              },
            ]);
          });

    if (!confirmed) return;
    try {
      await clearMessages(coachId);
    } catch (e) {
      console.error("[chat] clear nova failed", e);
      return;
    }
    setMessages([]);
    setReloadKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ChatHeader coach={coach} onMenuPress={handleMenuPress} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            item.role === "decision" ? (
              <DecisionCard decision={item.decision} />
            ) : (
              <ChatBubble message={item} coach={coach} />
            )
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={<DayDivider label="오늘" />}
          showsVerticalScrollIndicator={false}
        />

        <QuickActions coach={coach} />

        <View style={styles.inputBar}>
          <Pressable style={styles.iconButton}>
            <Ionicons name="add" size={22} color={colors.textMuted} />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`${coach.name}에게 메시지...`}
            placeholderTextColor={colors.textDim}
            style={styles.input}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            onPress={send}
            disabled={!input.trim() || sending}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  input.trim() && !sending ? coach.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChatHeader({
  coach,
  onMenuPress,
}: {
  coach: ReturnType<typeof getCoach>;
  onMenuPress?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerAvatar, { backgroundColor: coach.bubbleBg, borderColor: coach.primary }]}>
        <Text style={{ fontSize: 22 }}>{coach.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerName, { color: coach.primary }]}>{coach.name}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={styles.statusText}>{coach.tagline} · 온라인</Text>
        </View>
      </View>
      <Pressable onPress={onMenuPress} style={styles.iconButton}>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function QuickActions({ coach }: { coach: ReturnType<typeof getCoach> }) {
  const actions: { label: string; color: string }[] = [
    { label: "GO", color: colors.success },
    { label: "HOLD", color: colors.warning },
    { label: "STOP", color: colors.danger },
  ];
  return (
    <View style={styles.quickRow}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          style={({ pressed }) => [
            styles.quickButton,
            { borderColor: a.color + "66" },
            pressed && { backgroundColor: a.color + "22" },
          ]}
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
        >
          <Text style={[styles.quickText, { color: a.color }]}>{a.label}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [
          styles.quickButton,
          styles.quickPhoto,
          { borderColor: coach.primary + "66" },
          pressed && { backgroundColor: coach.primary + "22" },
        ]}
      >
        <Ionicons name="camera" size={14} color={coach.primary} />
        <Text style={[styles.quickText, { color: coach.primary }]}>인증</Text>
      </Pressable>
    </View>
  );
}

function NoCoachState({ onSelect }: { onSelect: () => void }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>먼저 코치를 선택해줘</Text>
        <Text style={styles.emptySubtitle}>
          코치마다 대화 스타일이 달라. 너에게 맞는 한 명을 골라봐.
        </Text>
        <Pressable onPress={onSelect} style={styles.emptyButton}>
          <Text style={styles.emptyButtonText}>코치 선택하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: { fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: colors.textMuted, fontSize: 12 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingVertical: spacing.lg },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textDim, fontSize: 11, letterSpacing: 1 },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexWrap: "wrap",
  },
  quickButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  quickPhoto: { flexDirection: "row", alignItems: "center", gap: 4 },
  quickText: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
