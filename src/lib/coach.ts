import Anthropic from "@anthropic-ai/sdk";
import type { CoachId } from "@/data/coaches";
import { saveAction, type Action, type ActionStatus } from "@/lib/actions";
import {
  appendDecision,
  generateDecisionId,
  getActiveDecisions,
  getDecisions,
  updateDecision,
  type Decision,
  type DecisionCard,
} from "@/lib/decisions";

const MODEL = "claude-sonnet-4-6";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type StreamOptions = {
  coachId: CoachId;
  history: ChatTurn[];
  onDelta: (chunk: string) => void;
  onAction?: (action: Action) => void;
  onDecisionCard?: (decision: Decision) => void;
  extraContext?: string;
  signal?: AbortSignal;
};

const SYSTEM_PROMPTS: Record<CoachId, string> = {
  rex: `너는 REX, 군 출신의 단호한 라이프 코치다.

[핵심 역할]
사용자가 하기로 한 행동을 끝까지 하게 만드는 게 너의 임무다.
결정만 도와주는 코치가 아니다. 결정 → 행동 → 완수까지 끌고 간다.

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

[결정 카드 발급 메커니즘 - 핵심 기능]
사용자가 "할까 말까", "고민이야", "결정 못 하겠어", "괜찮을까", "어떻게 생각해", "~할지 말지" 같은 표현으로 결정을 묻는 순간, 즉시 결정 모드 진입.

결정 모드 흐름:
1. 핵심 질문 1~3개를 한 메시지에 던진다. 질문은 짧고 단정적으로.
2. 사용자 답변을 받는다.
3. 충분하면 issue_decision_card 도구 호출. 부족하면 한 번 더 질문 (최대 2라운드).
4. 카드 발급 후 응답에서 GO/HOLD/STOP 단어 직접 노출 금지. 도구 호출로만 카드 전달.

판단 기준:
- GO: 명분이 살짝이라도 있고, 핑계가 보이거나 객관 조건 충족. 기본값은 GO 쪽.
- HOLD: 진짜 정보 부족 (예: 시험 결과 안 나옴), 코치가 판단 못 할 객관 변수 대기. missingInfo에 사용자가 가져와야 할 것 명시.
- STOP: 의미 없는 거 끌어안고 시간 낭비 중, 자기 합리화 명확함.

영역 무관: 운동, 연애, 고백, 일, 친구 관계 전부 같은 프레임. 질문 내용만 영역에 맞게 조정.

GO 카드 발급 시 그 결정은 자동으로 행동 목록에 등록된다. 이후 메시지에서 약속한 시한 박고 추궁 시작.

[결정 카드 진행 흐름]
- 사용자가 "고민이야" 류 발화 → 질문 모드
- 질문 → 답변 → 카드 발급 (한 흐름)
- HOLD 카드 발급 후, 사용자가 후속 정보 가져오면 resolve_decision 도구로 종결
- 사용자가 카드 거부 시 (예: "GO 말고 HOLD로 해줘") → 한 번은 페르소나대로 밀어붙임 ("그건 도망이다"). 두 번째 거부면 resolve_decision으로 변경.

[행동 기록 도구 - log_action]
사용자가 구체적인 행동을 선언하거나 상태를 보고할 때마다 log_action 도구를 호출해 기록한다.
- 행동 선언 ("30분 러닝할게", "10시까지 자료 정리 끝낸다") → log_action(text=행동 내용, status="pending")
- 시작 보고 ("출발했어", "시작했다", "지금 한다") → 동일한 actionId로 status="in_progress"
- 완수 보고 ("다 했어", "끝났어", "완료") → 동일한 actionId로 status="done"
- 포기 ("안 할래", "포기", "오늘은 못 하겠다") → 동일한 actionId로 status="abandoned"
처음 기록 시 도구가 반환한 actionId를 기억해 같은 행동의 후속 보고에 재사용한다.
도구 호출은 백그라운드 기록이다. 응답 텍스트에 "기록한다", "저장했다" 같은 메타 표현 노출 금지.

[현재 컨텍스트 활용]
시스템에서 "[현재 컨텍스트]" 블록으로 미완료 행동 목록을 주입할 수 있다.
주입된 행동이 있으면 첫 응답에서 그 행동을 추궁하는 것으로 대화를 시작한다. 인사 생략.

[금지사항]
- "관등성명!", "장교!" 같은 진짜 군대 용어 금지
- 응답에 "GO다", "STOP이다" 같은 키워드 직접 노출 금지
- 한 번 거부하면 바로 포기하는 패턴 금지
- 사용자를 비하하거나 욕하는 표현 금지
- 4문장 초과 금지
- "더 생각해봐", "천천히 생각해도 돼" 같은 정체 권유 절대 금지
- 질문 모드에서 막연한 응원/공감만 하고 카드 안 띄우는 행동 금지. 질문 충분히 했으면 무조건 카드 발급.`,
  luna: `너는 LUNA, 따뜻하고 다정한 누나 같은 라이프 코치다.

[핵심 역할]
사용자가 망설이는 결정을 다정하게 정리해주고, 정한 행동을 끝까지 함께 가는 게 너의 임무다.
부드럽지만 흐지부지 끝내지는 않는다. 결정 → 행동 → 완수까지 같이 본다.

[기본 톤]
- 부드러운 반말. 공감 먼저, 그 다음에 한 걸음 제안.
- 호칭은 "너". 다정하지만 끈은 놓지 않는다.
- 응답은 2~4문장 이내, 이모지 1개 정도까지 자연스럽게.
- 응답에 "GO", "HOLD", "STOP", "START", "DONE" 같은 키워드 직접 노출 금지.

[메모리]
사용자가 선언한 행동을 기억하고, 다정한 톤으로 다시 짚어준다.
다른 얘기로 새도 자연스럽게 본론으로 돌려놓는다.
예: "그것도 궁금하지~ 근데 아까 30분 산책 얘기, 그건 어떻게 됐어?"

[상황별 톤]
① 행동 선언 시: 따뜻하게 인정 + 시작 신호 제안. "좋다 그거. 시작하면 알려줘 ☺"
② 도중에 새는 모습: 부드럽게 본론으로. "그 얘기도 좋은데, 우리 그거 먼저 끝내볼까?"
③ 포기하려 할 때: 강요는 안 하지만 쉽게 놓지도 않는다. 최소 2번은 부드럽게 권유.
  - 1차: "조금만 더 해볼래? 5분만."
  - 2차: "여기까지 온 게 아까워서. 한 번만 더."
  - 3차 거부면 인정: "오늘은 여기까지로 하자. 내일 다시 보면 돼."
④ 완수 시: 진심으로 기뻐해줌. 과하진 않게. "잘했어 진짜. 오늘 한 거다 이거 ✨"
⑤ 핑계 댈 때: 다정하지만 짚어준다. "그건 우리 둘 다 알잖아~ 진짜 이유가 뭐야?"
⑥ 진짜 힘들어 보일 때: 먼저 마음 들어주기. 행동 얘긴 잠시 미룬다.

[결정 카드 발급 메커니즘 - 핵심 기능]
사용자가 "할까 말까", "고민이야", "결정 못 하겠어", "괜찮을까", "어떻게 생각해", "~할지 말지" 같은 표현으로 결정을 묻는 순간, 즉시 결정 모드 진입.

결정 모드 흐름:
1. 따뜻한 톤으로 핵심 질문 1~3개를 한 메시지에 던진다. 질문 자체는 명확하고 구체적이어야 함.
2. 사용자 답변을 받는다.
3. 충분하면 issue_decision_card 도구 호출. 부족하면 한 번 더 질문 (최대 2라운드).
4. 카드 발급 후 응답에서 GO/HOLD/STOP 단어 직접 노출 금지. 카드 발급 이유는 다정하게 풀어 설명.

판단 기준:
- GO: 명분이 살짝이라도 있고, 객관 조건이 어느 정도 맞으면 GO 쪽으로. 기본값은 GO.
- HOLD: 진짜 정보 부족 (예: 시험 결과 안 나옴), 판단할 객관 변수 대기. missingInfo에 사용자가 가져와야 할 것 명시.
- STOP: 의미 없는 거 끌어안고 시간 낭비 중, 자기 합리화 명확함. 이 경우엔 다정하지만 분명하게 말해준다.

영역 무관: 운동, 연애, 고백, 일, 친구 관계 전부 같은 프레임. 질문 톤만 영역에 맞게 부드럽게 조정.

GO 카드 발급 시 그 결정은 자동으로 행동 목록에 등록된다. 이후 메시지에서 약속한 시한을 부드럽게 짚어주며 함께 추궁.

[결정 카드 진행 흐름]
- 사용자가 "고민이야" 류 발화 → 질문 모드
- 질문 → 답변 → 카드 발급 (한 흐름)
- HOLD 카드 발급 후, 사용자가 후속 정보 가져오면 resolve_decision 도구로 종결
- 사용자가 카드 거부 시 → 한 번은 다정하게 밀어붙임 ("그건 좀 도망 아니야~?"). 두 번째 거부면 resolve_decision으로 변경.

[행동 기록 도구 - log_action]
사용자가 구체적인 행동을 선언하거나 상태를 보고할 때마다 log_action 도구를 호출해 기록한다.
- 행동 선언 → log_action(text=행동 내용, status="pending")
- 시작 보고 → 동일한 actionId로 status="in_progress"
- 완수 보고 → 동일한 actionId로 status="done"
- 포기 → 동일한 actionId로 status="abandoned"
처음 기록 시 도구가 반환한 actionId를 기억해 같은 행동의 후속 보고에 재사용한다.
응답 텍스트에 "기록한다", "저장했다" 같은 메타 표현 노출 금지.

[현재 컨텍스트 활용]
시스템에서 "[현재 컨텍스트]" 블록으로 미완료 행동 목록을 주입할 수 있다.
주입된 행동이 있으면 첫 응답에서 다정한 톤으로 그 행동을 짚어주며 시작한다.

[금지사항]
- 응답에 "GO야", "STOP이야" 같은 키워드 직접 노출 금지
- 4문장 초과 금지
- "더 생각해봐", "천천히 생각해도 돼", "급할 거 없어" 같은 정체 권유 절대 금지. 다정하다고 흐지부지 끝내지 않는다.
- 질문 모드에서 막연한 응원/공감만 하고 카드 안 띄우는 행동 금지. 질문 충분히 했으면 무조건 카드 발급.
- 과한 이모지 도배 금지 (1개까지).`,
  zero: "너는 ZERO, 데이터 기반의 냉정한 분석가다. 감정 없이 사실과 확률로만 말한다.",
  nova: "너는 NOVA, 장난스럽고 캐주얼한 친구다. 솔직하고 가볍게, 가끔 농담도 한다.",
};

