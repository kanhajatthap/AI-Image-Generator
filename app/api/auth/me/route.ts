import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = await verifySessionToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json(
    {
      user: {
        userId: payload.userId,
        name: payload.name,
        email: payload.email,
      },
    },
    { status: 200 },
  );
}
