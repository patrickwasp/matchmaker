/**
 * Google Sheets API helper.
 *
 * All reads and writes to the spreadsheet go through this module using a
 * service account whose credentials are stored in environment variables.
 * The sheet is NEVER accessed directly from the browser.
 */

import { google } from "googleapis";
import type { Participant, Match } from "@/types";

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
const MATCHES_SHEET = "matches";

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

/**
 * Append a new participant row to the participants sheet.
 * Columns: id | email | display_name | answers_json | created_at
 */
export async function appendParticipant(participant: Participant): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:E`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          participant.id,
          participant.email,
          participant.display_name,
          participant.answers_json,
          participant.created_at,
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
    // Skip header row by starting at row 2
    range: `${PARTICIPANTS_SHEET}!A2:E`,
  });

  const rows = response.data.values ?? [];
  return rows
    .filter((r) => r.length >= 5)
    .map((r) => ({
      id: r[0],
      email: r[1],
      display_name: r[2],
      answers_json: r[3],
      created_at: r[4],
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
 * Re-writes display_name and answers_json.
 */
export async function updateParticipant(
  email: string,
  updated: Pick<Participant, "display_name" | "answers_json">
): Promise<void> {
  const sheets = getSheets();

  // Fetch all rows to find the row index
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!A:E`,
  });

  const rows = response.data.values ?? [];
  // Row 0 is the header; data starts at row 1 (1-indexed row 2 in Sheets)
  const rowIndex = rows.findIndex((r) => r[1] === email);
  if (rowIndex === -1) {
    throw new Error(`Participant with email ${email} not found`);
  }

  // Sheets rows are 1-indexed; add 1 for the header offset
  const sheetsRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PARTICIPANTS_SHEET}!C${sheetsRow}:D${sheetsRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[updated.display_name, updated.answers_json]],
    },
  });
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

/**
 * Append multiple match rows to the matches sheet.
 * Columns: match_id | participant_a_id | participant_b_id | score | revealed_at
 */
export async function appendMatches(matches: Match[]): Promise<void> {
  if (matches.length === 0) return;

  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${MATCHES_SHEET}!A:E`,
    valueInputOption: "RAW",
    requestBody: {
      values: matches.map((m) => [
        m.match_id,
        m.participant_a_id,
        m.participant_b_id,
        m.score,
        m.revealed_at,
      ]),
    },
  });
}

/**
 * Return all match rows.
 */
export async function getAllMatches(): Promise<Match[]> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${MATCHES_SHEET}!A2:E`,
  });

  const rows = response.data.values ?? [];
  return rows
    .filter((r) => r.length >= 5)
    .map((r) => ({
      match_id: r[0],
      participant_a_id: r[1],
      participant_b_id: r[2],
      score: parseFloat(r[3]),
      revealed_at: r[4],
    }));
}

/**
 * Return all matches that involve a given participant ID.
 */
export async function getMatchesForParticipant(
  participantId: string
): Promise<Match[]> {
  const all = await getAllMatches();
  return all.filter(
    (m) =>
      m.participant_a_id === participantId ||
      m.participant_b_id === participantId
  );
}

/**
 * Delete all existing match rows (used before a fresh matching run).
 */
export async function clearMatches(): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${MATCHES_SHEET}!A2:E`,
  });
}
