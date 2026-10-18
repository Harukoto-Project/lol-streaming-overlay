export type QueueFilter = "solo" | "flex" | "ranked";

export type MatchResult = "WIN" | "LOSE" | "REMAKE";

export type OverlayRank = {
  queue: "SOLO" | "FLEX";
  tier: string;
  division: string | null;
  lp: number | null;
  wins: number;
  losses: number;
  winRate: number | null;
  emblemUrl: string | null;
};

export type OverlayMatch = {
  id: string;
  queue: "SOLO" | "FLEX";
  championId: number | null;
  championName: string;
  championImageUrl: string | null;
  position: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  result: MatchResult;
  durationSeconds: number;
  playedAt: string;
};

export type OverlayData = {
  summoner: {
    name: string;
    tag: string;
    level: number | null;
    iconUrl: string | null;
  };
  region: string;
  queue: QueueFilter;
  rank: OverlayRank | null;
  matches: OverlayMatch[];
  recent: {
    games: number;
    wins: number;
    losses: number;
    kda: number | null;
  };
  fetchedAt: string;
  stale: boolean;
};

export type OverlayErrorBody = {
  error: "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM" | "INVALID_RESPONSE";
  message: string;
};
