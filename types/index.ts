// Shared TypeScript types for the matchmaker application

/** Participant row stored in the "participants" sheet */
export interface Participant {
  id: string;
  email: string;
  display_name: string;
  /** JSON-serialised ParticipantAnswers */
  answers_json: string;
  created_at: string;
}

/** The questionnaire answers collected from users */
export interface ParticipantAnswers {
  display_name: string;
  age_range: AgeRange;
  gender: string;
  interests: Interest[];
  looking_for: LookingFor;
  location?: string;
  bio?: string;
}

export type AgeRange = "18-25" | "26-35" | "36-45" | "46+";

export type Interest =
  | "music"
  | "sports"
  | "travel"
  | "cooking"
  | "reading"
  | "gaming"
  | "art"
  | "film";

export type LookingFor = "friendship" | "romance" | "networking";

/** Match row stored in the "matches" sheet */
export interface Match {
  match_id: string;
  participant_a_id: string;
  participant_b_id: string;
  score: number;
  revealed_at: string;
}

/** API response shape for /api/my-matches */
export interface MatchWithPartner {
  match_id: string;
  score: number;
  revealed_at: string;
  partner: {
    display_name: string;
    interests: Interest[];
    looking_for: LookingFor;
    age_range: AgeRange;
    bio?: string;
    location?: string;
  };
}
