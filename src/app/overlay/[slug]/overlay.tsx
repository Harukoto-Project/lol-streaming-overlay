"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  MatchResult,
  OverlayData,
  OverlayErrorBody,
  OverlayMatch,
  OverlayRank,
  QueueFilter,
} from "@/lib/overlay/types";
import { OverlayAlert } from "./overlay-alert";

type Props = {
  name: string;
  tag: string;
  region: string;
  queue: QueueFilter;
  games: number;
  refreshSeconds: number;
};

type LoadError = {
  error: OverlayErrorBody["error"] | "NETWORK";
  message: string;
};

const QUEUE_LABELS: Record<QueueFilter, string> = {
  solo: "Ranked Solo",
  flex: "Ranked Flex",
  ranked: "Ranked",
};

const RESULT_STYLES: Record<
  MatchResult,
  { label: string; edge: string; text: string; block: string }
> = {
  WIN: { label: "勝利", edge: "border-win", text: "text-win", block: "bg-win" },
  LOSE: {
    label: "敗北",
    edge: "border-loss",
    text: "text-loss",
    block: "bg-loss",
  },
  REMAKE: {
    label: "中断",
    edge: "border-muted-foreground/50",
    text: "text-muted-foreground",
    block: "bg-muted-foreground/50",
  },
};

const ROLE_LABELS: Record<string, string> = {
  TOP: "TOP",
  JUNGLE: "JG",
  MID: "MID",
  ADC: "BOT",
  SUPPORT: "SUP",
};

const LABEL =
  "text-[11px] font-medium uppercase tracking-widest text-muted-foreground";

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function formatRelative(playedAt: string, now: number): string {
  const diffMinutes = Math.max(
    0,
    Math.floor((now - Date.parse(playedAt)) / 60_000),
  );
  if (diffMinutes < 1) return "たった今";
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function Overlay({
  name,
  tag,
  region,
  queue,
  games,
  refreshSeconds,
}: Props) {
  const [data, setData] = useState<OverlayData | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const now = useNow(30_000);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ region, queue, games: String(games) });
    const url = `/api/overlay/${encodeURIComponent(`${name}-${tag}`)}?${query}`;

    async function load() {
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as OverlayData | OverlayErrorBody;
        if (!response.ok) {
          setError(body as OverlayErrorBody);
          return;
        }
        setData(body as OverlayData);
        setError(null);
        setLoadedAt(Date.now());
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError({
          error: "NETWORK",
          message:
            cause instanceof Error ? cause.message : "通信に失敗しました",
        });
      }
    }

    void load();
    const timer = setInterval(() => void load(), refreshSeconds * 1000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [name, tag, region, queue, games, refreshSeconds]);

  if (!data) {
    return error ? (
      <OverlayAlert title="オーバーレイを表示できません">
        {describeError(error, region)}
      </OverlayAlert>
    ) : null;
  }

  const reference = Math.max(now, loadedAt);

  return (
    <main data-overlay className="w-full max-w-[480px] p-2">
      <Card
        className={cn(
          "gap-0 rounded-md bg-card/95 py-0 shadow-none ring-border",
          data.stale && "opacity-80",
        )}
      >
        <Header data={data} />
        <Separator />
        {/* {data.recent.games > 0 ? (
          <>
            <Summary data={data} />
            <Separator />
            <ul>
              {data.matches.map((match) => (
                <MatchRow key={match.id} match={match} now={reference} />
              ))}
            </ul>
          </>
        ) : (
          <p className="px-4 py-5 text-center text-sm text-muted-foreground">
            直近のランク戦の記録がありません
          </p>
        )} */}
      </Card>
    </main>
  );
}

function describeError(error: LoadError, region: string): string {
  switch (error.error) {
    case "NOT_FOUND":
      return `サモナーが見つかりません。サモナー名・タグ・region (現在: ${region}) を確認してください。`;
    case "BAD_REQUEST":
      return error.message;
    case "NETWORK":
      return "サーバーに接続できません。しばらくして再度お試しください。";
    default:
      return "OP.GG からデータを取得できませんでした。しばらくして再度お試しください。";
  }
}

