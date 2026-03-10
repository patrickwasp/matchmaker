/**
 * Google Sheets API helper.
 *
 * All reads and writes to the spreadsheet go through this module using a
 * service account whose credentials are stored in environment variables.
 * The sheet is NEVER accessed directly from the browser.
 */

import { google } from "googleapis";
import { DEFAULT_QUIZ_QUESTIONS, sortQuizQuestions } from "@/lib/quiz";
import { canonicalizePhotoUrl } from "@/lib/photoUrls";
import type { LikeRecord, Participant, ParticipantAnswers, QuizQuestion } from "@/types";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars"
    );
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// Sheet tab names
const PARTICIPANTS_SHEET = "participants";
const QUIZ_QUESTIONS_SHEET = "quiz_questions";
const LIKES_SHEET = "likes";

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

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

/**
 * Append a new participant row to the participants sheet.
 * Columns: id | email | name | answers_json | created_at | quiz_answers_json
 */
export async function appendParticipant(participant: Participant): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          participant.id,
          participant.email,
          participant.name,
          participant.answers_json,
          participant.created_at,
          participant.quiz_answers_json ?? "",
        ],
      ],
    },
  });
}

/**
 * Return all participant rows.
 */
export async function getAllParticipants(): Promise<Participant[]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:F`,
  });

  // Skip header row
  const rows = (response.data.values ?? []).slice(1);
  return rows
    .filter((r) => r.length >= 5)
    .map((r) => ({
      id: r[0],
      email: r[1],
      name: r[2],
      answers_json: normalizeParticipantAnswersJson(r[3]),
      created_at: r[4],
      quiz_answers_json: r[5],
    }));
}

/**
 * Find one participant by email address (returns undefined if not found).
 */
export async function getParticipantByEmail(
  email: string
): Promise<Participant | undefined> {
  const all = await getAllParticipants();
  return all.find((p) => p.email === email);
}

/**
 * Find one participant by their UUID.
 */
export async function getParticipantById(
  id: string
): Promise<Participant | undefined> {
  const all = await getAllParticipants();
  return all.find((p) => p.id === id);
}

/**
 * Update an existing participant row identified by email.
 * Re-writes name and answers_json.
 */
export async function updateParticipant(
  email: string,
  updated: Pick<Participant, "name" | "answers_json">
): Promise<void> {
  const sheets = getSheets();

  // Fetch all rows to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:F`,
  });

  const rows = response.data.values ?? [];
  // Row 0 is the header; data starts at row 1 (1-indexed row 2 in Sheets)
  const rowIndex = rows.findIndex((r) => r[1] === email);
  if (rowIndex === -1) {
    throw new Error(`Participant with email ${email} not found`);
  }

  // Sheets rows are 1-indexed; add 1 for the header offset
  const sheetsRow = rowIndex + 1;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${PARTICIPANTS_SHEET}!C${sheetsRow}:D${sheetsRow}`,
          values: [[updated.name, updated.answers_json]],
        },
      ],
    },
  });
}

export async function updateParticipantQuizAnswers(
  email: string,
  quizAnswersJson: string
): Promise<void> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:F`,
  });

  const rows = response.data.values ?? [];
  const rowIndex = rows.findIndex((r) => r[1] === email);
  if (rowIndex === -1) {
    throw new Error(`Participant with email ${email} not found`);
  }

  const sheetsRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!F${sheetsRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[quizAnswersJson]],
    },
  });
}

export async function getAllLikes(): Promise<LikeRecord[]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LIKES_SHEET}!A:E`,
  });

  const rows = (response.data.values ?? []).slice(1);
  return rows
    .filter((row) => row.length >= 5)
    .map((row) => ({
      liker_id: row[0],
      liked_id: row[1],
      liked: row[2] === "true",
      created_at: row[3],
      updated_at: row[4],
    }));
}

export async function upsertLike(
  likerId: string,
  likedId: string,
  liked: boolean
): Promise<void> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LIKES_SHEET}!A:E`,
  });

  const rows = response.data.values ?? [];
  const rowIndex = rows.findIndex((row) => row[0] === likerId && row[1] === likedId);
  const now = new Date().toISOString();

  if (rowIndex === -1) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${LIKES_SHEET}!A:E`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[likerId, likedId, liked ? "true" : "false", now, now]],
      },
    });
    return;
  }

  const sheetsRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${LIKES_SHEET}!C${sheetsRow}:E${sheetsRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[liked ? "true" : "false", rows[rowIndex][3] || now, now]],
    },
  });
}

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${QUIZ_QUESTIONS_SHEET}!A:E`,
  });

  const rows = (response.data.values ?? []).slice(1);
  const parsed = rows
    .filter((row) => row.length >= 5)
    .map((row): QuizQuestion | null => {
      try {
        return {
          id: row[0],
          prompt: row[1],
          options: JSON.parse(row[2]),
          position: Number(row[3]) || 0,
          enabled: row[4] !== "false",
        } satisfies QuizQuestion;
      } catch {
        return null;
      }
    })
    .filter((question): question is QuizQuestion => question !== null);

  if (parsed.length === 0) {
    return sortQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
  }

  return sortQuizQuestions(parsed);
}

