import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const TEST_EMAIL_DOMAIN = "@matchmaker.test";

const participantValue = {
  id: v.string(),
  email: v.string(),
  name: v.string(),
  answers_json: v.string(),
  created_at: v.string(),
  quiz_answers_json: v.optional(v.string()),
};

const quizQuestionValue = {
  id: v.string(),
  prompt: v.string(),
  options: v.array(
    v.object({
      value: v.string(),
      label: v.string(),
      emoji: v.optional(v.string()),
    })
  ),
  position: v.number(),
  enabled: v.boolean(),
};

export const getAllParticipants = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("participants").collect();
  },
});

export const getParticipantByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_participant_email", (query) => query.eq("email", args.email))
      .unique();
  },
});

export const getParticipantById = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_participant_id", (query) => query.eq("id", args.id))
      .unique();
  },
});

export const appendParticipant = internalMutation({
  args: participantValue,
  handler: async (ctx, args) => {
    await ctx.db.insert("participants", args);
  },
});

export const updateParticipant = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    answers_json: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_participant_email", (query) => query.eq("email", args.email))
      .unique();

    if (!participant) {
      throw new Error(`Participant with email ${args.email} not found`);
    }

    await ctx.db.patch(participant._id, {
      name: args.name,
      answers_json: args.answers_json,
    });
  },
});

export const updateParticipantQuizAnswers = internalMutation({
  args: {
    email: v.string(),
    quiz_answers_json: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_participant_email", (query) => query.eq("email", args.email))
      .unique();

    if (!participant) {
      throw new Error(`Participant with email ${args.email} not found`);
    }

    await ctx.db.patch(participant._id, {
      quiz_answers_json: args.quiz_answers_json,
    });
  },
});

export const getAllLikes = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("likes").collect();
  },
});

export const upsertLike = internalMutation({
  args: {
    liker_id: v.string(),
    liked_id: v.string(),
    liked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("likes")
      .withIndex("by_liker_liked", (query) =>
        query.eq("liker_id", args.liker_id).eq("liked_id", args.liked_id)
      )
      .unique();
    const now = new Date().toISOString();

    if (!existing) {
      await ctx.db.insert("likes", {
        ...args,
        created_at: now,
        updated_at: now,
      });
      return;
    }

    await ctx.db.patch(existing._id, {
      liked: args.liked,
      updated_at: now,
    });
  },
});

export const getQuizQuestions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("quizQuestions").withIndex("by_position").collect();
  },
});

export const replaceQuizQuestions = internalMutation({
  args: {
    questions: v.array(v.object(quizQuestionValue)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("quizQuestions").collect();
    await Promise.all(existing.map((question) => ctx.db.delete(question._id)));

    for (const question of args.questions) {
      await ctx.db.insert("quizQuestions", question);
    }
  },
});

export const deleteParticipantByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_participant_email", (query) => query.eq("email", args.email))
      .unique();

    if (!participant) {
      return;
    }

    // Delete all likes where this participant is liker or liked
    const likes = await ctx.db.query("likes").collect();
    const likesToDelete = likes.filter(
      (like) => like.liker_id === participant.id || like.liked_id === participant.id
    );
    await Promise.all(likesToDelete.map((like) => ctx.db.delete(like._id)));

    await ctx.db.delete(participant._id);
  },
});

export const deleteTestData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").collect();
    const testParticipants = participants.filter((participant) =>
      participant.email.endsWith(TEST_EMAIL_DOMAIN)
    );

    if (testParticipants.length === 0) {
      return { participants: 0, likes: 0 };
    }

    const testIds = new Set(testParticipants.map((participant) => participant.id));
    const likes = await ctx.db.query("likes").collect();
    const likesToDelete = likes.filter(
      (like) => testIds.has(like.liker_id) || testIds.has(like.liked_id)
    );

    await Promise.all(likesToDelete.map((like) => ctx.db.delete(like._id)));
    await Promise.all(testParticipants.map((participant) => ctx.db.delete(participant._id)));

    return {
      participants: testParticipants.length,
      likes: likesToDelete.length,
    };
  },
});