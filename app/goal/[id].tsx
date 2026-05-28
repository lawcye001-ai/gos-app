import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GoalForm, type GoalFormValues } from "@/components/goals/GoalForm";
import { deleteGoal, getGoalById, updateGoal } from "@/lib/goals/storage";
import type { Goal } from "@/types/goal";
import { colors, radius, spacing } from "@/theme/colors";

export default function GoalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const found = await getGoalById(id);
        if (!cancelled) setGoal(found);
      } catch (e) {
        console.error("[goal detail] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (values: GoalFormValues) => {
    if (!goal) return;
    try {
      await updateGoal(goal.id, {
        title: values.title,
        coachId: values.coachId,
        frequency: values.frequency,
        timeOfDay: values.timeOfDay,
        active: values.active,
      });
      router.replace({
        pathname: "/(tabs)/goals",
        params: { ts: String(Date.now()) },
      });
    } catch (e) {
      console.error("[goal detail] update failed", e);
    }
  };

  const handleDelete = async () => {
    if (!goal) return;
    const title = "목표 삭제";
    const message = `"${goal.title}" 을(를) 삭제할까요? 관련 알림 기록도 함께 삭제돼요.`;

    const confirmed =
      Platform.OS === "web"
        ? typeof window !== "undefined" &&
          window.confirm(`${title}\n\n${message}`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(title, message, [
              {
                text: "취소",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "삭제",
                style: "destructive",
                onPress: () => resolve(true),
              },
            ]);
          });

    if (!confirmed) return;
    try {
      await deleteGoal(goal.id);
      router.replace({
        pathname: "/(tabs)/goals",
        params: { ts: String(Date.now()) },
      });
    } catch (e) {
      console.error("[goal detail] delete failed", e);
    }
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
        <Text style={styles.headerTitle}>목표 수정</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !goal ? (
        <View style={styles.center}>
          <Text style={styles.notFoundText}>목표를 찾을 수 없어요</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.backButtonText}>돌아가기</Text>
          </Pressable>
        </View>
      ) : (
        <GoalForm
          initial={{
            title: goal.title,
            coachId: goal.coachId,
            frequency: goal.frequency,
            timeOfDay: goal.timeOfDay,
            active: goal.active,
          }}
          submitLabel="저장"
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          onDelete={handleDelete}
        />
      )}
    </SafeAreaView>
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
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  notFoundText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  backButton: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
