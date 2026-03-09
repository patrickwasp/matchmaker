/**
 * Matching algorithm.
 *
 * Each pair of participants receives a compatibility score based on:
 *   - Number of shared interests (1 point each)
 *   - Same looking_for category  (+3 bonus)
 *
 * Scores are normalised to a 0–10 scale.
 * The algorithm is intentionally simple – swap this function for anything more
 * sophisticated without changing the API layer.
 */

import { v4 as uuidv4 } from "uuid";
import type { Participant, Match, ParticipantAnswers, Interest } from "@/types";

/** Maximum raw score possible (all interests shared + looking_for bonus) */
const MAX_INTERESTS = 8; // total number of defined interest options
const LOOKING_FOR_BONUS = 3;
const MAX_RAW_SCORE = MAX_INTERESTS + LOOKING_FOR_BONUS;

/**
 * Compute the compatibility score for two sets of answers.
 * Returns a value between 0 and 10 (one decimal place).
 */
export function computeScore(
  a: ParticipantAnswers,
  b: ParticipantAnswers
): number {
  // Shared interests (Jaccard-style intersection count)
  const setA = new Set<Interest>(a.interests);
  const sharedInterests = b.interests.filter((i) => setA.has(i)).length;

  const lookingForBonus = a.looking_for === b.looking_for ? LOOKING_FOR_BONUS : 0;

  const rawScore = sharedInterests + lookingForBonus;
  const normalised = (rawScore / MAX_RAW_SCORE) * 10;
  return Math.round(normalised * 10) / 10; // 1 decimal place
}

/**
 * Generate matches for a list of participants.
 *
 * Strategy: round-robin – every pair gets scored and sorted by score
 * descending. Each participant is matched to their best available partner
 * (greedy one-to-one matching).
 */
export function generateMatches(participants: Participant[]): Match[] {
  if (participants.length < 2) return [];

  // Parse answers for each participant
  const parsed: Array<{ participant: Participant; answers: ParticipantAnswers }> =
    [];

  for (const p of participants) {
    try {
      const answers: ParticipantAnswers = JSON.parse(p.answers_json);
      parsed.push({ participant: p, answers });
    } catch {
      // Skip participants whose answers couldn't be parsed
    }
  }

  // Build all pairs with their scores
  const pairs: Array<{
    a: Participant;
    b: Participant;
    score: number;
  }> = [];

  for (let i = 0; i < parsed.length; i++) {
    for (let j = i + 1; j < parsed.length; j++) {
      const score = computeScore(parsed[i].answers, parsed[j].answers);
      pairs.push({
        a: parsed[i].participant,
        b: parsed[j].participant,
        score,
      });
    }
  }

  // Sort pairs by score descending (best matches first)
  pairs.sort((x, y) => y.score - x.score);

  // Greedy one-to-one assignment
  const matched = new Set<string>();
  const matches: Match[] = [];
  const now = new Date().toISOString();

  for (const pair of pairs) {
    if (matched.has(pair.a.id) || matched.has(pair.b.id)) continue;
    matched.add(pair.a.id);
    matched.add(pair.b.id);

    matches.push({
      match_id: uuidv4(),
      participant_a_id: pair.a.id,
      participant_b_id: pair.b.id,
      score: pair.score,
      revealed_at: now,
    });
  }

  return matches;
}
