import "server-only";

import { del } from "@vercel/blob";
import { ConvexHttpClient } from "convex/browser";
import { v4 as uuidv4 } from "uuid";
import { internal } from "@/convex/_generated/api";
import { DEFAULT_QUIZ_QUESTIONS, sortQuizQuestions } from "@/lib/quiz";
import { canonicalizePhotoUrl } from "@/lib/photoUrls";
import type { LikeRecord, Participant, ParticipantAnswers, ParticipantQuizAnswers, QuizQuestion } from "@/types";

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
  // Collect photo URLs for all test participants before removing them
  const allParticipants = await getAllParticipants();
  const testParticipants = allParticipants.filter((p) => p.email.endsWith(TEST_EMAIL_DOMAIN));

  const blobPathnames: string[] = [];
  for (const participant of testParticipants) {
    try {
      const answers = JSON.parse(participant.answers_json) as ParticipantAnswers;
      for (const photoUrl of answers.photo_urls ?? []) {
        if (photoUrl.startsWith("/api/photo/")) {
          blobPathnames.push(photoUrl.slice("/api/photo/".length));
        }
      }
    } catch {
      // ignore parse errors for individual participants
    }
  }

  // Delete blobs in parallel (silently ignore individual failures)
  if (blobPathnames.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    await Promise.all(blobPathnames.map((pathname) => del(pathname).catch(() => {})));
  }

  const client = getConvexClient();
  return await runInternalMutation<{ participants: number; likes: number }>(
    client,
    internal.storage.deleteTestData,
    {}
  );
}

// Deterministic picsum.photos placeholder (portrait aspect ratio)
function placeholderPhoto(seed: string | number) {
  return `https://picsum.photos/seed/${seed}/600/800`;
}

// Quiz answer sets – cycled across participants to create varied matching
const QUIZ_ANSWER_SETS: ParticipantQuizAnswers[] = [
  { weekend_rhythm: { self: "quiet" },       communication_style: { self: "steady" },  home_style: { self: "cozy" },       social_style: { self: "close_circle" },      life_pace: { self: "intentional" } },
  { weekend_rhythm: { self: "adventure" },   communication_style: { self: "direct" },  home_style: { self: "active" },     social_style: { self: "regular_gatherings" },life_pace: { self: "steady" } },
  { weekend_rhythm: { self: "host" },        communication_style: { self: "present" }, home_style: { self: "welcoming" },  social_style: { self: "regular_gatherings" },life_pace: { self: "steady" } },
  { weekend_rhythm: { self: "quiet" },       communication_style: { self: "direct" },  home_style: { self: "cozy" },       social_style: { self: "close_circle" },      life_pace: { self: "fast" } },
  { weekend_rhythm: { self: "adventure" },   communication_style: { self: "steady" },  home_style: { self: "active" },     social_style: { self: "full_calendar" },     life_pace: { self: "fast" } },
];

