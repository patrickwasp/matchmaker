import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getAllLikes, getParticipantByEmail, getParticipantById, upsertLike } from "@/lib/storage";
import type { ParticipantAnswers } from "@/types";

const LikePayloadSchema = z.object({
  targetParticipantId: z.string().min(1),
  liked: z.boolean(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LikePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const me = await getParticipantByEmail(session.user.email);
  if (!me) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (parsed.data.targetParticipantId === me.id) {
    return NextResponse.json({ error: "You cannot like yourself" }, { status: 422 });
  }

  const target = await getParticipantById(parsed.data.targetParticipantId);
  if (!target) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  await upsertLike(me.id, parsed.data.targetParticipantId, parsed.data.liked);
  const allLikes = await getAllLikes();
  const reciprocalLike = allLikes.find(
    (like) =>
      like.liker_id === parsed.data.targetParticipantId &&
      like.liked_id === me.id &&
      like.liked
  );

  let phoneNumber: string | undefined;
  if (parsed.data.liked && reciprocalLike) {
    try {
      const targetAnswers = JSON.parse(target.answers_json) as ParticipantAnswers;
      phoneNumber = targetAnswers.phone_number;
    } catch {
      phoneNumber = undefined;
    }
  }

  return NextResponse.json({
    ok: true,
    mutualMatch: parsed.data.liked && Boolean(reciprocalLike),
    phoneNumber,
  });
}