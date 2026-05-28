import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GoalForm, type GoalFormValues } from "@/components/goals/GoalForm";
import { createGoal } from "@/lib/goals/storage";
import { syncOnCreate } from "@/lib/goals/syncNotifications";
import { colors, spacing } from "@/theme/colors";

export default function NewGoalScreen() {
  const router = useRouter();

  const handleSubmit = async (values: GoalFormValues) => {
    try {
      const created = await createGoal({
        title: values.title,
        coachId: values.coachId,
        frequency: values.frequency,
        timeOfDay: values.timeOfDay,
        active: values.active,
        createdVia: "tab",
      });
      try {
        await syncOnCreate(created);
      } catch (e) {
        console.warn("[new goal] notification sync failed", e);
      }
      router.replace({
        pathname: "/(tabs)/goals",
        params: { ts: String(Date.now()) },
      });
    } catch (e) {
      console.error("[new goal] create failed", e);
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
        <Text style={styles.headerTitle}>새 목표</Text>
        <View style={styles.iconButton} />
      </View>
      <GoalForm
        submitLabel="등록"
        onSubmit={handleSubmit}
        onCancel={() => router.back()}
      />
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
});
