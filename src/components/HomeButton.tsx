import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "@/theme/colors";

// 코치 선택 화면(홈)으로 한 번에 이동. 모든 탭 헤더에서 동일하게 사용.
// 스택을 정리하기 위해 push가 아닌 replace 사용.
export function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.replace("/")}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="홈(코치 선택)으로 이동"
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name="home-outline" size={22} color={colors.textMuted} />
    </Pressable>
  );
}