export async function replaceQuizQuestions(
  questions: QuizQuestion[]
): Promise<void> {
  const sheets = getSheets();
  const sortedQuestions = sortQuizQuestions(questions);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${QUIZ_QUESTIONS_SHEET}!A2:E`,
  });

  if (sortedQuestions.length === 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${QUIZ_QUESTIONS_SHEET}!A2:E${sortedQuestions.length + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: sortedQuestions.map((question) => [
        question.id,
        question.prompt,
        JSON.stringify(question.options),
        question.position,
        question.enabled ? "true" : "false",
      ]),
    },
  });
}

// ---------------------------------------------------------------------------
// Sheet initialisation
// ---------------------------------------------------------------------------

/**
 * Ensure all sheet tabs exist with the correct header rows.
 * Safe to call multiple times – existing tabs/headers are left untouched.
 */
export async function initializeSheets(): Promise<void> {
  const sheets = getSheets();

  // Fetch current sheet metadata to see which tabs already exist
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const existingTitles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "")
  );
  const participantSheetId = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === PARTICIPANTS_SHEET
  )?.properties?.sheetId;

  const addSheetRequests: object[] = [];
  if (!existingTitles.has(PARTICIPANTS_SHEET)) {
    addSheetRequests.push({ addSheet: { properties: { title: PARTICIPANTS_SHEET } } });
  }
  if (!existingTitles.has(QUIZ_QUESTIONS_SHEET)) {
    addSheetRequests.push({ addSheet: { properties: { title: QUIZ_QUESTIONS_SHEET } } });
  }
  if (!existingTitles.has(LIKES_SHEET)) {
    addSheetRequests.push({ addSheet: { properties: { title: LIKES_SHEET } } });
  }

  if (addSheetRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: addSheetRequests },
    });
  }

  // Write headers if the first row is empty
  const checks = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [
      `${PARTICIPANTS_SHEET}!A1:F1`,
      `${QUIZ_QUESTIONS_SHEET}!A1:E1`,
      `${QUIZ_QUESTIONS_SHEET}!A2:E`,
      `${LIKES_SHEET}!A1:E1`,
    ],
  });

  const [participantsHeader, quizQuestionsHeader, quizQuestionsRows, likesHeader] =
    checks.data.valueRanges ?? [];

  if (
    participantSheetId !== undefined &&
    participantsHeader?.values?.[0]?.[6] === "photo_cell"
  ) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: participantSheetId,
                dimension: "COLUMNS",
                startIndex: 6,
                endIndex: 7,
              },
            },
          },
        ],
      },
    });
  }

  const headerUpdates: { range: string; values: string[][] }[] = [];
  if (!participantsHeader?.values?.length || participantsHeader.values[0].length < 6) {
    headerUpdates.push({
      range: `${PARTICIPANTS_SHEET}!A1:F1`,
      values: [["id", "email", "name", "answers_json", "created_at", "quiz_answers_json"]],
    });
  }
  if (!quizQuestionsHeader?.values?.length) {
    headerUpdates.push({
      range: `${QUIZ_QUESTIONS_SHEET}!A1:E1`,
      values: [["id", "prompt", "options_json", "position", "enabled"]],
    });
  }
  if (!likesHeader?.values?.length) {
    headerUpdates.push({
      range: `${LIKES_SHEET}!A1:E1`,
      values: [["liker_id", "liked_id", "liked", "created_at", "updated_at"]],
    });
  }

  if (headerUpdates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: headerUpdates,
      },
    });
  }

  if (!quizQuestionsRows?.values?.length) {
    await replaceQuizQuestions(DEFAULT_QUIZ_QUESTIONS);
  }
}
