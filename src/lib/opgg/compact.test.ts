import { describe, expect, it } from "vitest";
import { CompactParseError, parseCompact, type CompactValue } from "./compact";

const PROFILE = `class LolGetSummonerProfile: data
class Data: summoner
class Summoner: game_name,tagline,region,profile_image_url,level,league_stats,ranked_most_champions
class LeagueStat: game_type,tier_info,win,lose
class TierInfo: tier,division,lp,tier_image_url,border_image_url
class RankedMostChampions: my_champion_stats
class MyChampionStat: id,play,win,lose,champion_name

LolGetSummonerProfile(Data(Summoner("Hide on bush","KR1",null,"https://example.com/icon.jpg",946,[LeagueStat("SOLORANKED",TierInfo("CHALLENGER",1,2256,"https://example.com/c.png","https://example.com/b.png"),448,371),LeagueStat("FLEXRANKED",TierInfo(null,null,null,"https://example.com/u.svg",null),null,null)],RankedMostChampions([MyChampionStat(777,63,31,32,"Yone")]))))`;

const MATCHES = `class LolListSummonerMatches: data
class Data: game_history
class GameHistory: id,created_at,game_type,game_length_second,participants
class Participant: summoner,champion_id,champion_name,team_key,position,stats
class Summoner: puuid,game_name,tagline
class Stats: kill,death,assist,minion_kill,result,op_score,op_score_rank

LolListSummonerMatches(Data([GameHistory("m_abc-PJl0=","2026-10-17T01:53:14+09:00","SOLORANKED",1011,[Participant(Summoner("XbXY","Hide on bush","KR1"),3,"Galio","RED","MID",Stats(7,4,6,123,"WIN",6.93,4))])]))`;

function at(root: CompactValue, path: string): CompactValue | undefined {
  let current: CompactValue | undefined = root;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = Array.isArray(current)
      ? current[Number(key)]
      : (current as { [key: string]: CompactValue })[key];
  }
  return current;
}

describe("parseCompact", () => {
  it("maps positional arguments to the declared schema", () => {
    const root = parseCompact(PROFILE);

    expect(at(root, "data.summoner.game_name")).toBe("Hide on bush");
    expect(at(root, "data.summoner.tagline")).toBe("KR1");
    expect(at(root, "data.summoner.region")).toBeNull();
    expect(at(root, "data.summoner.level")).toBe(946);
    expect(at(root, "data.summoner.league_stats.0")).toEqual({
      game_type: "SOLORANKED",
      tier_info: {
        tier: "CHALLENGER",
        division: 1,
        lp: 2256,
        tier_image_url: "https://example.com/c.png",
        border_image_url: "https://example.com/b.png",
      },
      win: 448,
      lose: 371,
    });
    expect(at(root, "data.summoner.league_stats.1.tier_info.tier")).toBeNull();
    expect(
      at(root, "data.summoner.ranked_most_champions.my_champion_stats.0.champion_name"),
    ).toBe("Yone");
  });

  it("parses match history with floats, ids containing symbols and nested lists", () => {
    const root = parseCompact(MATCHES);

    expect(at(root, "data.game_history.0.id")).toBe("m_abc-PJl0=");
    expect(at(root, "data.game_history.0.game_length_second")).toBe(1011);
    expect(at(root, "data.game_history.0.participants.0.summoner.game_name")).toBe(
      "Hide on bush",
    );
    expect(at(root, "data.game_history.0.participants.0.stats")).toEqual({
      kill: 7,
      death: 4,
      assist: 6,
      minion_kill: 123,
      result: "WIN",
      op_score: 6.93,
      op_score_rank: 4,
    });
  });

  it("keeps commas, parentheses, brackets and escaped quotes inside strings", () => {
    const root = parseCompact(`class Root: items
class Item: name,note

Root([Item("a, b (c) [d]","say \\"hi\\""),Item("日本語",null)])`);

    expect(at(root, "items.0")).toEqual({ name: "a, b (c) [d]", note: 'say "hi"' });
    expect(at(root, "items.1")).toEqual({ name: "日本語", note: null });
  });

  it("handles empty lists, booleans and negative numbers", () => {
    expect(
      parseCompact(`class Root: list,flag,delta

Root([],true,-3.5)`),
    ).toEqual({ list: [], flag: true, delta: -3.5 });
  });

  it("falls back to an array when a class has no schema", () => {
    expect(parseCompact(`Unknown(1,"x")`)).toEqual([1, "x"]);
  });

  it("throws on malformed input", () => {
    expect(() => parseCompact("")).toThrow(CompactParseError);
    expect(() => parseCompact(`class A: x\n\nA("unterminated)`)).toThrow(CompactParseError);
    expect(() => parseCompact(`class A: x\n\nA(1`)).toThrow(CompactParseError);
  });
});
