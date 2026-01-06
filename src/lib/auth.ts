import { NextResponse } from "next/server";
import { getSessionFromCookies } from "./session";

export async function requireAdmin() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireUser() {
  const session = await getSessionFromCookies();
  if (!session || session.role !== "user" || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
