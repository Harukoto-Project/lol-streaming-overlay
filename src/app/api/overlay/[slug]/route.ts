import type { NextRequest } from "next/server";
import { OpggError } from "@/lib/opgg/client";
import { parseOverlayRequest } from "@/lib/overlay/request";
import { getOverlayData } from "@/lib/overlay/service";
import type { OverlayErrorBody } from "@/lib/overlay/types";

const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(body: OverlayErrorBody, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const parsed = parseOverlayRequest(slug, request.nextUrl.searchParams);

  if (!parsed.ok) {
    return errorResponse({ error: "BAD_REQUEST", message: parsed.message }, 400);
  }

  try {
    const data = await getOverlayData(parsed.value);
    return Response.json(data, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof OpggError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "UPSTREAM" ? 502 : 500;
      return errorResponse({ error: error.code, message: error.message }, status);
    }
    console.error("overlay: unexpected error", error);
    return errorResponse(
      { error: "UPSTREAM", message: "Unexpected error while loading overlay data" },
      500,
    );
  }
}
