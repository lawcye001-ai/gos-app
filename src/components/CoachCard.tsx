import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Coach } from "@/data/coaches";
import { colors, radius, spacing } from "@/theme/colors";

type Props = {
  coach: Coach;
  onPress: () => void;
};

export function CoachCard({ coach, onPress }: Props) {
  const disabled = !coach.available;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        { borderColor: coach.primary + "55" },
        pressed && !disabled && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={[styles.glow, { backgroundColor: coach.primary + "22" }]} />
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: coach.bubbleBg, borderColor: coach.primary }]}>
          <Text style={styles.emoji}>{coach.emoji}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: coach.primary }]}>{coach.name}</Text>
            {disabled && (
              <View style={styles.soonPill}>
                <Text style={styles.soonText}>SOON</Text>
              </View>
            )}
          </View>
          <Text style={styles.tagline}>{coach.tagline}</Text>
        </View>
      </View>
      <Text style={styles.description}>{coach.description}</Text>
      <View style={styles.tagRow}>
        <View style={[styles.tag, { borderColor: coach.primary + "44" }]}>
          <Text style={[styles.tagText, { color: coach.bubbleText }]}>{coach.personality}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  emoji: { fontSize: 28 },
  info: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  description: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagText: { fontSize: 12, fontWeight: "600" },
  soonPill: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  soonText: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
});
