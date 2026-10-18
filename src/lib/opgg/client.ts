import { parseCompact, type CompactValue } from "./compact";

const ENDPOINT = process.env.OPGG_MCP_ENDPOINT ?? "https://mcp-api.op.gg/mcp";
const PROTOCOL_VERSION = "2025-03-26";
const REQUEST_TIMEOUT_MS = 20_000;

export type OpggErrorCode = "NOT_FOUND" | "UPSTREAM" | "INVALID_RESPONSE";

export class OpggError extends Error {
  constructor(
    readonly code: OpggErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OpggError";
  }
}

type JsonRpcResponse = {
  id?: number | string | null;
  result?: {
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };
  error?: { code: number; message: string };
};

type PostResult = {
  sessionId: string | null;
  message: JsonRpcResponse | null;
};

async function post(
  body: Record<string, unknown>,
  sessionId: string | null,
): Promise<PostResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OpggError(
      "UPSTREAM",
      `OP.GG MCP request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const text = await response.text();
  const nextSessionId = response.headers.get("mcp-session-id") ?? sessionId;

  if (!text.trim()) {
    if (!response.ok) {
      throw new OpggError("UPSTREAM", `OP.GG MCP responded with ${response.status}`);
    }
    return { sessionId: nextSessionId, message: null };
  }

  const message = extractMessage(text, body.id as number | undefined);
  if (!response.ok && !message?.error) {
    throw new OpggError("UPSTREAM", `OP.GG MCP responded with ${response.status}`);
  }
  return { sessionId: nextSessionId, message };
}

function extractMessage(
  text: string,
  requestId: number | undefined,
): JsonRpcResponse | null {
  const candidates: unknown[] = [];

  if (/^\s*(event|data):/m.test(text)) {
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (!data) continue;
      try {
        candidates.push(JSON.parse(data));
      } catch {
        continue;
      }
    }
  } else {
    try {
      candidates.push(JSON.parse(text));
    } catch {
      throw new OpggError("INVALID_RESPONSE", "OP.GG MCP returned non-JSON content");
    }
  }

  const messages = candidates.filter(
    (candidate): candidate is JsonRpcResponse =>
      typeof candidate === "object" && candidate !== null,
  );
  return (
    messages.find((message) => message.id === requestId) ?? messages[0] ?? null
  );
}

export type OpggSession = {
  callTool(name: string, args: Record<string, unknown>): Promise<CompactValue>;
};

export async function withOpggSession<T>(
  run: (session: OpggSession) => Promise<T>,
): Promise<T> {
  let requestId = 0;

  const init = await post(
    {
      jsonrpc: "2.0",
      id: (requestId += 1),
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "lol-streaming-overlay", version: "0.1.0" },
      },
    },
    null,
  );
  if (init.message?.error) {
    throw new OpggError("UPSTREAM", init.message.error.message);
  }

  const sessionId = init.sessionId;
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId);

  const session: OpggSession = {
    async callTool(name, args) {
      const { message } = await post(
        {
          jsonrpc: "2.0",
          id: (requestId += 1),
          method: "tools/call",
          params: { name, arguments: args },
        },
        sessionId,
      );

      if (!message) {
        throw new OpggError("INVALID_RESPONSE", `${name} returned no message`);
      }
      if (message.error) {
        const code = /not found/i.test(message.error.message)
          ? "NOT_FOUND"
          : "UPSTREAM";
        throw new OpggError(code, message.error.message);
      }

      const text = message.result?.content?.find((item) => item.type === "text")?.text;
      if (message.result?.isError) {
        const code = text && /not found/i.test(text) ? "NOT_FOUND" : "UPSTREAM";
        throw new OpggError(code, text ?? `${name} failed`);
      }
      if (!text) {
        throw new OpggError("INVALID_RESPONSE", `${name} returned no content`);
      }

      try {
        return parseCompact(text);
      } catch (error) {
        throw new OpggError(
          "INVALID_RESPONSE",
          `Failed to parse ${name} response: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  };

  try {
    return await run(session);
  } finally {
    if (sessionId) {
      fetch(ENDPOINT, {
        method: "DELETE",
        headers: { "mcp-session-id": sessionId },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    }
  }
}
