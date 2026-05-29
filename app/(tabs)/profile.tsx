import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "@/state/session";
import { getCoach } from "@/data/coaches";
import { HomeButton } from "@/components/HomeButton";
import { colors, radius, spacing } from "@/theme/colors";

export default function ProfileScreen() {
  const router = useRouter();
  const { selectedCoach } = useSession();
  const coach = selectedCoach ? getCoach(selectedCoach) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headingRow}>
          <HomeButton />
          <Text style={styles.heading}>내 정보</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>현재 코치</Text>
          {coach ? (
            <View style={styles.coachRow}>
              <View style={[styles.coachAvatar, { backgroundColor: coach.bubbleBg, borderColor: coach.primary }]}>
                <Text style={{ fontSize: 24 }}>{coach.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.coachName, { color: coach.primary }]}>{coach.name}</Text>
                <Text style={styles.coachTag}>{coach.tagline}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.empty}>아직 코치를 선택하지 않았어요.</Text>
          )}

          <Pressable
            onPress={() => router.push("/")}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="swap-horizontal" size={16} color={colors.accent} />
            <Text style={styles.buttonText}>코치 바꾸기</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>알림 / 푸시</Text>
          <Text style={styles.empty}>곧 설정할 수 있어요.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>계정</Text>
          <Text style={styles.empty}>로그인은 백엔드 연결 후 추가됩니다.</Text>
        </View>

        {__DEV__ && (
          <View style={[styles.card, { borderColor: colors.danger + "66" }]}>
            <Text style={[styles.label, { color: colors.danger }]}>
              [DEV] 디버그
            </Text>
            <Pressable
              onPress={() => router.push("/debug")}
              style={({ pressed }) => [
                styles.button,
                {
                  borderColor: colors.danger + "55",
                  backgroundColor: colors.danger + "11",
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="bug" size={16} color={colors.danger} />
              <Text style={[styles.buttonText, { color: colors.danger }]}>
                디버그 메뉴 열기
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  heading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  coachRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  coachName: { fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  coachTag: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 13 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent + "55",
    backgroundColor: colors.accent + "11",
  },
  buttonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
});
