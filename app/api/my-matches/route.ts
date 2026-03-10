/**
 * GET /api/my-matches
 *
 * Returns matches involving the authenticated user, enriched with their
 * partner's public profile data (name, interests, looking_for, etc.).
 *
 * Users can ONLY see their own matches – they cannot access other users'
 * data through this endpoint.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { normalizeQuizAnswers } from "@/lib/quiz";
import {
  getAllLikes,
  getAllParticipants,
  getParticipantByEmail,
} from "@/lib/googleSheets";
import { computeScore } from "@/utils/matching";
import type { MatchWithPartner, ParticipantAnswers } from "@/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Resolve the caller's participant record
  const me = await getParticipantByEmail(session.user.email);
  if (!me) {
    return NextResponse.json(
      { error: "Profile not found – please submit your profile first" },
      { status: 404 }
    );
  }

  let myAnswers: ParticipantAnswers;
  try {
    myAnswers = JSON.parse(me.answers_json) as ParticipantAnswers;
  } catch {
    return NextResponse.json({ error: "Profile data is invalid." }, { status: 500 });
  }

  const myQuizAnswers = normalizeQuizAnswers(
    me.quiz_answers_json ? JSON.parse(me.quiz_answers_json) : undefined
  );

  const [participants, likes] = await Promise.all([
    getAllParticipants(),
    getAllLikes(),
  ]);

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const likedByMe = new Map(
    likes
      .filter((like) => like.liker_id === me.id && like.liked)
      .map((like) => [like.liked_id, like.updated_at])
  );
  const likedYou = new Map(
    likes
      .filter((like) => like.liked_id === me.id && like.liked)
      .map((like) => [like.liker_id, like.updated_at])
  );

  const mutualPartnerIds = Array.from(likedByMe.keys()).filter((partnerId) => likedYou.has(partnerId));
  if (mutualPartnerIds.length === 0) {
    return NextResponse.json([]);
  }

  const enriched: MatchWithPartner[] = [];

  for (const partnerId of mutualPartnerIds) {
    const partner = participantById.get(partnerId);
    if (!partner) continue;

    let partnerAnswers: ParticipantAnswers;
    try {
      partnerAnswers = JSON.parse(partner.answers_json);
    } catch {
      continue;
    }

    const partnerQuizAnswers = normalizeQuizAnswers(
      partner.quiz_answers_json ? JSON.parse(partner.quiz_answers_json) : undefined
    );

    const revealedAt = [likedByMe.get(partnerId), likedYou.get(partnerId)]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? new Date().toISOString();

    enriched.push({
      match_id: [me.id, partnerId].sort().join(":"),
      score: computeScore(myAnswers, partnerAnswers, myQuizAnswers, partnerQuizAnswers),
      revealed_at: revealedAt,
      partner: {
        id: partner.id,
        name: partnerAnswers.name,
        interests: partnerAnswers.interests,
        age_range: partnerAnswers.age_range,
        bio: partnerAnswers.bio,
        location: partnerAnswers.location,
        photo_data_url: partnerAnswers.photo_data_url,
        photo_urls: partnerAnswers.photo_urls,
        phone_number: partnerAnswers.phone_number,
      },
    });
  }

  enriched.sort((left, right) => right.score - left.score || left.partner.name.localeCompare(right.partner.name));

  return NextResponse.json(enriched);
}
