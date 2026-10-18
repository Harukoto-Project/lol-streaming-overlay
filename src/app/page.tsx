import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const OPTIONS = [
  ["region", "JP", "サーバー (JP / KR / NA / EUW / EUNE など)"],
  ["queue", "solo", "solo = ソロランク / flex = フレックス / ranked = 両方"],
  ["games", "5", "表示する試合数 (1〜10)"],
  ["refresh", "60", "更新間隔 (秒, 30〜600)"],
] as const;

const STEPS = [
  "OBS のソースに「ブラウザ」を追加し、URL 欄に上の URL を入力します。",
  "幅 480、高さは「190 + 54 × 試合数」程度に設定します (5 戦表示なら 480 × 460)。",
  "背景は自動で透過されます。カスタム CSS は空にしてください。",
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-14">
        <header className="space-y-3">
          <Badge variant="outline">OBS Browser Source</Badge>
          <h1 className="text-3xl font-bold tracking-tight">LoL Streaming Overlay</h1>
          <p className="leading-relaxed text-muted-foreground">
            直近のランク戦で使ったチャンピオンと戦績を、OBS のブラウザソースに表示します。
            データは OP.GG MCP から取得します。
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>1. URL を作る</CardTitle>
            <CardDescription>
              タグは最後の「-」以降として扱います。空白や日本語を含む名前もそのまま指定できます。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="overflow-x-auto rounded-lg bg-muted px-3 py-2.5 font-mono text-sm">
              {"/overlay/<サモナー名>-<タグ>?region=JP"}
            </pre>
            <p className="text-sm text-muted-foreground">
              例: <Code>/overlay/Hide on bush-KR1?region=KR</Code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. OBS に追加する</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5 text-sm">
              {STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>オプション</CardTitle>
            <CardDescription>URL のクエリパラメータで指定します。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>既定値</TableHead>
                  <TableHead>説明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {OPTIONS.map(([key, value, description]) => (
                  <TableRow key={key}>
                    <TableCell>
                      <Code>{key}</Code>
                    </TableCell>
                    <TableCell>
                      <Code>{value}</Code>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">
                      {description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
