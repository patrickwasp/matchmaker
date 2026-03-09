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
import {
  getParticipantByEmail,
  getMatchesForParticipant,
  getParticipantById,
} from "@/lib/googleSheets";
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

  // 2. Fetch all matches for this participant
  const matches = await getMatchesForParticipant(me.id);
  if (matches.length === 0) {
    return NextResponse.json([]);
  }

  // 3. Enrich each match with the partner's public details
  const enriched: MatchWithPartner[] = [];

  for (const match of matches) {
    const partnerId =
      match.participant_a_id === me.id
        ? match.participant_b_id
        : match.participant_a_id;

    const partner = await getParticipantById(partnerId);
    if (!partner) continue;

    let partnerAnswers: ParticipantAnswers;
    try {
      partnerAnswers = JSON.parse(partner.answers_json);
    } catch {
      continue;
    }

    enriched.push({
      match_id: match.match_id,
      score: match.score,
      revealed_at: match.revealed_at,
      partner: {
        display_name: partnerAnswers.display_name,
        interests: partnerAnswers.interests,
        looking_for: partnerAnswers.looking_for,
        age_range: partnerAnswers.age_range,
        bio: partnerAnswers.bio,
        location: partnerAnswers.location,
      },
    });
  }

  return NextResponse.json(enriched);
}
