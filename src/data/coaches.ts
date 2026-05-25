export type CoachId = "rex" | "luna" | "zero" | "nova";

export type Coach = {
  id: CoachId;
  name: string;
  tagline: string;
  personality: string;
  description: string;
  emoji: string;
  primary: string;
  secondary: string;
  bubbleBg: string;
  bubbleText: string;
  available: boolean;
  sampleLines: string[];
};

export const coaches: Coach[] = [
  {
    id: "rex",
    name: "REX",
    tagline: "군대 조교형",
    personality: "엄격하고 직설적",
    description: "변명은 받지 않는다. 행동만이 답이다. 너를 한계 밖으로 끌어내 줄 코치.",
    emoji: "🪖",
    primary: "#DC2626",
    secondary: "#7F1D1D",
    bubbleBg: "#2A0F12",
    bubbleText: "#FCA5A5",
    available: true,
    sampleLines: [
      "지금 침대에 누워있나? 일어나라. 당장.",
      "어제의 너보다 1% 나아져라. 그게 전부다.",
      "변명은 시간 낭비다. GO 아니면 STOP, 선택해.",
    ],
  },
  {
    id: "luna",
    name: "LUNA",
    tagline: "상냥 누나형",
    personality: "따뜻하고 공감적",
    description: "지친 너의 마음을 먼저 들어주는 코치. 그리고 다정하게 다음 한 걸음을 함께 정해줘.",
    emoji: "🌙",
    primary: "#A78BFA",
    secondary: "#7C3AED",
    bubbleBg: "#1F1A2E",
    bubbleText: "#E9D5FF",
    available: true,
    sampleLines: [
      "오늘 하루 어땠어? 무리하진 않았지?",
      "괜찮아, 천천히 가도 돼. 같이 정리해보자.",
      "네가 여기까지 온 것만으로도 충분히 멋져.",
    ],
  },
  {
    id: "zero",
    name: "ZERO",
    tagline: "냉정 현실형",
    personality: "데이터 기반 분석가",
    description: "감정은 빼고 사실만. 너의 패턴과 확률을 보여주는 코치.",
    emoji: "🧊",
    primary: "#6B7280",
    secondary: "#374151",
    bubbleBg: "#16181D",
    bubbleText: "#D1D5DB",
    available: false,
    sampleLines: [
      "지난 7일 중 5일 동일한 핑계를 사용했음.",
      "이 패턴을 유지하면 목표 달성 확률 18%.",
      "감정이 아니라 데이터를 보라.",
    ],
  },
  {
    id: "nova",
    name: "NOVA",
    tagline: "친구형",
    personality: "장난스럽고 캐주얼",
    description: "심각하지 않게, 그러나 솔직하게. 옆에서 같이 욕도 해주고 같이 웃어주는 코치.",
    emoji: "⚡",
    primary: "#FBBF24",
    secondary: "#D97706",
    bubbleBg: "#2A1F0F",
    bubbleText: "#FDE68A",
    available: false,
    sampleLines: [
      "야 그거 진짜였어? ㅋㅋ 일단 들어줄게.",
      "오늘은 좀 쉬자, 내일 같이 가자고.",
      "아 그건 좀 핑계 아님? 솔직히 말해봐.",
    ],
  },
];

export const getCoach = (id: CoachId): Coach => {
  const coach = coaches.find((c) => c.id === id);
  if (!coach) throw new Error(`Unknown coach: ${id}`);
  return coach;
};
