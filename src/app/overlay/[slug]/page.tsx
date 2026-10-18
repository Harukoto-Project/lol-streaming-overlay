import type { Metadata } from "next";
import { Suspense } from "react";
import { parseOverlayRequest, toSearchParams } from "@/lib/overlay/request";
import { Overlay } from "./overlay";
import { OverlayAlert } from "./overlay-alert";

export const metadata: Metadata = {
  title: "LoL Overlay",
};

export default function Page({
  params,
  searchParams,
}: PageProps<"/overlay/[slug]">) {
  return (
    <Suspense fallback={null}>
      <OverlayLoader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OverlayLoader({
  params,
  searchParams,
}: Pick<PageProps<"/overlay/[slug]">, "params" | "searchParams">) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const parsed = parseOverlayRequest(slug, toSearchParams(search));

  if (!parsed.ok) {
    return <OverlayAlert title="URLが正しくありません">{parsed.message}</OverlayAlert>;
  }

  return <Overlay {...parsed.value} />;
}
