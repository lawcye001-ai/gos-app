import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL 결정 우선순위:
 *   1. EXPO_PUBLIC_API_BASE_URL 환경변수 (배포 모바일 빌드용)
 *   2. 웹: same-origin (빈 문자열)
 *   3. 개발 모바일: Constants에서 dev server LAN 호스트 추출
 *      → http://<host>:8081
 *   4. 위 어느 것도 안 되면 throw
 */
export function getApiBase(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (override && override.length > 0) {
    return override.replace(/\/$/, "");
  }

  if (Platform.OS === "web") return "";

  if (__DEV__) {
    const host = resolveDevHost();
    if (host) {
      return `http://${host}:8081`;
    }
  }

  throw new Error(
    "API base URL을 결정할 수 없음. 모바일 빌드는 EXPO_PUBLIC_API_BASE_URL 환경변수 설정 필요.",
  );
}

function resolveDevHost(): string | null {
  const fromExpoConfig = Constants.expoConfig?.hostUri;
  if (fromExpoConfig) {
    const h = stripPort(fromExpoConfig);
    if (h) return h;
  }
  const fromExperienceUrl = Constants.experienceUrl;
  if (typeof fromExperienceUrl === "string" && fromExperienceUrl.length > 0) {
    const m = fromExperienceUrl.match(/^[a-z]+:\/\/([^/]+)/i);
    if (m && m[1]) {
      const h = stripPort(m[1]);
      if (h) return h;
    }
  }
  return null;
}

function stripPort(hostWithMaybePort: string): string | null {
  const trimmed = hostWithMaybePort.trim();
  if (!trimmed) return null;
  const colonIdx = trimmed.indexOf(":");
  return colonIdx >= 0 ? trimmed.slice(0, colonIdx) : trimmed;
}
