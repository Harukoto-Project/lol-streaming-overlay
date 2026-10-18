const BASE_URL = "https://ddragon.leagueoflegends.com";
const LOCALE = "ja_JP";
const TTL_MS = 6 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10_000;

export type ChampionEntry = { id: string; name: string };

export type ChampionCatalog = {
  version: string;
  byKey: Map<number, ChampionEntry>;
};

type Cached = { catalog: ChampionCatalog | null; expiresAt: number };

let cached: Cached | null = null;
let inflight: Promise<ChampionCatalog | null> | null = null;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return response.json();
}

async function load(): Promise<ChampionCatalog> {
  const versions = (await getJson(`${BASE_URL}/api/versions.json`)) as string[];
  const version = versions[0];
  if (!version) throw new Error("No Data Dragon version found");

  const payload = (await getJson(
    `${BASE_URL}/cdn/${version}/data/${LOCALE}/champion.json`,
  )) as { data: Record<string, { id: string; key: string; name: string }> };

  const byKey = new Map<number, ChampionEntry>();
  for (const champion of Object.values(payload.data)) {
    byKey.set(Number(champion.key), { id: champion.id, name: champion.name });
  }
  return { version, byKey };
}

export async function getChampionCatalog(): Promise<ChampionCatalog | null> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.catalog;

  inflight ??= load()
    .then((catalog) => {
      cached = { catalog, expiresAt: Date.now() + TTL_MS };
      return catalog;
    })
    .catch(() => {
      const previous = cached?.catalog ?? null;
      cached = { catalog: previous, expiresAt: Date.now() + RETRY_AFTER_FAILURE_MS };
      return previous;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function resolveChampion(
  catalog: ChampionCatalog | null,
  championId: number | null,
): { name: string | null; imageUrl: string | null } {
  if (!catalog || championId === null) return { name: null, imageUrl: null };
  const entry = catalog.byKey.get(championId);
  if (!entry) return { name: null, imageUrl: null };
  return {
    name: entry.name,
    imageUrl: `${BASE_URL}/cdn/${catalog.version}/img/champion/${entry.id}.png`,
  };
}
