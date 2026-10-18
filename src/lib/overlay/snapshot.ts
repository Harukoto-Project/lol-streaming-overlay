import type { CompactValue } from "../opgg/compact";
import { resolveChampion, type ChampionCatalog } from "../ddragon";
import type {
  MatchResult,
  OverlayData,
  OverlayMatch,
  OverlayRank,
  QueueFilter,
} from "./types";

type Rec = { [key: string]: CompactValue };
type QueueKey = "SOLO" | "FLEX";

export type Snapshot = {
  summoner: OverlayData["summoner"];
  ranks: Partial<Record<QueueKey, OverlayRank>>;
  matches: OverlayMatch[];
  fetchedAt: number;
};

const QUEUE_BY_GAME_TYPE: Record<string, QueueKey> = {
  SOLORANKED: "SOLO",
  FLEXRANKED: "FLEX",
};

const ROMAN = ["", "I", "II", "III", "IV", "V"];
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

function rec(value: CompactValue | undefined): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

function list(value: CompactValue | undefined): CompactValue[] {
  return Array.isArray(value) ? value : [];
}

function str(value: CompactValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: CompactValue | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function sameRiotId(
  summoner: Rec | null,
  name: string,
  tag: string,
): boolean {
  return (
    str(summoner?.game_name)?.toLowerCase() === name.toLowerCase() &&
    str(summoner?.tagline)?.toLowerCase() === tag.toLowerCase()
  );
}

export function buildSnapshot(
  profileRoot: CompactValue,
  matchesRoot: CompactValue,
  catalog: ChampionCatalog | null,
  requested: { name: string; tag: string },
): Snapshot {
  const summoner = rec(rec(rec(profileRoot)?.data)?.summoner);
  if (!summoner) {
    throw new Error("Profile response has no summoner");
  }

  const name = str(summoner.game_name) ?? requested.name;
  const tag = str(summoner.tagline) ?? requested.tag;

  const ranks: Snapshot["ranks"] = {};
  for (const entry of list(summoner.league_stats)) {
    const stat = rec(entry);
    const queue = QUEUE_BY_GAME_TYPE[str(stat?.game_type) ?? ""];
    if (!stat || !queue) continue;
    ranks[queue] = buildRank(queue, stat);
  }

  const matches: OverlayMatch[] = [];
  for (const entry of list(rec(rec(matchesRoot)?.data)?.game_history)) {
    const game = rec(entry);
    if (!game) continue;
    const match = buildMatch(game, name, tag, catalog);
    if (match) matches.push(match);
  }
  matches.sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt));

  return {
    summoner: {
      name,
      tag,
      level: num(summoner.level),
      iconUrl: str(summoner.profile_image_url),
    },
    ranks,
    matches,
    fetchedAt: Date.now(),
  };
}

function buildRank(queue: QueueKey, stat: Rec): OverlayRank {
  const tierInfo = rec(stat.tier_info);
  const tier = str(tierInfo?.tier);
  const division = num(tierInfo?.division);
  const wins = num(stat.win) ?? 0;
  const losses = num(stat.lose) ?? 0;
  const total = wins + losses;

  return {
    queue,
    tier: tier ?? "UNRANKED",
    division:
      tier && !APEX_TIERS.has(tier) && division !== null
        ? (ROMAN[division] ?? String(division))
        : null,
    lp: tier ? num(tierInfo?.lp) : null,
    wins,
    losses,
    winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : null,
    emblemUrl: str(tierInfo?.tier_image_url),
  };
}

function buildMatch(
  game: Rec,
  name: string,
  tag: string,
  catalog: ChampionCatalog | null,
): OverlayMatch | null {
  const queue = QUEUE_BY_GAME_TYPE[str(game.game_type) ?? ""];
  const id = str(game.id);
  const playedAt = str(game.created_at);
  if (!queue || !id || !playedAt) return null;

  const participants = list(game.participants).map(rec);
  const target =
    participants.find((participant) =>
      sameRiotId(rec(participant?.summoner), name, tag),
    ) ?? participants[0];
  if (!target) return null;

  const stats = rec(target.stats);
  const championId = num(target.champion_id);
  const resolved = resolveChampion(catalog, championId);
  const durationSeconds = num(game.game_length_second) ?? 0;

  return {
    id,
    queue,
    championId,
    championName: resolved.name ?? str(target.champion_name) ?? "?",
    championImageUrl: resolved.imageUrl,
    position: str(target.position),
    kills: num(stats?.kill) ?? 0,
    deaths: num(stats?.death) ?? 0,
    assists: num(stats?.assist) ?? 0,
    cs: (num(stats?.minion_kill) ?? 0) + (num(stats?.neutral_minion_kill) ?? 0),
    result: toResult(str(stats?.result), durationSeconds),
    durationSeconds,
    playedAt,
  };
}

function toResult(raw: string | null, durationSeconds: number): MatchResult {
  if (raw === "WIN" || raw === "LOSE") {
    return durationSeconds > 0 && durationSeconds < 300 ? "REMAKE" : raw;
  }
  return "REMAKE";
}

export function toOverlayData(
  snapshot: Snapshot,
  options: { region: string; queue: QueueFilter; games: number },
  stale: boolean,
): OverlayData {
  const { queue, games } = options;

  const matches = snapshot.matches
    .filter((match) =>
      queue === "ranked" ? true : match.queue === (queue === "solo" ? "SOLO" : "FLEX"),
    )
    .slice(0, games);

  const rank =
    queue === "solo"
      ? (snapshot.ranks.SOLO ?? null)
      : queue === "flex"
        ? (snapshot.ranks.FLEX ?? null)
        : (snapshot.ranks.SOLO ?? snapshot.ranks.FLEX ?? null);

  const counted = matches.filter((match) => match.result !== "REMAKE");
  const wins = counted.filter((match) => match.result === "WIN").length;
  const totals = matches.reduce(
    (sum, match) => ({
      kills: sum.kills + match.kills,
      deaths: sum.deaths + match.deaths,
      assists: sum.assists + match.assists,
    }),
    { kills: 0, deaths: 0, assists: 0 },
  );

  return {
    summoner: snapshot.summoner,
    region: options.region,
    queue,
    rank,
    matches,
    recent: {
      games: matches.length,
      wins,
      losses: counted.length - wins,
      kda:
        matches.length > 0
          ? Math.round(
              ((totals.kills + totals.assists) / Math.max(1, totals.deaths)) * 100,
            ) / 100
          : null,
    },
    fetchedAt: new Date(snapshot.fetchedAt).toISOString(),
    stale,
  };
}
