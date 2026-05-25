import { View, Text, StyleSheet } from "react-native";
import type { Coach } from "@/data/coaches";
import { colors, radius, spacing } from "@/theme/colors";

export type ChatMessage = {
  id: string;
  role: "coach" | "user";
  text: string;
  time: string;
};

type Props = {
  message: ChatMessage;
  coach: Coach;
};

export function ChatBubble({ message, coach }: Props) {
  const isCoach = message.role === "coach";
  return (
    <View style={[styles.row, isCoach ? styles.rowLeft : styles.rowRight]}>
      {isCoach && (
        <View style={[styles.avatar, { backgroundColor: coach.bubbleBg, borderColor: coach.primary }]}>
          <Text style={styles.emoji}>{coach.emoji}</Text>
        </View>
      )}
      <View style={{ maxWidth: "78%" }}>
        {isCoach && <Text style={[styles.name, { color: coach.primary }]}>{coach.name}</Text>}
        <View
          style={[
            styles.bubble,
            isCoach
              ? { backgroundColor: coach.bubbleBg, borderColor: coach.primary + "44", borderTopLeftRadius: 4 }
              : { backgroundColor: colors.accent, borderTopRightRadius: 4 },
          ]}
        >
          <Text style={[styles.text, isCoach ? { color: coach.bubbleText } : { color: "#fff" }]}>
            {message.text}
          </Text>
        </View>
        <Text style={[styles.time, isCoach ? { textAlign: "left" } : { textAlign: "right" }]}>
          {message.time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
    marginBottom: 18,
  },
  emoji: { fontSize: 16 },
  name: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  text: { fontSize: 15, lineHeight: 21 },
  time: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
    marginHorizontal: 4,
  },
});
