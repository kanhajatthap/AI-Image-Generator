import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../../lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne<{ _id: unknown; name: string; email: string; passwordHash: string }>({ email });

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const userId = String(user._id);
    const sessionToken = await createSessionToken({
      userId,
      email: user.email,
      name: user.name || "User",
    });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json(
      { message: "Login successful.", user: { name: user.name || "User", email: user.email } },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to login.", details: String(error) },
      { status: 500 },
    );
  }
}
