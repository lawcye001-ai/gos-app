import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 1024;

type RequestBody = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  model?: string;
  maxTokens?: number;
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.system || !Array.isArray(body.messages)) {
    return new Response(
      JSON.stringify({ error: "missing system or messages" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const upstream = client.messages.stream(
        {
          model: body.model ?? DEFAULT_MODEL,
          max_tokens: body.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: body.system,
          messages: body.messages,
          tools: body.tools,
        },
        { signal: request.signal },
      );

      const onAbort = () => {
        upstream.abort();
      };
      request.signal.addEventListener("abort", onAbort);

      upstream.on("text", (delta: string) => {
        send("text", { text: delta });
      });

      try {
        const final = await upstream.finalMessage();
        send("done", {
          content: final.content,
          stop_reason: final.stop_reason,
        });
      } catch (err) {
        if (!request.signal.aborted) {
          const message = err instanceof Error ? err.message : "stream failed";
          send("error", { message });
        }
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // controller may already be closed if client disconnected
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
