import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { coaches } from "@/data/coaches";
import type { CoachId, GoalFrequency } from "@/types/goal";
import { colors, radius, spacing } from "@/theme/colors";

export type GoalFormValues = {
  title: string;
  coachId: CoachId;
  frequency: GoalFrequency;
  timeOfDay: string;
  active: boolean;
};

type FrequencyMode = "daily" | "weekly" | "interval";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

type Props = {
  initial?: Partial<GoalFormValues>;
  submitLabel: string;
  onSubmit: (values: GoalFormValues) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
};

function deriveModeAndExtras(frequency: GoalFrequency | undefined) {
  if (!frequency) {
    return { mode: "daily" as FrequencyMode, daysOfWeek: [] as number[], everyN: 2 };
  }
  if (frequency.type === "weekly") {
    return {
      mode: "weekly" as FrequencyMode,
      daysOfWeek: [...frequency.daysOfWeek],
      everyN: 2,
    };
  }
  if (frequency.type === "interval") {
    return {
      mode: "interval" as FrequencyMode,
      daysOfWeek: [] as number[],
      everyN: Math.max(1, Math.floor(frequency.everyNDays)),
    };
  }
  return { mode: "daily" as FrequencyMode, daysOfWeek: [] as number[], everyN: 2 };
}

function splitTime(timeOfDay: string | undefined): { hh: string; mm: string } {
  if (!timeOfDay) return { hh: "09", mm: "00" };
  const [h, m] = timeOfDay.split(":");
  return { hh: (h ?? "09").padStart(2, "0"), mm: (m ?? "00").padStart(2, "0") };
}

export function GoalForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDelete,
}: Props) {
  const initialExtras = deriveModeAndExtras(initial?.frequency);
  const initialTime = splitTime(initial?.timeOfDay);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [coachId, setCoachId] = useState<CoachId>(
    initial?.coachId ?? coaches[0].id,
  );
  const [mode, setMode] = useState<FrequencyMode>(initialExtras.mode);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialExtras.daysOfWeek,
  );
  const [everyN, setEveryN] = useState<string>(String(initialExtras.everyN));
  const [hh, setHh] = useState(initialTime.hh);
  const [mm, setMm] = useState(initialTime.mm);
  const [active, setActive] = useState(initial?.active ?? true);
  const [submitting, setSubmitting] = useState(false);

  const everyNInt = useMemo(() => {
    const n = parseInt(everyN, 10);
    return Number.isFinite(n) ? n : 0;
  }, [everyN]);

  const hhInt = useMemo(() => {
    const n = parseInt(hh, 10);
    return Number.isFinite(n) ? n : -1;
  }, [hh]);

  const mmInt = useMemo(() => {
    const n = parseInt(mm, 10);
    return Number.isFinite(n) ? n : -1;
  }, [mm]);

  const titleOk = title.trim().length > 0;
  const weeklyOk = mode !== "weekly" || daysOfWeek.length > 0;
  const intervalOk = mode !== "interval" || (everyNInt >= 1 && everyNInt <= 30);
  const timeOk = hhInt >= 0 && hhInt <= 23 && mmInt >= 0 && mmInt <= 59;
  const canSubmit = titleOk && weeklyOk && intervalOk && timeOk && !submitting;

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const buildFrequency = (): GoalFrequency => {
    if (mode === "weekly") return { type: "weekly", daysOfWeek };
    if (mode === "interval") return { type: "interval", everyNDays: everyNInt };
    return { type: "daily" };
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        coachId,
        frequency: buildFrequency(),
        timeOfDay: `${String(hhInt).padStart(2, "0")}:${String(mmInt).padStart(2, "0")}`,
        active,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Field label="제목">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="예) 매일 30분 산책"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            maxLength={60}
          />
        </Field>

        <Field label="담당 코치">
          <View style={styles.row}>
            {coaches.map((c) => {
              const selected = c.id === coachId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCoachId(c.id)}
                  style={({ pressed }) => [
                    styles.coachChip,
                    selected
                      ? {
                          borderColor: c.primary,
                          backgroundColor: c.primary + "22",
                        }
                      : { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{c.emoji}</Text>
                  <Text
                    style={[
                      styles.coachChipText,
                      { color: selected ? c.primary : colors.textMuted },
                    ]}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="빈도">
          <View style={styles.row}>
            <RadioChip
              label="매일"
              selected={mode === "daily"}
              onPress={() => setMode("daily")}
            />
            <RadioChip
              label="요일 선택"
              selected={mode === "weekly"}
              onPress={() => setMode("weekly")}
            />
            <RadioChip
              label="N일마다"
              selected={mode === "interval"}
              onPress={() => setMode("interval")}
            />
          </View>

          {mode === "weekly" && (
            <View style={[styles.row, { marginTop: spacing.md }]}>
              {DAY_NAMES.map((name, i) => {
                const selected = daysOfWeek.includes(i);
                return (
                  <Pressable
                    key={name}
                    onPress={() => toggleDay(i)}
                    style={({ pressed }) => [
                      styles.dayChip,
                      selected
                        ? {
                            backgroundColor: colors.accent + "33",
                            borderColor: colors.accent,
                          }
                        : { borderColor: colors.border },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        { color: selected ? colors.accent : colors.textMuted },
                      ]}
                    >
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {mode === "interval" && (
            <View style={[styles.intervalRow, { marginTop: spacing.md }]}>
              <TextInput
                value={everyN}
                onChangeText={(v) => setEveryN(v.replace(/[^0-9]/g, "").slice(0, 2))}
                keyboardType="number-pad"
                style={[styles.input, styles.numberInput]}
              />
              <Text style={styles.intervalLabel}>일마다 (1~30)</Text>
            </View>
          )}
        </Field>

        <Field label="시각">
          <View style={styles.timeRow}>
            <TextInput
              value={hh}
              onChangeText={(v) => setHh(v.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, styles.timeInput]}
              placeholder="09"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.timeColon}>:</Text>
            <TextInput
              value={mm}
              onChangeText={(v) => setMm(v.replace(/[^0-9]/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              style={[styles.input, styles.timeInput]}
              placeholder="00"
              placeholderTextColor={colors.textDim}
            />
            <Text style={styles.timeHint}>(24시간제)</Text>
          </View>
        </Field>

        <Field label="활성">
          <View style={styles.activeRow}>
            <Text style={styles.activeText}>
              {active ? "켜짐 (알림 발송)" : "꺼짐"}
            </Text>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: colors.border, true: colors.accent + "AA" }}
              thumbColor={active ? colors.accent : colors.textDim}
            />
          </View>
        </Field>

        {onDelete && (
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.deleteText}>목표 삭제</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={styles.actionsBar}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: canSubmit ? colors.accent : colors.border },
            pressed && canSubmit && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function RadioChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioChip,
        selected
          ? { backgroundColor: colors.accent + "22", borderColor: colors.accent }
          : { borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.radioText,
          { color: selected ? colors.accent : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  coachChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  coachChipText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },
  radioChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
  },
  radioText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  intervalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  numberInput: {
    width: 70,
    textAlign: "center",
  },
  intervalLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timeInput: {
    width: 70,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  timeColon: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  timeHint: {
    color: colors.textDim,
    fontSize: 12,
    marginLeft: spacing.sm,
  },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  activeText: {
    color: colors.text,
    fontSize: 14,
  },
  deleteButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger + "66",
    backgroundColor: colors.danger + "11",
    alignItems: "center",
  },
  deleteText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  actionsBar: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },
  submitButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  submitText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
