/**
 * DELETE /api/delete-account
 *
 * Deletes the authenticated user's participant profile, all associated photos,
 * and all likes. Signs the session out after successful deletion.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { deleteParticipant } from "@/lib/storage";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteParticipant(session.user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
