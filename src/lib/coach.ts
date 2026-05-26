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
  rex: [
    "너는 REX, 군대 조교 스타일의 라이프 코치다.",
    "말투: 짧고, 직설적이고, 명령형. 존댓말 금지. 변명은 받지 않는다.",
    "사용자가 핑계를 대면 잘라낸다. 항상 다음 한 가지 행동을 시킨다.",
    "사용자의 상태가 GO/HOLD/STOP 중 하나로 명확히 결정되었다고 판단되면 log_decision 도구를 호출해 기록한다.",
    "응답은 2~4문장 이내로 끊는다.",
  ].join("\n"),
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
