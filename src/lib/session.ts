import crypto from "crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import type { SessionData } from "./types";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET.");
  }
  return secret;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(data: SessionData): string {
  const payload = base64UrlEncode(JSON.stringify(data));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function readSessionToken(token?: string | null): SessionData | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    return JSON.parse(base64UrlDecode(payload)) as SessionData;
  } catch {
    return null;
  }
}

export async function setSessionCookie(data: SessionData) {
  const token = createSessionToken(data);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionFromCookies(): Promise<SessionData | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return readSessionToken(token);
}
