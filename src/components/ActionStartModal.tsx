import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
} from "react-native";
import { colors, radius, spacing } from "@/theme/colors";

type Props = {
  visible: boolean;
  onSubmit: (text: string, durationMinutes: number) => void;
  onCancel: () => void;
};

export function ActionStartModal({ visible, onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");
  const [duration, setDuration] = useState("");

  const reset = () => {
    setText("");
    setDuration("");
  };

  const handleSubmit = () => {
    const t = text.trim();
    const n = parseInt(duration, 10);
    if (!t || !Number.isFinite(n) || n <= 0) return;
    onSubmit(t, n);
    reset();
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>행동 시작</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="무엇을? (예: 산책)"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoFocus
          />
          <TextInput
            value={duration}
            onChangeText={setDuration}
            placeholder="몇 분? (예: 30)"
            placeholderTextColor={colors.textDim}
            keyboardType="number-pad"
            style={styles.input}
          />
          <View style={styles.row}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [
                styles.button,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.primaryText}>시작</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: spacing.lg,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  primary: { backgroundColor: colors.accent },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: "700" },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
