# LoL Streaming Overlay

OBSのブラウザソースで使える、League of Legends の戦績オーバーレイです。
直近のランク戦で使ったチャンピオンと戦績(KDA / CS / 勝敗)、現在のランクを表示します。

データは [OP.GG MCP](https://github.com/opgginc/opgg-mcp) (`lol_get_summoner_profile` / `lol_list_summoner_matches`) から取得し、チャンピオン画像と日本語名は Riot の Data Dragon を使っています。

## 使い方

```bash
npm install
npm run dev      # 開発
npm run build && npm start   # 本番
```

OBS のブラウザソースに次のURLを設定します。

```
http://localhost:3000/overlay/<サモナー名>-<タグ>?region=JP
```

- 例: `http://localhost:3000/overlay/Hide on bush-KR1?region=KR`
- タグは最後の `-` 以降として扱います。サモナー名に `-`・空白・日本語が含まれていても指定できます。
- 背景は透過です。OBS側のカスタムCSSは空にしてください。
- サイズの目安は 幅 480 / 高さ `190 + 54 × 試合数` です(5戦なら 480 × 460)。

### クエリパラメータ

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `region` | `JP` | サーバー (`JP` / `KR` / `NA` / `EUW` / `EUNE` など) |
| `queue` | `solo` | `solo` ソロランク / `flex` フレックス / `ranked` 両方 |
| `games` | `5` | 表示する試合数 (1〜10) |
| `refresh` | `60` | 更新間隔(秒, 30〜600) |

### 環境変数

| 名前 | 既定値 | 説明 |
| --- | --- | --- |
| `DEFAULT_REGION` | `JP` | `region` を省略したときのサーバー |
| `OVERLAY_CACHE_TTL_SECONDS` | `60` | OP.GG への問い合わせ結果をキャッシュする秒数 (最小 10) |
| `OPGG_MCP_ENDPOINT` | `https://mcp-api.op.gg/mcp` | MCPエンドポイント |

## 構成

- `src/app/overlay/[slug]` — オーバーレイ画面 (クライアントで定期更新)
- `src/app/api/overlay/[slug]` — 整形済みデータを返すAPI
- `src/lib/opgg` — OP.GG MCP クライアントと、独自レスポンス形式のパーサー
- `src/lib/overlay` — データ整形とサーバー側キャッシュ

OP.GG MCP のレスポンスは JSON ではなく、`class X: a,b,c` のスキーマ行と `X(値, ...)` の位置引数で構成された独自形式です。`src/lib/opgg/compact.ts` で解釈しています。

取得結果はサーバー内でキャッシュし、同じサモナーへの同時リクエストは1回にまとめます。OP.GG に一時的に繋がらない場合は、30分以内の古いデータを表示し続けます。

## テスト

```bash
npm test
```
