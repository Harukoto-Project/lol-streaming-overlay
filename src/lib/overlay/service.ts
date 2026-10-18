import { getChampionCatalog } from "../ddragon";
import { OpggError, withOpggSession } from "../opgg/client";
import type { OverlayRequest } from "./request";
import { buildSnapshot, toOverlayData, type Snapshot } from "./snapshot";
import type { OverlayData } from "./types";

const TTL_MS = Math.max(
  10,
  Number(process.env.OVERLAY_CACHE_TTL_SECONDS ?? 60),
) * 1000;
const STALE_LIMIT_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 200;
const MATCH_FETCH_LIMIT = 20;

const PROFILE_FIELDS = [
  "data.summoner.{game_name,tagline,level,profile_image_url}",
  "data.summoner.league_stats[].{game_type,win,lose}",
  "data.summoner.league_stats[].tier_info.{tier,division,lp,tier_image_url}",
];

const MATCH_FIELDS = [
  "data.game_history[].{id,created_at,game_type,game_length_second}",
  "data.game_history[].participants[].summoner.{game_name,tagline}",
  "data.game_history[].participants[].{champion_id,champion_name,position}",
  "data.game_history[].participants[].stats.{kill,death,assist,minion_kill,neutral_minion_kill,result}",
];

type Target = Pick<OverlayRequest, "name" | "tag" | "region">;

const cache = new Map<string, Snapshot>();
const inflight = new Map<string, Promise<Snapshot>>();

function cacheKey({ name, tag, region }: Target): string {
  return `${region}|${name.toLowerCase()}|${tag.toLowerCase()}`;
}

async function fetchSnapshot(target: Target): Promise<Snapshot> {
  const identity = {
    game_name: target.name,
    tag_line: target.tag,
    region: target.region,
  };

  const [roots, catalog] = await Promise.all([
    withOpggSession((session) =>
      Promise.all([
        session.callTool("lol_get_summoner_profile", {
          ...identity,
          desired_output_fields: PROFILE_FIELDS,
        }),
        session.callTool("lol_list_summoner_matches", {
          ...identity,
          limit: MATCH_FETCH_LIMIT,
          desired_output_fields: MATCH_FIELDS,
        }),
      ]),
    ),
    getChampionCatalog(),
  ]);

  try {
    return buildSnapshot(roots[0], roots[1], catalog, target);
  } catch (error) {
    throw new OpggError(
      "INVALID_RESPONSE",
      error instanceof Error ? error.message : "Unexpected response shape",
    );
  }
}

function remember(key: string, snapshot: Snapshot): void {
  cache.delete(key);
  cache.set(key, snapshot);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

async function getSnapshot(
  target: Target,
): Promise<{ snapshot: Snapshot; stale: boolean }> {
  const key = cacheKey(target);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return { snapshot: cached, stale: false };
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = fetchSnapshot(target)
      .then((snapshot) => {
        remember(key, snapshot);
        return snapshot;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, pending);
  }

  try {
    return { snapshot: await pending, stale: false };
  } catch (error) {
    const recoverable =
      cached &&
      Date.now() - cached.fetchedAt < STALE_LIMIT_MS &&
      !(error instanceof OpggError && error.code === "NOT_FOUND");
    if (recoverable) return { snapshot: cached, stale: true };
    throw error;
  }
}

export async function getOverlayData(request: OverlayRequest): Promise<OverlayData> {
  const { snapshot, stale } = await getSnapshot(request);
  return toOverlayData(snapshot, request, stale);
}
