import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Switch } from "react-native";
import { getCoach } from "@/data/coaches";
import type { Goal } from "@/types/goal";
import { updateGoal } from "@/lib/goals/storage";
import { syncOnActiveToggle } from "@/lib/goals/syncNotifications";
import { formatFrequency } from "@/lib/goals/formatFrequency";
import { colors, radius, spacing } from "@/theme/colors";

type Props = {
  goal: Goal;
  onPress: () => void;
  onChange?: (goal: Goal) => void;
};

export function GoalCard({ goal, onPress, onChange }: Props) {
  const coach = getCoach(goal.coachId);
  const [active, setActive] = useState(goal.active);
  const [updating, setUpdating] = useState(false);

  const toggleActive = async (value: boolean) => {
    if (updating) return;
    setUpdating(true);
    setActive(value);
    try {
      const updated = await updateGoal(goal.id, { active: value });
      try {
        await syncOnActiveToggle(updated);
      } catch (e) {
        console.warn("[GoalCard] notification sync failed", e);
      }
      onChange?.(updated);
    } catch (e) {
      console.error("[GoalCard] toggle failed", e);
      setActive(!value);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: coach.primary },
        pressed && { opacity: 0.85 },
        !active && { opacity: 0.55 },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {goal.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.coach, { color: coach.primary }]}>
            {coach.emoji} {coach.name}
          </Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.frequency}>{formatFrequency(goal)}</Text>
        </View>
      </View>
      <View
        style={styles.right}
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => {}}
        {...stopWebClick}
      >
        <Switch
          value={active}
          onValueChange={toggleActive}
          disabled={updating}
          trackColor={{ false: colors.border, true: coach.primary + "AA" }}
          thumbColor={active ? coach.primary : colors.textDim}
        />
      </View>
    </Pressable>
  );
}

const stopWebClick: Record<string, unknown> = {
  onClick: (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
  },
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "center",
    gap: spacing.md,
  },
  body: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  coach: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dot: {
    color: colors.textDim,
    fontSize: 12,
  },
  frequency: {
    color: colors.textMuted,
    fontSize: 12,
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
