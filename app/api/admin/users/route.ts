import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { isAdminEmail, parseParticipantAnswers } from "@/lib/admin";
import { getAllParticipants } from "@/lib/storage";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const participants = await getAllParticipants();
  const users = participants
    .map((participant) => {
      const answers = parseParticipantAnswers(participant.answers_json);

      return {
        id: participant.id,
        email: participant.email,
        name: participant.name,
        created_at: participant.created_at,
        age_range: answers?.age_range,
        gender: answers?.gender,
        location: answers?.location,
        interests: answers?.interests ?? [],
        photo_count: answers?.photo_urls?.length ?? 0,
        photo_urls: (answers?.photo_urls ?? []).slice(0, 3),
        quiz_completed: Boolean(participant.quiz_answers_json),
      };
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  return NextResponse.json(users);
}