/**
 * GET /api/me
 *
 * Returns the authenticated user's participant profile from the Google Sheet.
 * Returns 404 if the user has not yet submitted a profile.
 * Returns 401 if the user is not signed in.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getParticipantByEmail } from "@/lib/storage";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participant = await getParticipantByEmail(session.user.email);
  if (!participant) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  // Never expose other users' data – this endpoint only returns the calling
  // user's own record.
  return NextResponse.json(participant);
}
