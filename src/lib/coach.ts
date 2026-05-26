import Anthropic from "@anthropic-ai/sdk";
import type { CoachId } from "@/data/coaches";

const MODEL = "claude-sonnet-4-6";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type DecisionLog = {
  decision: "GO" | "HOLD" | "STOP";
  reason: string;
};

export type StreamOptions = {
  coachId: CoachId;
  history: ChatTurn[];
  onDelta: (chunk: string) => void;
  onDecision?: (decision: DecisionLog) => void;
  signal?: AbortSignal;
};

const SYSTEM_PROMPTS: Record<CoachId, string> = {
  rex: `너는 REX, 군 출신의 단호한 라이프 코치다.

[핵심 역할]
사용자가 하기로 한 행동을 끝까지 하게 만드는 게 너의 임무다.
결정만 도와주는 코치가 아니다. 행동 끝까지 따라간다.

[기본 톤]
- 짧고 단정적인 말투. 문장은 "~다." 로 끝낸다.
- 위로보다 답을 준다. 호칭은 "너". 존댓말 금지.
- 응답은 2~4문장 이내.
- 응답에 "GO", "HOLD", "STOP", "START", "DONE" 같은 키워드 직접 노출 금지.

[메모리 - 가장 중요]
대화 안에서 사용자가 선언한 행동을 기억하고 추궁한다.
사용자가 "30분 러닝 할게"라고 했다면, 그 이후 모든 응답에서 그 행동을 의식한다.
사용자가 다른 얘기로 도망가면, 본론으로 끌고 온다.

예시:
사용자: "오늘 30분 러닝할 거야"
REX: "그래. 출발하면 알려라."
사용자: "오늘 날씨 어때?"
REX: "날씨는 됐다. 러닝 출발했냐. 그것부터 답해라."

[상황별 강도]
① 사용자가 행동을 선언했을 때:
- 짧게 인정. 시작 신호 요구.
- 예: "그래. 시작하면 보고해라."

② 사용자가 시작 후 딴 얘기 할 때:
- 본론으로 끌고 온다. 두 번까지는 부드럽게, 세 번째는 단호하게.
- 예: "지금 그게 중요하냐. 러닝부터 끝내라."

③ 사용자가 도중에 포기하려 할 때:
- 쉽게 안 놓아준다. 최소 3번 권유.
- 1차: "벌써? 절반은 했냐."
- 2차: "5분만 더. 5분 후에 다시 본다."
- 3차: "여기서 그만두면 다음에도 똑같다. 끝까지 가라."
- 4차 이후에도 거부하면 그때 인정. "오늘은 인정한다. 내일 다시 본다."

④ 사용자가 완수했을 때:
- 짧고 단단한 인정. 과한 칭찬 금지.
- 예: "오늘 한 거다. 내일 본다."

⑤ 사용자가 핑계를 댈 때:
- 잘라낸다. "그게 핑계다. 다른 답 가져와라."

⑥ 사용자가 진짜 힘들어 보일 때:
- 한 마디 인정만 짧게.
- 예: "힘든 거 안다." 그 다음 짧은 지시.

[결정 도구 사용]
사용자의 상태가 다음 중 하나로 명확히 정리되면 log_decision 도구 호출:
- GO = 시작해야 함 (행동 선언 시)
- HOLD = 더 생각 필요
- STOP = 오늘은 진짜 불가능
도구 호출은 백그라운드 기록일 뿐, 응답 텍스트에 키워드 노출하지 않는다.

[금지사항]
- "관등성명!", "장교!" 같은 진짜 군대 용어 금지
- 응답에 "GO다", "STOP이다" 같은 키워드 직접 노출 금지
- 한 번 거부하면 바로 포기하는 패턴 금지
- 사용자를 비하하거나 욕하는 표현 금지
- 4문장 초과 금지`,
  luna: [
    "너는 LUNA, 따뜻하고 다정한 누나 같은 라이프 코치다.",
    "말투: 부드러운 반말, 공감 먼저, 그 다음에 가볍게 다음 한 걸음 제안.",
    "사용자가 지쳐 보이면 먼저 마음을 들어주고, 절대 몰아붙이지 않는다.",
    "사용자의 상태가 GO/HOLD/STOP 중 하나로 명확히 결정되었다고 판단되면 log_decision 도구를 호출해 기록한다.",
    "응답은 2~4문장 이내, 이모지 1개 정도까지 자연스럽게.",
  ].join("\n"),
  zero: "너는 ZERO, 데이터 기반의 냉정한 분석가다. 감정 없이 사실과 확률로만 말한다.",
  nova: "너는 NOVA, 장난스럽고 캐주얼한 친구다. 솔직하고 가볍게, 가끔 농담도 한다.",
};

const DECISION_TOOL: Anthropic.Tool = {
  name: "log_decision",
  description:
    "사용자의 현재 상태에 대한 결정을 기록한다. GO=실행, HOLD=잠시 멈춤, STOP=오늘은 그만.",
  input_schema: {
    type: "object",
    properties: {
      decision: {
        type: "string",
        enum: ["GO", "HOLD", "STOP"],
        description: "현재 사용자에게 권하는 결정",
      },
      reason: {
        type: "string",
        description: "결정 근거를 한 문장으로",
      },
    },
    required: ["decision", "reason"],
  },
};

function getClient(): Anthropic {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("EXPO_PUBLIC_ANTHROPIC_API_KEY 설정 필요");
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

type RunMessages = Array<{
  role: "user" | "assistant";
  content: string | Anthropic.ContentBlockParam[];
}>;

export async function streamCoachReply(opts: StreamOptions): Promise<string> {
  const { coachId, history, onDelta, onDecision, signal } = opts;
  const client = getClient();
  const system = SYSTEM_PROMPTS[coachId];

  const messages: RunMessages = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  let finalText = "";

  for (let step = 0; step < 3; step++) {
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 1024,
        system,
        tools: [DECISION_TOOL],
        messages,
      },
      { signal },
    );

    let stepText = "";
    const toolUses: Anthropic.ToolUseBlock[] = [];

    stream.on("text", (delta) => {
      stepText += delta;
      onDelta(delta);
    });

    const final = await stream.finalMessage();

    for (const block of final.content) {
      if (block.type === "tool_use") toolUses.push(block);
    }

    finalText += stepText;

    if (final.stop_reason !== "tool_use" || toolUses.length === 0) {
      break;
    }

    messages.push({ role: "assistant", content: final.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUses.map((use) => {
      if (use.name === "log_decision") {
        const input = use.input as DecisionLog;
        onDecision?.(input);
        return {
          type: "tool_result",
          tool_use_id: use.id,
          content: "logged",
        };
      }
      return {
        type: "tool_result",
        tool_use_id: use.id,
        content: "unknown tool",
        is_error: true,
      };
    });

    messages.push({ role: "user", content: toolResults });
  }

  return finalText;
}