function Header({ data }: { data: OverlayData }) {
  const { summoner, rank } = data;

  return (
    <CardContent className="flex items-center gap-4 py-4">
      {rank?.emblemUrl ? (
        <Image
          className="size-16 shrink-0"
          src={rank.emblemUrl}
          alt={rank.tier}
          width={64}
          height={64}
          unoptimized
          priority
        />
      ) : (
        <div className="size-16 shrink-0 rounded-md bg-muted" />
      )}

      <div className="min-w-0 flex-1 space-y-2">
        <CardTitle className="truncate text-base font-semibold">
          {summoner.name}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">
            #{summoner.tag}
          </span>
        </CardTitle>
        {rank ? <RankBlock rank={rank} queue={data.queue} /> : null}
      </div>
    </CardContent>
  );
}

function RankBlock({ rank, queue }: { rank: OverlayRank; queue: QueueFilter }) {
  const label =
    queue === "ranked"
      ? QUEUE_LABELS[rank.queue === "SOLO" ? "solo" : "flex"]
      : QUEUE_LABELS[queue];
  const hasGames = rank.wins + rank.losses > 0;

  return (
    <>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl leading-none font-semibold tracking-tight">
          {rank.tier}
          {rank.division ? ` ${rank.division}` : ""}
        </span>
        {rank.lp !== null ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {rank.lp} LP
          </span>
        ) : null}
      </div>

      {rank.winRate !== null ? (
        <Progress
          value={rank.winRate}
          className="gap-0 **:data-[slot=progress-indicator]:bg-foreground/80 **:data-[slot=progress-track]:h-0.5"
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {hasGames ? (
            <>
              <span className="text-win">{rank.wins}勝</span>{" "}
              <span className="text-loss">{rank.losses}敗</span>
              {rank.winRate !== null ? (
                <span className="ml-1.5 text-muted-foreground">{rank.winRate}%</span>
              ) : null}
            </>
          ) : (
            "-"
          )}
        </span>
      </div>
    </>
  );
}

function Summary({ data }: { data: OverlayData }) {
  const { recent, matches } = data;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className={LABEL}>直近{recent.games}戦</span>
      <span className="text-xs tabular-nums">
        <span className="text-win">{recent.wins}勝</span>
        <span className="mx-1 text-muted-foreground">/</span>
        <span className="text-loss">{recent.losses}敗</span>
      </span>
      <span className="flex flex-1 items-center gap-0.5" aria-hidden>
        {matches.map((match) => (
          <span
            key={match.id}
            className={cn(
              "h-2 w-1 rounded-[1px]",
              RESULT_STYLES[match.result].block,
            )}
          />
        ))}
      </span>
      {recent.kda !== null ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          KDA <span className="text-foreground">{recent.kda.toFixed(2)}</span>
        </span>
      ) : null}
    </div>
  );
}

function MatchRow({ match, now }: { match: OverlayMatch; now: number }) {
  const style = RESULT_STYLES[match.result];
  const ratio =
    match.deaths === 0
      ? null
      : ((match.kills + match.assists) / match.deaths).toFixed(2);
  const role = match.position
    ? (ROLE_LABELS[match.position] ?? match.position)
    : null;
  const meta = [
    role,
    formatDuration(match.durationSeconds),
    now > 0 ? formatRelative(match.playedAt, now) : null,
  ]
    .filter(Boolean)
    .join(" ・ ");

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-l-2 py-2 pr-4 pl-3.5 not-last:border-b not-last:border-b-border/60",
        style.edge,
      )}
    >
      <Avatar className="size-10 rounded-md after:rounded-md">
        {match.championImageUrl ? (
          <AvatarImage
            src={match.championImageUrl}
            alt={match.championName}
            className="rounded-md"
          />
        ) : null}
        <AvatarFallback className="rounded-md font-semibold">
          {match.championName.slice(0, 1)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{match.championName}</div>
        <div className="truncate text-xs text-muted-foreground">{meta}</div>
      </div>

      <div className="text-right tabular-nums">
        <div className="text-sm font-medium">
          {match.kills} / <span className="text-loss">{match.deaths}</span> /{" "}
          {match.assists}
        </div>
        <div className="text-xs text-muted-foreground">
          {ratio === null ? "Perfect" : `${ratio} KDA`}
          {" ・ "}
          {match.cs} CS
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn(
          "w-11 shrink-0 rounded-sm border-0 px-0 text-xs font-semibold",
          style.text,
        )}
      >
        {style.label}
      </Badge>
    </li>
  );
}