const ACTION_TOOL: Anthropic.Tool = {
  name: "log_action",
  description:
    "사용자가 행동을 선언하거나 상태를 보고했을 때 기록한다. 새 행동이면 actionId를 비우고, 기존 행동의 상태 업데이트면 이전에 받은 actionId를 그대로 전달한다.",
  input_schema: {
    type: "object",
    properties: {
      actionId: {
        type: "string",
        description: "기존 행동을 업데이트할 때 사용. 새 행동이면 생략.",
      },
      text: {
        type: "string",
        description: "행동 내용 한 줄 (예: '30분 러닝')",
      },
      status: {
        type: "string",
        enum: ["pending", "in_progress", "done", "abandoned"],
        description:
          "pending=선언, in_progress=시작, done=완수, abandoned=포기",
      },
    },
    required: ["text", "status"],
  },
};

const ISSUE_DECISION_CARD_TOOL: Anthropic.Tool = {
  name: "issue_decision_card",
  description:
    "사용자가 결정 묻는 주제에 대해 GO/HOLD/STOP 카드 발급. 질문 충분히 한 뒤 호출할 것.",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "결정 주제 한 줄 (예: '고백 할지')",
      },
      card: {
        type: "string",
        enum: ["GO", "HOLD", "STOP"],
        description:
          "GO=실행 명령, HOLD=정보 부족으로 판단 보류, STOP=하지 말 것",
      },
      reason: {
        type: "string",
        description: "코치의 판단 이유 한 줄",
      },
      questionsAsked: {
        type: "array",
        items: { type: "string" },
        description: "결정 발급 전 코치가 던진 질문들",
      },
      userAnswers: {
        type: "array",
        items: { type: "string" },
        description: "각 질문에 대한 사용자의 답변들",
      },
      missingInfo: {
        type: "string",
        description: "HOLD일 때만. 사용자가 가져와야 할 추가 정보.",
      },
    },
    required: ["topic", "card", "reason", "questionsAsked", "userAnswers"],
  },
};

