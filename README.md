# 💘 Matchmaker

A lightweight online matchmaking / speed-dating web application that runs almost entirely on **free infrastructure**.

| Layer | Technology |
|---|---|
| Frontend + Routing | Next.js 16 (App Router, TypeScript) |
| Styling | TailwindCSS |
| Hosting | Vercel (free tier) |
| Backend | Vercel Serverless Functions |
| Database | Google Sheets (free) |
| Authentication | Google OAuth via NextAuth.js |

---

## Features

- **Sign in with Google** – no password required.
- **Questionnaire** – users fill in a profile (name, age range, interests, etc.).
- **Secure storage** – profiles are written to a Google Sheet through a service account; the sheet is never exposed to the browser.
- **Matching algorithm** – admins trigger a compatibility-scoring algorithm (shared interests + intent).
- **Match reveal** – users see only their own matches; other users' responses are never exposed.
- **Admin panel** – a protected `/admin` page lets authorised users run the matching algorithm.

---

## Project Structure

```
/app                        Next.js App Router pages & API routes
  /api
    /auth/[...nextauth]     NextAuth.js catch-all route
    /submit-profile         POST – save/update questionnaire answers
    /me                     GET  – return the caller's profile
    /run-matching           POST – admin: run matching algorithm
    /my-matches             GET  – return the caller's matches
  /profile                  Questionnaire page
  /matches                  Matches page
  /admin                    Admin panel
  layout.tsx
  page.tsx                  Landing / sign-in page
  providers.tsx             Client-side SessionProvider wrapper
/lib
  auth.ts                   NextAuth configuration
  googleSheets.ts           Google Sheets API helper (server-side only)
/types
  index.ts                  Shared TypeScript types
  next-auth.d.ts            NextAuth session type augmentation
/utils
  matching.ts               Compatibility scoring & match generation
.env.example                Template for required environment variables
```

---

## Spreadsheet Structure

Create a Google Spreadsheet with **two tabs**:

### Sheet: `participants`

| Column | Description |
|--------|-------------|
| `id` | UUID |
| `email` | Google account email |
| `display_name` | Public display name |
| `answers_json` | JSON-serialised questionnaire answers |
| `created_at` | ISO 8601 timestamp |

Add these exact column headers in row 1: `id`, `email`, `display_name`, `answers_json`, `created_at`

### Sheet: `matches`

| Column | Description |
|--------|-------------|
| `match_id` | UUID |
| `participant_a_id` | UUID of first participant |
| `participant_b_id` | UUID of second participant |
| `score` | Compatibility score (0–10) |
| `revealed_at` | ISO 8601 timestamp |

Add these exact column headers in row 1: `match_id`, `participant_a_id`, `participant_b_id`, `score`, `revealed_at`

---

## Setup Guide

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable these APIs:
   - **Google Sheets API**
   - **Google Drive API** (needed to list/access sheets)

### 2. Google OAuth Credentials (for user sign-in)

1. In Google Cloud Console → **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. Add the following to **Authorised redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**.

### 3. Google Service Account (for Sheets access)

1. In Google Cloud Console → **APIs & Services → Credentials**.
2. Click **Create Credentials → Service Account**.
3. Give it any name (e.g., `matchmaker-sheets`).
4. After creating, go to the service account → **Keys → Add Key → Create new key (JSON)**.
5. Download the JSON key file.
6. **Share your Google Spreadsheet** with the service account email (found in the JSON as `client_email`). Give it **Editor** access.

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 Client Secret |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or your Vercel URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` field in the JSON key file |
| `GOOGLE_PRIVATE_KEY` | `private_key` field in the JSON key file (keep the `\n` line breaks, wrap in double quotes) |
| `GOOGLE_SPREADSHEET_ID` | The long ID in your spreadsheet's URL |
| `ADMIN_EMAILS` | Comma-separated list of admin Google emails |

> **Tip:** When pasting `GOOGLE_PRIVATE_KEY` into `.env.local`, keep the literal `\n` characters inside the value (they will be replaced with real newlines at runtime).

### 5. Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add all environment variables from `.env.example` in the Vercel dashboard under **Settings → Environment Variables**.
4. Update `NEXTAUTH_URL` to your Vercel deployment URL.
5. Update the authorised redirect URI in Google Cloud Console to match your Vercel URL.
6. Deploy!

---

## Matching Algorithm

The algorithm (`/utils/matching.ts`) assigns a **compatibility score (0–10)** to each pair of participants:

- **+1** for every shared interest (up to 8 interests available)
- **+3 bonus** if both participants are looking for the same thing (friendship / romance / networking)

Scores are normalised to a 0–10 scale. A greedy one-to-one assignment then pairs each person with their highest-scoring available partner.

---

## Security Notes

- The Google Sheet is **never accessed from the browser**. All reads/writes go through serverless API routes using a service account.
- User sessions are managed by NextAuth.js with a signed JWT cookie.
- Users can only view their own profile and matches. Other users' data is never returned by any API endpoint.
- Admin endpoints are protected by an `ADMIN_EMAILS` allow-list checked server-side.
- Input is validated with [Zod](https://zod.dev/) before writing to the sheet.

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/submit-profile` | User | Save / update questionnaire answers |
| `GET` | `/api/me` | User | Return the caller's participant record |
| `POST` | `/api/run-matching` | Admin | Run the matching algorithm |
| `GET` | `/api/my-matches` | User | Return the caller's matches |

---

## License

MIT
