import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LoL Streaming Overlay",
  description: "OBSのブラウザソース向け League of Legends 戦績オーバーレイ",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="dark">
      <body>{children}</body>
    </html>
  );
}
