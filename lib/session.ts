import { JWTPayload, jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "session";

export type SessionPayload = JWTPayload & {
  userId: string;
  email: string;
  name: string;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET in environment variables.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string) {
  try {
    const verified = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    return verified.payload as SessionPayload;
  } catch {
    return null;
  }
}
