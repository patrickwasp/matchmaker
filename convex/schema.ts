import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  participants: defineTable({
    id: v.string(),
    email: v.string(),
    name: v.string(),
    answers_json: v.string(),
    created_at: v.string(),
    quiz_answers_json: v.optional(v.string()),
  })
    .index("by_participant_id", ["id"])
    .index("by_participant_email", ["email"]),

  likes: defineTable({
    liker_id: v.string(),
    liked_id: v.string(),
    liked: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  })
    .index("by_liker", ["liker_id"])
    .index("by_liked", ["liked_id"])
    .index("by_liker_liked", ["liker_id", "liked_id"]),

  quizQuestions: defineTable({
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
  })
    .index("by_question_id", ["id"])
    .index("by_position", ["position"]),
});