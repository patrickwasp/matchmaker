import { normalizeQuizAnswers } from "@/lib/quiz";
import type {
  ParticipantAnswers,
  ParticipantQuizAnswers,
} from "@/types";

const SCORE_WEIGHTS = {
  reciprocalAgePreference: 2,
  sharedInterest: 0.75,
  maxSharedInterestPoints: 3,
  sameLocation: 1,
  quizPairMatch: 1.2,
  maxQuizPairPoints: 6,
} as const;

function questionFit(source?: { self: string }, target?: { self: string }) {
  if (!source?.self || !target?.self) {
    return 0;
  }

  return source.self === target.self ? SCORE_WEIGHTS.quizPairMatch : 0;
}

function normalizeLocation(location?: string) {
  return location?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

/**
 * Compute the compatibility score for two people at read time.
 *
 * Hard requirement:
 * - opposite sex only
 *
 * Weighted points:
 * - reciprocal age preference fit
 * - shared interests
 * - same location
 * - matching quiz question pairs
 *
 * Returns a value between 0 and 10 (one decimal place).
 */
export function computeScore(
  a: ParticipantAnswers,
  b: ParticipantAnswers,
  aQuizAnswers?: ParticipantQuizAnswers,
  bQuizAnswers?: ParticipantQuizAnswers
): number {
  if (a.gender === b.gender) {
    return 0;
  }

  let rawScore = 0;

  const maxScore =
    SCORE_WEIGHTS.reciprocalAgePreference * 2 +
    SCORE_WEIGHTS.maxSharedInterestPoints +
    SCORE_WEIGHTS.sameLocation +
    SCORE_WEIGHTS.maxQuizPairPoints;

  if (a.preferred_age_ranges?.includes(b.age_range)) {
    rawScore += SCORE_WEIGHTS.reciprocalAgePreference;
  }

  if (b.preferred_age_ranges?.includes(a.age_range)) {
    rawScore += SCORE_WEIGHTS.reciprocalAgePreference;
  }

  const sharedInterests = a.interests.filter((interest) => b.interests.includes(interest)).length;
  rawScore += Math.min(
    sharedInterests * SCORE_WEIGHTS.sharedInterest,
    SCORE_WEIGHTS.maxSharedInterestPoints
  );

  if (normalizeLocation(a.location) && normalizeLocation(a.location) === normalizeLocation(b.location)) {
    rawScore += SCORE_WEIGHTS.sameLocation;
  }

  const quizKeys = Array.from(
    new Set([...Object.keys(aQuizAnswers ?? {}), ...Object.keys(bQuizAnswers ?? {})])
  );
  for (const key of quizKeys) {
    rawScore += questionFit(aQuizAnswers?.[key], bQuizAnswers?.[key]);
  }

  const normalised = maxScore > 0 ? (rawScore / maxScore) * 10 : 0;
  return Math.round(normalised * 10) / 10;
}
