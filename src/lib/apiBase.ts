import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL 결정 우선순위:
 *   1. EXPO_PUBLIC_API_BASE_URL 환경변수 (배포 모바일 빌드용)
 *   2. 웹: same-origin (빈 문자열)
 *   3. 개발 모바일: Metro hostUri에서 호스트 추출, http://<host>:8081
 *   4. 위 어느 것도 안 되면 throw
 */
export function getApiBase(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (override && override.length > 0) {
    return override.replace(/\/$/, "");
  }

  if (Platform.OS === "web") return "";

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(":")[0];
      return `http://${host}:8081`;
    }
  }

  throw new Error(
    "API base URL을 결정할 수 없음. 모바일 빌드는 EXPO_PUBLIC_API_BASE_URL 환경변수 설정 필요.",
  );
}
