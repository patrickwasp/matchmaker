import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { v4 as uuidv4 } from "uuid";
import { internal } from "@/convex/_generated/api";
import { DEFAULT_QUIZ_QUESTIONS, sortQuizQuestions } from "@/lib/quiz";
import { canonicalizePhotoUrl } from "@/lib/photoUrls";
import type { LikeRecord, Participant, ParticipantAnswers, QuizQuestion } from "@/types";

const TEST_EMAIL_DOMAIN = "@matchmaker.test";

type AdminConvexHttpClient = ConvexHttpClient & {
  setAdminAuth(token: string): void;
  function<Result>(reference: unknown, componentPath: string | undefined, args: object): Promise<Result>;
};

function runInternalQuery<Result>(client: ConvexHttpClient, ref: unknown, args: object): Promise<Result> {
  return (client as AdminConvexHttpClient).function(
    ref,
    undefined,
    args
  );
}

function runInternalMutation<Result>(client: ConvexHttpClient, ref: unknown, args: object): Promise<Result> {
  return (client as AdminConvexHttpClient).function(
    ref,
    undefined,
    args
  );
}

function getConvexClient() {
  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const adminKey = process.env.CONVEX_DEPLOY_KEY;

  if (!deploymentUrl) {
    throw new Error("Missing NEXT_PUBLIC_CONVEX_URL env var");
  }

  if (!adminKey) {
    throw new Error("Missing CONVEX_DEPLOY_KEY env var");
  }

  const client = new ConvexHttpClient(deploymentUrl);
  (client as AdminConvexHttpClient).setAdminAuth(adminKey);
  return client;
}

function normalizeParticipantAnswersJson(answersJson: string): string {
  try {
    const answers = JSON.parse(answersJson) as ParticipantAnswers;
    if (!answers.photo_urls?.length) {
      return answersJson;
    }

    const normalizedPhotoUrls = answers.photo_urls.map((photoUrl) => canonicalizePhotoUrl(photoUrl));
    const changed = normalizedPhotoUrls.some((photoUrl, index) => photoUrl !== answers.photo_urls?.[index]);

    if (!changed) {
      return answersJson;
    }

    return JSON.stringify({
      ...answers,
      photo_urls: normalizedPhotoUrls,
    });
  } catch {
    return answersJson;
  }
}

function toParticipant(record: Participant): Participant {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    answers_json: normalizeParticipantAnswersJson(record.answers_json),
    created_at: record.created_at,
    quiz_answers_json: record.quiz_answers_json,
  };
}

export async function appendParticipant(participant: Participant): Promise<void> {
  const client = getConvexClient();
  await runInternalMutation<void>(client, internal.storage.appendParticipant, participant);
}

export async function getAllParticipants(): Promise<Participant[]> {
  const client = getConvexClient();
  const participants = await runInternalQuery<Array<Participant & { _id?: string }>>(
    client,
    internal.storage.getAllParticipants,
    {}
  );
  return participants.map((participant) =>
    toParticipant({
      id: participant.id,
      email: participant.email,
      name: participant.name,
      answers_json: participant.answers_json,
      created_at: participant.created_at,
      quiz_answers_json: participant.quiz_answers_json,
    })
  );
}

export async function getParticipantByEmail(
  email: string
): Promise<Participant | undefined> {
  const client = getConvexClient();
  const participant = await runInternalQuery<(Participant & { _id?: string }) | null>(
    client,
    internal.storage.getParticipantByEmail,
    { email }
  );

  if (!participant) {
    return undefined;
  }

  return toParticipant({
    id: participant.id,
    email: participant.email,
    name: participant.name,
    answers_json: participant.answers_json,
    created_at: participant.created_at,
    quiz_answers_json: participant.quiz_answers_json,
  });
}

export async function getParticipantById(
  id: string
): Promise<Participant | undefined> {
  const client = getConvexClient();
  const participant = await runInternalQuery<(Participant & { _id?: string }) | null>(
    client,
    internal.storage.getParticipantById,
    { id }
  );

  if (!participant) {
    return undefined;
  }

  return toParticipant({
    id: participant.id,
    email: participant.email,
    name: participant.name,
    answers_json: participant.answers_json,
    created_at: participant.created_at,
    quiz_answers_json: participant.quiz_answers_json,
  });
}

export async function updateParticipant(
  email: string,
  updated: Pick<Participant, "name" | "answers_json">
): Promise<void> {
  const client = getConvexClient();
  await runInternalMutation<void>(client, internal.storage.updateParticipant, {
    email,
    name: updated.name,
    answers_json: updated.answers_json,
  });
}

export async function updateParticipantQuizAnswers(
  email: string,
  quizAnswersJson: string
): Promise<void> {
  const client = getConvexClient();
  await runInternalMutation<void>(client, internal.storage.updateParticipantQuizAnswers, {
    email,
    quiz_answers_json: quizAnswersJson,
  });
}

