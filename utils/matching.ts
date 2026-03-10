import { normalizeQuizAnswers } from "@/lib/quiz";
import type {
  ParticipantAnswers,
  ParticipantQuizAnswers,
} from "@/types";

function questionFit(source?: { self: string }, target?: { self: string }) {
  if (!source?.self || !target?.self) {
    return 0;
  }

  return source.self === target.self ? 2 : 0;
}

/**
 * Compute the compatibility score for two sets of answers.
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
  let maxScore = 0;

  if (a.preferred_age_ranges?.length) {
    maxScore += 1;
  }
  if (a.preferred_age_ranges?.includes(b.age_range)) {
    rawScore += 1;
  }

  if (b.preferred_age_ranges?.length) {
    maxScore += 1;
  }
  if (b.preferred_age_ranges?.includes(a.age_range)) {
    rawScore += 1;
  }

  const quizKeys = Array.from(
    new Set([...Object.keys(aQuizAnswers ?? {}), ...Object.keys(bQuizAnswers ?? {})])
  );
  for (const key of quizKeys) {
    rawScore += questionFit(aQuizAnswers?.[key], bQuizAnswers?.[key]);
    maxScore += 2;
  }

  const normalised = maxScore > 0 ? (rawScore / maxScore) * 10 : 0;
  return Math.round(normalised * 10) / 10;
}