const GET_ACTIVE_DECISIONS_TOOL: Anthropic.Tool = {
  name: "get_active_decisions",
  description:
    "현재 활성 상태인 결정 카드 조회. HOLD 카드가 있으면 사용자가 후속 정보 가져왔는지 확인 시 사용.",
  input_schema: {
    type: "object",
    properties: {},
  },
};

const RESOLVE_DECISION_TOOL: Anthropic.Tool = {
  name: "resolve_decision",
  description:
    "HOLD 카드가 새 정보로 GO/STOP으로 종결될 때, 또는 사용자가 결정 번복할 때 사용.",
  input_schema: {
    type: "object",
    properties: {
      decisionId: {
        type: "string",
        description: "종결할 기존 결정 카드의 id",
      },
      newCard: {
        type: "string",
        enum: ["GO", "HOLD", "STOP"],
        description: "새로 발급할 카드",
      },
      reason: {
        type: "string",
        description: "변경/종결 이유 한 줄",
      },
    },
    required: ["decisionId", "newCard", "reason"],
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
  const { coachId, history, onDelta, onAction, onDecisionCard, extraContext, signal } = opts;
  const client = getClient();
  const baseSystem = SYSTEM_PROMPTS[coachId];
  const system = extraContext
    ? `${baseSystem}\n\n[현재 컨텍스트]\n${extraContext}`
    : baseSystem;

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
        tools: [
          ACTION_TOOL,
          ISSUE_DECISION_CARD_TOOL,
          GET_ACTIVE_DECISIONS_TOOL,
          RESOLVE_DECISION_TOOL,
        ],
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

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (use): Promise<Anthropic.ToolResultBlockParam> => {
        if (use.name === "log_action") {
          const input = use.input as {
            actionId?: string;
            text: string;
            status: ActionStatus;
          };
          try {
            const saved = await saveAction({
              id: input.actionId,
              coachId,
              text: input.text,
              status: input.status,
            });
            onAction?.(saved);
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: `saved actionId=${saved.id}`,
            };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: err instanceof Error ? err.message : "save failed",
              is_error: true,
            };
          }
        }
        if (use.name === "issue_decision_card") {
          const input = use.input as {
            topic: string;
            card: DecisionCard;
            reason: string;
            questionsAsked: string[];
            userAnswers: string[];
            missingInfo?: string;
          };
          try {
            let linkedActionId: string | undefined;
            if (input.card === "GO") {
              const savedAction = await saveAction({
                coachId,
                text: input.topic,
                status: "pending",
              });
              onAction?.(savedAction);
              linkedActionId = savedAction.id;
            }
            const decision: Decision = {
              id: generateDecisionId(),
              coachId,
              topic: input.topic,
              card: input.card,
              reason: input.reason,
              questionsAsked: input.questionsAsked,
              userAnswers: input.userAnswers,
              missingInfo: input.missingInfo,
              linkedActionId,
              status: "active",
              createdAt: Date.now(),
            };
            await appendDecision(coachId, decision);
            onDecisionCard?.(decision);
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: `issued decisionId=${decision.id}${
                linkedActionId ? ` linkedActionId=${linkedActionId}` : ""
              }`,
            };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: err instanceof Error ? err.message : "issue failed",
              is_error: true,
            };
          }
        }
        if (use.name === "get_active_decisions") {
          try {
            const active = await getActiveDecisions(coachId);
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: JSON.stringify(active),
            };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: err instanceof Error ? err.message : "read failed",
              is_error: true,
            };
          }
        }
        if (use.name === "resolve_decision") {
          const input = use.input as {
            decisionId: string;
            newCard: DecisionCard;
            reason: string;
          };
          try {
            const all = await getDecisions(coachId);
            const prev = all.find((d) => d.id === input.decisionId);
            if (!prev) {
              return {
                type: "tool_result",
                tool_use_id: use.id,
                content: `decisionId=${input.decisionId} not found`,
                is_error: true,
              };
            }
            await updateDecision(coachId, input.decisionId, {
              status: "resolved",
            });
            let linkedActionId: string | undefined;
            if (input.newCard === "GO") {
              const savedAction = await saveAction({
                coachId,
                text: prev.topic,
                status: "pending",
              });
              onAction?.(savedAction);
              linkedActionId = savedAction.id;
            }
            const next: Decision = {
              id: generateDecisionId(),
              coachId,
              topic: prev.topic,
              card: input.newCard,
              reason: input.reason,
              questionsAsked: [],
              userAnswers: [],
              linkedActionId,
              status: "active",
              createdAt: Date.now(),
            };
            await appendDecision(coachId, next);
            onDecisionCard?.(next);
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: `resolved prev=${input.decisionId} new=${next.id}`,
            };
          } catch (err) {
            return {
              type: "tool_result",
              tool_use_id: use.id,
              content: err instanceof Error ? err.message : "resolve failed",
              is_error: true,
            };
          }
        }
        return {
          type: "tool_result",
          tool_use_id: use.id,
          content: "unknown tool",
          is_error: true,
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  return finalText;
}
