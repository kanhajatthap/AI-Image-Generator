import { NextResponse } from "next/server";
import { QuotaExceededError, quotaExceededMessage } from "./quota";

/** Maps a QuotaExceededError to a 429 with the exact refill date+time. */
export function quotaErrorResponse(err: QuotaExceededError): NextResponse {
  const { kind, resetAtMs, resetLabel } = err.state;
  return NextResponse.json(
    {
      error: quotaExceededMessage(kind, resetLabel),
      details: err.message,
      quotaExceeded: true,
      kind,
      resetAt: new Date(resetAtMs).toISOString(),
      resetLabel,
    },
    { status: 429 },
  );
}