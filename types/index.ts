// Shared TypeScript types for the matchmaker application

/** Participant row stored in the "participants" sheet */
export interface Participant {
  id: string;
  email: string;
  name: string;
  /** JSON-serialised ParticipantAnswers */
  answers_json: string;
  created_at: string;
  /** JSON-serialised ParticipantQuizAnswers */
  quiz_answers_json?: string;
}

/** The questionnaire answers collected from users */
export interface ParticipantAnswers {
  name: string;
  phone_number: string;
  age_range: AgeRange;
  preferred_age_ranges?: AgeRange[];
  gender: Gender;
  interests: Interest[];
  location?: string;
  bio?: string;
  /** @deprecated Use photo_urls instead */
  photo_data_url?: string;
  /** Vercel Blob URLs for profile photos (up to 3) */
  photo_urls?: string[];
}

export interface QuizOption {
  value: string;
  label: string;
  emoji?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  position: number;
  enabled: boolean;
}

export interface ParticipantQuizAnswer {
  self: string;
}

export type ParticipantQuizAnswers = Record<string, ParticipantQuizAnswer>;

export type AgeRange = "18-25" | "26-35" | "36-45" | "46+";

export type Gender = "Man" | "Woman";

export type Interest =
  | "music"
  | "travel"
  | "cooking"
  | "reading"
  | "art"
  | "film"
  | "fitness"
  | "outdoors"
  | "dancing"
  | "coffee"
  | "dogs"
  | "wellness"
  | "photography"
  | "nightlife"
  | "beach"
  | "road_trips";

/** API response shape for /api/my-matches */
export interface MatchWithPartner {
  match_id: string;
  score: number;
  revealed_at: string;
  partner: {
    id: string;
    name: string;
    interests: Interest[];
    age_range: AgeRange;
    bio?: string;
    location?: string;
    /** @deprecated Use photo_urls instead */
    photo_data_url?: string;
    photo_urls?: string[];
    phone_number?: string;
  };
}

export interface ResultsProfile {
  id: string;
  name: string;
  interests: Interest[];
  age_range: AgeRange;
  bio?: string;
  location?: string;
  /** @deprecated Use photo_urls instead */
  photo_data_url?: string;
  photo_urls?: string[];
  score: number;
  likedByMe: boolean;
  likedYou: boolean;
  mutualMatch: boolean;
  phone_number?: string;
}

export interface LikeRecord {
  liker_id: string;
  liked_id: string;
  liked: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResultsResponse {
  matches: ResultsProfile[];
  browse: ResultsProfile[];
  targetGender: Gender;
}
