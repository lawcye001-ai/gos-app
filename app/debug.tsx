import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { coaches } from "@/data/coaches";
import { getActions, patchAction } from "@/lib/actions";
import { colors, radius, spacing } from "@/theme/colors";

type ActionRecord = {
  id?: string;
  status?: string;
  updatedAt?: number;
  createdAt?: number;
  startedAt?: number;
};

export default function DebugScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const confirmThenRun = async (
    title: string,
    body: string,
    fn: () => Promise<string>,
  ) => {
    if (busy) return;
    const confirmed =
      Platform.OS === "web"
        ? typeof window !== "undefined" &&
          window.confirm(`${title}\n\n${body}`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(title, body, [
              { text: "취소", style: "cancel", onPress: () => resolve(false) },
              { text: "실행", style: "destructive", onPress: () => resolve(true) },
            ]);
          });
    if (!confirmed) return;
    setBusy(true);
    setStatus("실행 중...");
    try {
      const msg = await fn();
      setStatus(`✓ ${msg}`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setStatus(`✗ ${m}`);
      console.error("[debug]", e);
    } finally {
      setBusy(false);
    }
  };

  const clearAllMessages = async () => {
    const keys = coaches.map((c) => `gos.messages.${c.id}`);
    await AsyncStorage.multiRemove(keys);
    return `대화 4개 키 삭제`;
  };

  const clearAllGoals = async () => {
    if (Platform.OS !== "web") {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (e) {
        console.warn("[debug] cancel notifications failed", e);
      }
    }
    await AsyncStorage.multiRemove(["gos.goals", "gos.goalChecks"]);
    return "목표 + GoalCheck + 예약 알림 모두 삭제";
  };

  const clearAllDecisions = async () => {
    const keys = coaches.map((c) => `gos.decisions.${c.id}`);
    await AsyncStorage.multiRemove(keys);
    return "결정 카드 4개 키 삭제";
  };

  const clearAllActions = async () => {
    await AsyncStorage.removeItem("gos.actions");
    return "행동 기록 삭제";
  };

  const clearEverything = async () => {
    if (Platform.OS !== "web") {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch (e) {
        console.warn("[debug] cancel notifications failed", e);
      }
    }
    await AsyncStorage.clear();
    return "AsyncStorage 전체 + 예약 알림 전부 삭제";
  };

  const cleanStaleActions = async () => {
    const now = Date.now();
    const CUTOFF_MS = 12 * 60 * 60 * 1000;
    let cleaned = 0;
    for (const c of coaches) {
      const list = await getActions(c.id);
      for (const a of list) {
        if (a.status !== "in_progress" && a.status !== "paused") continue;
        const base = a.startedAt ?? a.createdAt;
        if (now - base >= CUTOFF_MS) {
          await patchAction(a.id, { status: "abandoned" });
          cleaned++;
        }
      }
    }
    return `${cleaned}개 정리됨`;
  };

  const jumpTime = async () => {
    const raw = await AsyncStorage.getItem("gos.actions");
    if (!raw) return "행동 기록 없음. 점프 대상 없음.";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return "행동 기록 파싱 실패";
    }
    if (!Array.isArray(parsed)) return "데이터 형식 비정상";
    const list = parsed as ActionRecord[];
    const offset = 30 * 60 * 1000;
    let touched = 0;
    for (const a of list) {
      if (a.status === "in_progress" || a.status === "pending") {
        const base = typeof a.updatedAt === "number" ? a.updatedAt : a.createdAt;
        if (typeof base === "number") a.updatedAt = base - offset;
        if (typeof a.createdAt === "number") a.createdAt = a.createdAt - offset;
        if (typeof a.startedAt === "number") a.startedAt = a.startedAt - offset;
        touched++;
      }
    }
    await AsyncStorage.setItem("gos.actions", JSON.stringify(list));
    return `${touched}개 행동의 createdAt/updatedAt -30분 backdate`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>[DEV] 디버그 메뉴</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.warning}>
          ⚠ 개발 빌드 전용. 모든 액션은 즉시 적용되며 복구 불가.
        </Text>

        <DebugRow
          title="모든 코치 대화 초기화"
          desc="gos.messages.<coachId> 4개 삭제"
          danger
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "모든 코치 대화 초기화",
              "4명 코치의 채팅 기록을 모두 삭제합니다.",
              clearAllMessages,
            )
          }
        />
        <DebugRow
          title="모든 목표 삭제"
          desc="gos.goals + gos.goalChecks + OS 예약 알림 취소"
          danger
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "모든 목표 삭제",
              "목표 + 체크 기록 + OS에 예약된 알림 전부 삭제됩니다.",
              clearAllGoals,
            )
          }
        />
        <DebugRow
          title="모든 결정 카드 삭제"
          desc="gos.decisions.<coachId> 4개 삭제"
          danger
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "모든 결정 카드 삭제",
              "GO/HOLD/STOP 카드 기록 모두 삭제됩니다.",
              clearAllDecisions,
            )
          }
        />
        <DebugRow
          title="모든 행동 기록 삭제"
          desc="gos.actions 삭제"
          danger
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "모든 행동 기록 삭제",
              "행동(pending/in_progress/done/abandoned 모두) 삭제됩니다.",
              clearAllActions,
            )
          }
        />
        <DebugRow
          title="AsyncStorage 통째로 비우기"
          desc="모든 키 삭제 + 모든 예약 알림 취소"
          danger
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "AsyncStorage 통째로 비우기",
              "앱의 로컬 저장소 전체와 OS 예약 알림이 전부 삭제됩니다. 코치 선택도 풀립니다.",
              clearEverything,
            )
          }
        />
        <DebugRow
          title="stale 활성 행동 청소"
          desc="12시간+ 경과한 in_progress/paused → abandoned 일괄"
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "stale 활성 행동 청소",
              "모든 코치의 in_progress/paused 행동 중 시작(없으면 생성) 후 12시간 이상 지난 것을 '포기(abandoned)'로 일괄 정리합니다. 새 GO를 막던 stale 데이터 제거용.",
              cleanStaleActions,
            )
          }
        />
        <DebugRow
          title="시간 30분 점프"
          desc="진행/대기 중 행동의 createdAt·updatedAt을 -30분 backdate"
          disabled={busy}
          onPress={() =>
            confirmThenRun(
              "시간 30분 점프",
              "활성(pending/in_progress) 행동의 시작시각을 30분 앞당겨 '경과 시간 +30분' 효과를 만듭니다. 전역 시계 변경 아님 — 행동 데이터만 backdate.",
              jumpTime,
            )
          }
        />

        {status ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DebugRow({
  title,
  desc,
  danger,
  disabled,
  onPress,
}: {
  title: string;
  desc: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const accent = danger ? colors.danger : colors.warning;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        { borderLeftColor: accent },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.8 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: accent }]}>{title}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  warning: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowTitle: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  rowDesc: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  statusBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
  },
});
