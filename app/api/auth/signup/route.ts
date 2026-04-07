import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../../../lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });

    const exists = await users.findOne({ email });
    if (exists) {
      return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await users.insertOne({
      name,
      email,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const userId = (inserted.insertedId as ObjectId).toHexString();
    const sessionToken = await createSessionToken({ userId, email, name });
    const cookieStore = await cookies();

    cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({ message: "Signup successful.", user: { name, email } }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create account.", details: String(error) },
      { status: 500 },
    );
  }
}