export async function getAllLikes(): Promise<LikeRecord[]> {
  const client = getConvexClient();
  const likes = await runInternalQuery<Array<LikeRecord & { _id?: string }>>(
    client,
    internal.storage.getAllLikes,
    {}
  );
  return likes.map((like) => ({
    liker_id: like.liker_id,
    liked_id: like.liked_id,
    liked: like.liked,
    created_at: like.created_at,
    updated_at: like.updated_at,
  }));
}

export async function upsertLike(
  likerId: string,
  likedId: string,
  liked: boolean
): Promise<void> {
  const client = getConvexClient();
  await runInternalMutation<void>(client, internal.storage.upsertLike, {
    liker_id: likerId,
    liked_id: likedId,
    liked,
  });
}

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  const client = getConvexClient();
  const questions = await runInternalQuery<Array<QuizQuestion & { _id?: string }>>(
    client,
    internal.storage.getQuizQuestions,
    {}
  );

  if (questions.length === 0) {
    return sortQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
  }

  return sortQuizQuestions(
    questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      position: question.position,
      enabled: question.enabled,
    }))
  );
}

export async function replaceQuizQuestions(
  questions: QuizQuestion[]
): Promise<void> {
  const client = getConvexClient();
  await runInternalMutation<void>(client, internal.storage.replaceQuizQuestions, {
    questions: sortQuizQuestions(questions),
  });
}

export async function deleteTestData(): Promise<{ participants: number; likes: number }> {
  const client = getConvexClient();
  return await runInternalMutation<{ participants: number; likes: number }>(
    client,
    internal.storage.deleteTestData,
    {}
  );
}

export async function addTestData(): Promise<{ participants: number; likes: number }> {
  await deleteTestData();

  const createdAt = new Date().toISOString();
  const participants: Participant[] = [
    createTestParticipant({
      email: `alex${TEST_EMAIL_DOMAIN}`,
      name: "Alex",
      age_range: "26-35",
      preferred_age_ranges: ["26-35", "36-45"],
      gender: "Man",
      interests: ["music", "travel", "coffee"],
      location: "New York",
      bio: "Likes easy conversation, good coffee, and live music.",
      created_at: createdAt,
    }),
    createTestParticipant({
      email: `ben${TEST_EMAIL_DOMAIN}`,
      name: "Ben",
      age_range: "36-45",
      preferred_age_ranges: ["26-35", "36-45"],
      gender: "Man",
      interests: ["fitness", "outdoors", "dogs"],
      location: "Brooklyn",
      bio: "Early hikes, dog walks, and direct plans.",
      created_at: createdAt,
    }),
    createTestParticipant({
      email: `clara${TEST_EMAIL_DOMAIN}`,
      name: "Clara",
      age_range: "26-35",
      preferred_age_ranges: ["26-35", "36-45"],
      gender: "Woman",
      interests: ["music", "reading", "travel"],
      location: "Manhattan",
      bio: "Bookshops, dinner dates, and weekends away.",
      created_at: createdAt,
    }),
    createTestParticipant({
      email: `maya${TEST_EMAIL_DOMAIN}`,
      name: "Maya",
      age_range: "26-35",
      preferred_age_ranges: ["26-35"],
      gender: "Woman",
      interests: ["fitness", "wellness", "coffee"],
      location: "Queens",
      bio: "Warm, active, and very into consistent communication.",
      created_at: createdAt,
    }),
  ];

  for (const participant of participants) {
    await appendParticipant(participant);
  }

  await upsertLike(participants[0].id, participants[2].id, true);
  await upsertLike(participants[2].id, participants[0].id, true);
  await upsertLike(participants[1].id, participants[3].id, true);
  await upsertLike(participants[3].id, participants[1].id, true);

  return {
    participants: participants.length,
    likes: 4,
  };
}

function createTestParticipant(args: {
  email: string;
  name: string;
  age_range: ParticipantAnswers["age_range"];
  preferred_age_ranges: NonNullable<ParticipantAnswers["preferred_age_ranges"]>;
  gender: ParticipantAnswers["gender"];
  interests: ParticipantAnswers["interests"];
  location: string;
  bio: string;
  created_at: string;
}): Participant {
  const answers: ParticipantAnswers = {
    name: args.name,
    phone_number: "555-010-9999",
    age_range: args.age_range,
    preferred_age_ranges: args.preferred_age_ranges,
    gender: args.gender,
    interests: args.interests,
    location: args.location,
    bio: args.bio,
    photo_urls: [],
  };

  return {
    id: uuidv4(),
    email: args.email,
    name: args.name,
    answers_json: JSON.stringify(answers),
    created_at: args.created_at,
    quiz_answers_json: "",
  };
}