import type { QueueFilter } from "./types";

export const DEFAULT_REGION = (process.env.DEFAULT_REGION ?? "JP").toUpperCase();

const DEFAULT_GAMES = 5;
const MAX_GAMES = 10;
const DEFAULT_REFRESH_SECONDS = 60;
const MIN_REFRESH_SECONDS = 30;
const MAX_REFRESH_SECONDS = 600;
const MAX_NAME_LENGTH = 32;
const MAX_TAG_LENGTH = 8;

export type OverlayRequest = {
  name: string;
  tag: string;
  region: string;
  queue: QueueFilter;
  games: number;
  refreshSeconds: number;
};

export type ParseResult =
  | { ok: true; value: OverlayRequest }
  | { ok: false; message: string };

type SearchParamsLike = Pick<URLSearchParams, "get">;

type RawSearchParams = Record<string, string | string[] | undefined>;

export function toSearchParams(raw: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return params;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseQueue(raw: string | null): QueueFilter {
  switch (raw?.toLowerCase()) {
    case "flex":
      return "flex";
    case "ranked":
    case "all":
      return "ranked";
    default:
      return "solo";
  }
}

export function parseOverlayRequest(
  slug: string,
  search: SearchParamsLike,
): ParseResult {
  const decoded = safeDecode(slug).trim();
  const separator = decoded.lastIndexOf("-");

  if (separator <= 0 || separator === decoded.length - 1) {
    return {
      ok: false,
      message: "URLは /overlay/サモナー名-タグ の形式で指定してください (例: /overlay/Hide on bush-KR1)",
    };
  }

  const name = decoded.slice(0, separator).trim();
  const tag = decoded.slice(separator + 1).trim().replace(/^#/, "");

  if (!name || !tag) {
    return { ok: false, message: "サモナー名とタグを指定してください" };
  }
  if (name.length > MAX_NAME_LENGTH || tag.length > MAX_TAG_LENGTH) {
    return { ok: false, message: "サモナー名またはタグが長すぎます" };
  }

  const region = (search.get("region") ?? DEFAULT_REGION).trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(region)) {
    return { ok: false, message: "region の指定が不正です (例: JP, KR, NA, EUW)" };
  }

  return {
    ok: true,
    value: {
      name,
      tag,
      region,
      queue: parseQueue(search.get("queue")),
      games: clampInt(search.get("games"), DEFAULT_GAMES, 1, MAX_GAMES),
      refreshSeconds: clampInt(
        search.get("refresh"),
        DEFAULT_REFRESH_SECONDS,
        MIN_REFRESH_SECONDS,
        MAX_REFRESH_SECONDS,
      ),
    },
  };
}
