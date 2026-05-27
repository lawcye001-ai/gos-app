import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Decision } from "@/lib/decisions";
import { colors, radius, spacing } from "@/theme/colors";

type Props = {
  decision: Decision;
  onPress?: () => void;
};

const CARD_COLORS: Record<Decision["card"], string> = {
  GO: colors.success,
  HOLD: colors.warning,
  STOP: colors.danger,
};

const CARD_LABEL: Record<Decision["card"], string> = {
  GO: "GO",
  HOLD: "HOLD",
  STOP: "STOP",
};

// LLM이 멀티라인 필드에 escaped "\n" 시퀀스(백슬래시+n)를 그대로 넣어 보내는
// 경우를 위해 실제 newline 문자로 정규화.
function normalizeLineBreaks(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function DecisionCard({ decision, onPress }: Props) {
  const accent = CARD_COLORS[decision.card];
  const resolved = decision.status !== "active";

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.card,
          {
            borderColor: accent,
            backgroundColor: accent + "14",
          },
          pressed && onPress && { opacity: 0.85 },
        ]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.cardLabel, { color: accent }]}>
            {CARD_LABEL[decision.card]}
          </Text>
          {resolved && (
            <Text style={styles.resolvedTag}>
              {decision.status === "resolved" ? "종결" : "변경됨"}
            </Text>
          )}
        </View>
        <Text style={styles.topic} numberOfLines={2}>
          {decision.topic}
        </Text>

        {decision.diagnosis && (
          <View style={styles.clinicalSection}>
            <Text style={[styles.sectionLabel, { color: accent }]}>
              ─ 진단 ─
            </Text>
            <Text style={styles.diagnosisText}>
              {normalizeLineBreaks(decision.diagnosis)}
            </Text>
          </View>
        )}

        {decision.prescription && (
          <View style={styles.clinicalSection}>
            <Text style={[styles.sectionLabel, { color: accent }]}>
              ─ 처방 ─
            </Text>
            <Text style={styles.prescriptionText}>
              {normalizeLineBreaks(decision.prescription)}
            </Text>
          </View>
        )}

        <Text
          style={[
            styles.reason,
            (decision.diagnosis || decision.prescription) &&
              styles.reasonWithClinical,
          ]}
        >
          {decision.reason}
        </Text>

        {decision.card === "GO" && decision.linkedActionId && (
          <View style={[styles.footer, { borderTopColor: accent + "44" }]}>
            <Text style={[styles.footerText, { color: accent }]}>
              · 행동 목록에 등록됨
            </Text>
          </View>
        )}

        {decision.card === "HOLD" && decision.missingInfo && (
          <View style={[styles.footer, { borderTopColor: accent + "44" }]}>
            <Text style={styles.missingLabel}>필요한 정보</Text>
            <Text style={styles.missingText}>{decision.missingInfo}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  card: {
    width: "85%",
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardLabel: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
  },
  resolvedTag: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topic: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  clinicalSection: {
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 4,
  },
  diagnosisText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  prescriptionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  reason: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  reasonWithClinical: {
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
  missingLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  missingText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