export async function addTestData(): Promise<{ participants: number; likes: number }> {
  await deleteTestData();

  const createdAt = new Date().toISOString();

  const menData: Omit<Parameters<typeof createTestParticipant>[0], "created_at">[] = [
    { email: `alex${TEST_EMAIL_DOMAIN}`,    name: "Alex",    age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["music", "travel", "coffee"],         location: "Manhattan",   bio: "Easy conversation, good coffee, live music.",                   photos: [placeholderPhoto("alex1"), placeholderPhoto("alex2")],       quizSet: 0 },
    { email: `ben${TEST_EMAIL_DOMAIN}`,     name: "Ben",     age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["fitness", "outdoors", "dogs"],          location: "Brooklyn",    bio: "Early hikes, dog walks, and direct plans.",                     photos: [placeholderPhoto("ben1"), placeholderPhoto("ben2")],         quizSet: 1 },
    { email: `chris${TEST_EMAIL_DOMAIN}`,   name: "Chris",   age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Man", interests: ["film", "art", "reading"],               location: "Williamsburg", bio: "Film buff and gallery explorer on weekends.",                  photos: [placeholderPhoto("chris1"), placeholderPhoto("chris2")],     quizSet: 2 },
    { email: `daniel${TEST_EMAIL_DOMAIN}`,  name: "Daniel",  age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Man", interests: ["cooking", "reading", "wellness"],       location: "Astoria",     bio: "Cooks elaborate Sunday dinners. Slow mornings.",               photos: [placeholderPhoto("daniel1"), placeholderPhoto("daniel2")],   quizSet: 3 },
    { email: `ethan${TEST_EMAIL_DOMAIN}`,   name: "Ethan",   age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["travel", "photography", "coffee"],     location: "Hoboken",     bio: "Passport full, camera ready, coffee always on.",               photos: [placeholderPhoto("ethan1"), placeholderPhoto("ethan2")],     quizSet: 4 },
    { email: `felix${TEST_EMAIL_DOMAIN}`,   name: "Felix",   age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["music", "nightlife", "dancing"],        location: "Lower East Side", bio: "DJ on weekends, engineer by week.",                          photos: [placeholderPhoto("felix1"), placeholderPhoto("felix2")],     quizSet: 0 },
    { email: `george${TEST_EMAIL_DOMAIN}`,  name: "George",  age_range: "46+",   preferred_age_ranges: ["36-45", "46+"],   gender: "Man", interests: ["outdoors", "fitness", "road_trips"],   location: "Staten Island", bio: "Prefers weekends in the mountains over anything else.",        photos: [placeholderPhoto("george1"), placeholderPhoto("george2")],   quizSet: 1 },
    { email: `henry${TEST_EMAIL_DOMAIN}`,   name: "Henry",   age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Man", interests: ["art", "film", "coffee"],               location: "Greenpoint",  bio: "Graphic designer. Cinema nerd. Makes very good espresso.",      photos: [placeholderPhoto("henry1"), placeholderPhoto("henry2")],     quizSet: 2 },
    { email: `ian${TEST_EMAIL_DOMAIN}`,     name: "Ian",     age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Man", interests: ["beach", "outdoors", "dogs"],            location: "Rockaway",    bio: "Surfs when the waves cooperate. Dog dad.",                      photos: [placeholderPhoto("ian1"), placeholderPhoto("ian2")],         quizSet: 3 },
    { email: `jake${TEST_EMAIL_DOMAIN}`,    name: "Jake",    age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["cooking", "travel", "music"],           location: "Park Slope",  bio: "Cooks Italian, travels often, always has a playlist ready.",    photos: [placeholderPhoto("jake1"), placeholderPhoto("jake2")],       quizSet: 4 },
    { email: `karl${TEST_EMAIL_DOMAIN}`,    name: "Karl",    age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["fitness", "wellness", "reading"],       location: "Upper West Side", bio: "Runs half marathons, meditates, loves a good biography.",    photos: [placeholderPhoto("karl1"), placeholderPhoto("karl2")],       quizSet: 0 },
    { email: `liam${TEST_EMAIL_DOMAIN}`,    name: "Liam",    age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Man", interests: ["photography", "travel", "coffee"],     location: "Chelsea",     bio: "Shoots street photography at 5 am before the city wakes up.", photos: [placeholderPhoto("liam1"), placeholderPhoto("liam2")],       quizSet: 1 },
    { email: `marcus${TEST_EMAIL_DOMAIN}`,  name: "Marcus",  age_range: "36-45", preferred_age_ranges: ["36-45", "46+"],   gender: "Man", interests: ["dogs", "outdoors", "road_trips"],       location: "Harlem",      bio: "Dog trainer by trade, adventurer at heart.",                   photos: [placeholderPhoto("marcus1"), placeholderPhoto("marcus2")],   quizSet: 2 },
    { email: `noah${TEST_EMAIL_DOMAIN}`,    name: "Noah",    age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Man", interests: ["music", "art", "film"],                 location: "Bushwick",    bio: "Makes music, paints occasionally, always overthinks movies.",  photos: [placeholderPhoto("noah1"), placeholderPhoto("noah2")],       quizSet: 3 },
    { email: `oliver${TEST_EMAIL_DOMAIN}`,  name: "Oliver",  age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["cooking", "coffee", "travel"],           location: "West Village", bio: "Chef's table convert. Very enthusiastic about good olive oil.",photos: [placeholderPhoto("oliver1"), placeholderPhoto("oliver2")],   quizSet: 4 },
    { email: `paul${TEST_EMAIL_DOMAIN}`,    name: "Paul",    age_range: "46+",   preferred_age_ranges: ["36-45", "46+"],   gender: "Man", interests: ["reading", "film", "coffee"],            location: "Upper East Side", bio: "Bookshop owner. Long films. Strong opinions on coffee.",     photos: [placeholderPhoto("paul1"), placeholderPhoto("paul2")],       quizSet: 0 },
    { email: `ryan${TEST_EMAIL_DOMAIN}`,    name: "Ryan",    age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Man", interests: ["fitness", "beach", "travel"],           location: "Jersey City",  bio: "Trains in the morning, plans beach trips for everyone.",       photos: [placeholderPhoto("ryan1"), placeholderPhoto("ryan2")],       quizSet: 1 },
    { email: `sam${TEST_EMAIL_DOMAIN}`,     name: "Sam",     age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["outdoors", "photography", "road_trips"],location: "Fort Greene",  bio: "Road trips with a film camera and no fixed itinerary.",        photos: [placeholderPhoto("sam1"), placeholderPhoto("sam2")],         quizSet: 2 },
    { email: `tom${TEST_EMAIL_DOMAIN}`,     name: "Tom",     age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["wellness", "reading", "coffee"],        location: "Cobble Hill", bio: "Therapist. Reads on subway. Makes pour-over at home.",         photos: [placeholderPhoto("tom1"), placeholderPhoto("tom2")],         quizSet: 3 },
    { email: `victor${TEST_EMAIL_DOMAIN}`,  name: "Victor",  age_range: "36-45", preferred_age_ranges: ["36-45"],          gender: "Man", interests: ["music", "dancing", "nightlife"],        location: "Spanish Harlem", bio: "Salsa instructor. Weekend vinyl collector.",                  photos: [placeholderPhoto("victor1"), placeholderPhoto("victor2")],   quizSet: 4 },
    { email: `will${TEST_EMAIL_DOMAIN}`,    name: "Will",    age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Man", interests: ["cooking", "dogs", "wellness"],           location: "Nolita",       bio: "Farmer's market every Sunday. Very much a dog person.",        photos: [placeholderPhoto("will1"), placeholderPhoto("will2")],       quizSet: 0 },
    { email: `xavier${TEST_EMAIL_DOMAIN}`,  name: "Xavier",  age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Man", interests: ["art", "photography", "travel"],         location: "Long Island City", bio: "Sculptor by training, photographer by habit.",              photos: [placeholderPhoto("xavier1"), placeholderPhoto("xavier2")],   quizSet: 1 },
    { email: `zach${TEST_EMAIL_DOMAIN}`,    name: "Zach",    age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Man", interests: ["film", "reading", "coffee"],            location: "Murray Hill",  bio: "Writes screenplays that may one day get finished.",            photos: [placeholderPhoto("zach1"), placeholderPhoto("zach2")],       quizSet: 2 },
    { email: `derek${TEST_EMAIL_DOMAIN}`,   name: "Derek",   age_range: "36-45", preferred_age_ranges: ["36-45", "46+"],   gender: "Man", interests: ["outdoors", "beach", "fitness"],         location: "Bayside",      bio: "Kayaks every weekend. Genuinely happy person.",                photos: [placeholderPhoto("derek1"), placeholderPhoto("derek2")],     quizSet: 3 },
    { email: `mike${TEST_EMAIL_DOMAIN}`,    name: "Mike",    age_range: "46+",   preferred_age_ranges: ["36-45", "46+"],   gender: "Man", interests: ["cooking", "music", "dogs"],             location: "Riverdale",    bio: "Cooks jazz-era recipes and argues they are underrated.",       photos: [placeholderPhoto("mike1"), placeholderPhoto("mike2")],       quizSet: 4 },
  ];

  const womenData: Omit<Parameters<typeof createTestParticipant>[0], "created_at">[] = [
    { email: `alice${TEST_EMAIL_DOMAIN}`,   name: "Alice",   age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["music", "reading", "travel"],           location: "Manhattan",    bio: "Bookshops, dinner dates, and weekends away.",                  photos: [placeholderPhoto("alice1"), placeholderPhoto("alice2")],     quizSet: 0 },
    { email: `bella${TEST_EMAIL_DOMAIN}`,   name: "Bella",   age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["fitness", "wellness", "coffee"],         location: "Queens",       bio: "Warm, active, very into consistent communication.",            photos: [placeholderPhoto("bella1"), placeholderPhoto("bella2")],     quizSet: 1 },
    { email: `carol${TEST_EMAIL_DOMAIN}`,   name: "Carol",   age_range: "36-45", preferred_age_ranges: ["36-45", "26-35"], gender: "Woman", interests: ["cooking", "art", "film"],               location: "Astoria",      bio: "Hosts potluck dinners, paints on Sundays, watches everything.",photos: [placeholderPhoto("carol1"), placeholderPhoto("carol2")],     quizSet: 2 },
    { email: `diana${TEST_EMAIL_DOMAIN}`,   name: "Diana",   age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["travel", "photography", "outdoors"],    location: "Tribeca",      bio: "Landscape photographer. Always planning the next trip.",       photos: [placeholderPhoto("diana1"), placeholderPhoto("diana2")],     quizSet: 3 },
    { email: `emma${TEST_EMAIL_DOMAIN}`,    name: "Emma",    age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Woman", interests: ["art", "music", "coffee"],               location: "Williamsburg", bio: "Ceramics studio on Tuesdays. Jazz on every other night.",      photos: [placeholderPhoto("emma1"), placeholderPhoto("emma2")],       quizSet: 4 },
    { email: `fiona${TEST_EMAIL_DOMAIN}`,   name: "Fiona",   age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["wellness", "reading", "dogs"],          location: "Park Slope",   bio: "Therapist who practices what she preaches. Dog mom.",          photos: [placeholderPhoto("fiona1"), placeholderPhoto("fiona2")],     quizSet: 0 },
    { email: `grace${TEST_EMAIL_DOMAIN}`,   name: "Grace",   age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["dancing", "nightlife", "music"],        location: "Lower East Side", bio: "Swing dancer. Weekend DJ. Knows every good bar.",            photos: [placeholderPhoto("grace1"), placeholderPhoto("grace2")],     quizSet: 1 },
    { email: `hannah${TEST_EMAIL_DOMAIN}`,  name: "Hannah",  age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["cooking", "travel", "coffee"],          location: "West Village", bio: "Food writer. Has opinions about every restaurant on the block.",photos: [placeholderPhoto("hannah1"), placeholderPhoto("hannah2")],   quizSet: 2 },
    { email: `isla${TEST_EMAIL_DOMAIN}`,    name: "Isla",    age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Woman", interests: ["beach", "outdoors", "fitness"],         location: "Far Rockaway", bio: "Lifeguard to architects. Loves both equally.",                 photos: [placeholderPhoto("isla1"), placeholderPhoto("isla2")],       quizSet: 3 },
    { email: `julia${TEST_EMAIL_DOMAIN}`,   name: "Julia",   age_range: "36-45", preferred_age_ranges: ["36-45"],          gender: "Woman", interests: ["film", "art", "coffee"],               location: "Greenwich Village", bio: "Curator at a small gallery. Watches films twice.",          photos: [placeholderPhoto("julia1"), placeholderPhoto("julia2")],     quizSet: 4 },
    { email: `kate${TEST_EMAIL_DOMAIN}`,    name: "Kate",    age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["reading", "wellness", "coffee"],        location: "Cobble Hill",  bio: "Editor. Slow Sundays with a very large stack of books.",       photos: [placeholderPhoto("kate1"), placeholderPhoto("kate2")],       quizSet: 0 },
    { email: `laura${TEST_EMAIL_DOMAIN}`,   name: "Laura",   age_range: "36-45", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["outdoors", "road_trips", "dogs"],       location: "Hoboken",      bio: "Hikes every weekend. Has driven cross-country three times.",   photos: [placeholderPhoto("laura1"), placeholderPhoto("laura2")],     quizSet: 1 },
    { email: `mia${TEST_EMAIL_DOMAIN}`,     name: "Mia",     age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["music", "dancing", "nightlife"],        location: "Bushwick",     bio: "Makes music on her laptop at 1 am. Very into bass lines.",     photos: [placeholderPhoto("mia1"), placeholderPhoto("mia2")],         quizSet: 2 },
    { email: `nadia${TEST_EMAIL_DOMAIN}`,   name: "Nadia",   age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["cooking", "wellness", "reading"],       location: "Fort Greene",  bio: "Nutritionist. Cooks with intention. Reads before bed.",        photos: [placeholderPhoto("nadia1"), placeholderPhoto("nadia2")],     quizSet: 3 },
    { email: `olivia${TEST_EMAIL_DOMAIN}`,  name: "Olivia",  age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Woman", interests: ["travel", "photography", "beach"],       location: "Greenpoint",   bio: "Just back from Oaxaca. Already planning the next one.",        photos: [placeholderPhoto("olivia1"), placeholderPhoto("olivia2")],   quizSet: 4 },
    { email: `paige${TEST_EMAIL_DOMAIN}`,   name: "Paige",   age_range: "36-45", preferred_age_ranges: ["36-45", "46+"],   gender: "Woman", interests: ["art", "reading", "film"],              location: "Upper West Side", bio: "Writes literary fiction. Has a lot of half-read books.",    photos: [placeholderPhoto("paige1"), placeholderPhoto("paige2")],     quizSet: 0 },
    { email: `rachel${TEST_EMAIL_DOMAIN}`,  name: "Rachel",  age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["fitness", "outdoors", "beach"],         location: "Battery Park", bio: "Trains for triathlons. Very calm person, ironically.",         photos: [placeholderPhoto("rachel1"), placeholderPhoto("rachel2")],   quizSet: 1 },
    { email: `sophie${TEST_EMAIL_DOMAIN}`,  name: "Sophie",  age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["cooking", "music", "coffee"],           location: "Carroll Gardens", bio: "Chef with a small supper club. Always feeding people.",       photos: [placeholderPhoto("sophie1"), placeholderPhoto("sophie2")],   quizSet: 2 },
    { email: `tara${TEST_EMAIL_DOMAIN}`,    name: "Tara",    age_range: "36-45", preferred_age_ranges: ["36-45"],          gender: "Woman", interests: ["wellness", "fitness", "reading"],       location: "Nolita",       bio: "Yoga teacher. Meditates at sunrise. Takes things seriously.",  photos: [placeholderPhoto("tara1"), placeholderPhoto("tara2")],       quizSet: 3 },
    { email: `uma${TEST_EMAIL_DOMAIN}`,     name: "Uma",     age_range: "46+",   preferred_age_ranges: ["36-45", "46+"],   gender: "Woman", interests: ["travel", "film", "art"],               location: "Murray Hill",  bio: "Documentary filmmaker. Has visited 40 countries.",            photos: [placeholderPhoto("uma1"), placeholderPhoto("uma2")],         quizSet: 4 },
    { email: `violet${TEST_EMAIL_DOMAIN}`,  name: "Violet",  age_range: "26-35", preferred_age_ranges: ["26-35"],          gender: "Woman", interests: ["art", "coffee", "photography"],         location: "Long Island City", bio: "Florist and part-time painter. Smells like peonies.",       photos: [placeholderPhoto("violet1"), placeholderPhoto("violet2")],   quizSet: 0 },
    { email: `wendy${TEST_EMAIL_DOMAIN}`,   name: "Wendy",   age_range: "36-45", preferred_age_ranges: ["36-45", "26-35"], gender: "Woman", interests: ["dogs", "outdoors", "fitness"],          location: "Jackson Heights", bio: "Runs with her dog every morning. Very into maps.",           photos: [placeholderPhoto("wendy1"), placeholderPhoto("wendy2")],     quizSet: 1 },
    { email: `xena${TEST_EMAIL_DOMAIN}`,    name: "Xena",    age_range: "26-35", preferred_age_ranges: ["26-35", "36-45"], gender: "Woman", interests: ["nightlife", "music", "dancing"],        location: "Crown Heights",  bio: "Promoter and dancer. Rarely home before midnight.",           photos: [placeholderPhoto("xena1"), placeholderPhoto("xena2")],       quizSet: 2 },
    { email: `yasmin${TEST_EMAIL_DOMAIN}`,  name: "Yasmin",  age_range: "18-25", preferred_age_ranges: ["18-25", "26-35"], gender: "Woman", interests: ["reading", "wellness", "cooking"],       location: "Flatbush",     bio: "Future doctor. Stress-bakes. Always has snacks for everyone.", photos: [placeholderPhoto("yasmin1"), placeholderPhoto("yasmin2")],   quizSet: 3 },
    { email: `zoe${TEST_EMAIL_DOMAIN}`,     name: "Zoe",     age_range: "46+",   preferred_age_ranges: ["46+", "36-45"],   gender: "Woman", interests: ["film", "reading", "road_trips"],        location: "Riverdale",    bio: "Film professor. Quotes Cassavetes. Great road trip company.",  photos: [placeholderPhoto("zoe1"), placeholderPhoto("zoe2")],         quizSet: 4 },
  ];

  const participants: Participant[] = [
    ...menData.map((d) => createTestParticipant({ ...d, created_at: createdAt })),
    ...womenData.map((d) => createTestParticipant({ ...d, created_at: createdAt })),
  ];

  for (const participant of participants) {
    await appendParticipant(participant);
  }

  // Create a realistic spread of mutual likes between men and women
  const men = participants.filter((_, i) => i < menData.length);
  const women = participants.filter((_, i) => i >= menData.length);

  const likes: Array<[string, string]> = [];
  for (let i = 0; i < men.length; i++) {
    const w1 = women[i % women.length];
    const w2 = women[(i + 3) % women.length];
    likes.push([men[i].id, w1.id]);
    likes.push([w1.id, men[i].id]);
    likes.push([men[i].id, w2.id]);
  }
  for (let i = 0; i < women.length; i++) {
    const m = men[(i + 2) % men.length];
    likes.push([women[i].id, m.id]);
  }

  for (const [likerId, likedId] of likes) {
    await upsertLike(likerId, likedId, true);
  }

  return {
    participants: participants.length,
    likes: likes.length,
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
  photos: string[];
  quizSet: number;
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
    photo_urls: args.photos,
  };

  return {
    id: uuidv4(),
    email: args.email,
    name: args.name,
    answers_json: JSON.stringify(answers),
    created_at: args.created_at,
    quiz_answers_json: JSON.stringify(QUIZ_ANSWER_SETS[args.quizSet % QUIZ_ANSWER_SETS.length]),
  };
}