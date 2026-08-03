import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stateResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Polled by the camp screen, so members see each other's fire and notes. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: true, state: null });
  return stateResponse(user.id);
}
