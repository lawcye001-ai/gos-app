import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { coaches, type CoachId } from "@/data/coaches";
import { CoachCard } from "@/components/CoachCard";
import { useSession } from "@/state/session";
import { colors, spacing } from "@/theme/colors";

export default function CoachSelectScreen() {
  const router = useRouter();
  const { setSelectedCoach } = useSession();

  const handleSelect = (id: CoachId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedCoach(id);
    router.replace("/(tabs)/chat");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>GOS</Text>
          <Text style={styles.brandSub}>Go or STOP?</Text>
        </View>

        <View style={styles.intro}>
          <Text style={styles.title}>너의 코치를 선택해</Text>
          <Text style={styles.subtitle}>
            네 성격과 가장 잘 맞는 한 명을 골라. 나중에 바꿀 수도 있어.
          </Text>
        </View>

        {coaches.map((coach) => (
          <CoachCard key={coach.id} coach={coach} onPress={() => handleSelect(coach.id)} />
        ))}

        <Text style={styles.footer}>ZERO와 NOVA는 곧 만나볼 수 있어.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  header: { alignItems: "center", marginTop: spacing.lg, marginBottom: spacing.xl },
  brand: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 6,
  },
  brandSub: { color: colors.textMuted, fontSize: 13, letterSpacing: 3, marginTop: 4 },
  intro: { marginBottom: spacing.xl },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  footer: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.lg,
  },
});
