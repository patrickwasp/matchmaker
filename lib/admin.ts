import type { ParticipantAnswers } from "@/types";

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  created_at: string;
  age_range?: string;
  gender?: string;
  location?: string;
  interests: string[];
  photo_count: number;
  photo_urls: string[];
  quiz_completed: boolean;
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}

export function parseParticipantAnswers(answersJson: string): ParticipantAnswers | null {
  try {
    return JSON.parse(answersJson) as ParticipantAnswers;
  } catch {
    return null;
  }
}