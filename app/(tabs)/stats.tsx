import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Placeholder } from "@/components/Placeholder";
import { HomeButton } from "@/components/HomeButton";
import { colors, spacing } from "@/theme/colors";

export default function StatsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <HomeButton />
      </View>
      <Placeholder
        icon="stats-chart"
        title="성장 통계"
        subtitle="연속 달성, GO 비율, 코치별 대화 패턴. 너의 성장이 데이터로 보여요."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
