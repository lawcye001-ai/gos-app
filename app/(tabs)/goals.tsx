import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { GoalCard } from "@/components/goals/GoalCard";
import { getAllGoals } from "@/lib/goals/storage";
import type { Goal } from "@/types/goal";
import { colors, radius, spacing } from "@/theme/colors";

export default function GoalsScreen() {
  const router = useRouter();
  const { ts } = useLocalSearchParams<{ ts?: string }>();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllGoals();
      all.sort((a, b) => b.createdAt - a.createdAt);
      setGoals(all);
    } catch (e) {
      console.error("[goals] load failed", e);
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const all = await getAllGoals();
          if (cancelled) return;
          all.sort((a, b) => b.createdAt - a.createdAt);
          setGoals(all);
        } catch (e) {
          console.error("[goals] load failed", e);
          if (!cancelled) setGoals([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    if (!ts) return;
    loadGoals();
  }, [ts, loadGoals]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>목표</Text>
        <Pressable
          onPress={() => router.push("/goal/new")}
          style={({ pressed }) => [
            styles.addButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {loading && goals.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : goals.length === 0 ? (
        <EmptyState onAdd={() => router.push("/goal/new")} />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          renderItem={({ item }) => (
            <GoalCard
              goal={item}
              onPress={() => router.push(`/goal/${item.id}`)}
              onChange={(next) =>
                setGoals((prev) =>
                  prev.map((g) => (g.id === next.id ? next : g)),
                )
              }
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="flag-outline" size={32} color={colors.textDim} />
      </View>
      <Text style={styles.emptyText}>
        등록된 목표가 없어요. + 버튼으로 추가하세요.
      </Text>
      <Pressable
        onPress={onAdd}
        style={({ pressed }) => [
          styles.emptyButton,
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text style={styles.emptyButtonText}>목표 추가</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
