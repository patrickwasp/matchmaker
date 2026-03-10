# 💘 Matchmaker

A lightweight online matchmaking / speed-dating web application that runs almost entirely on **free infrastructure**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpatrickwasp%2Fmatchmaker&project-name=matchmaker&repository-name=matchmaker&demo-title=Matchmaker&demo-description=Next.js%20matchmaking%20app%20with%20Convex%2C%20NextAuth%2C%20and%20Vercel%20Blob&products=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22convex%22%2C%22productSlug%22%3A%22convex%22%2C%22protocol%22%3A%22storage%22%7D%5D)

| Layer              | Technology                          |
| ------------------ | ----------------------------------- |
| Frontend + Routing | Next.js 16 (App Router, TypeScript) |
| Styling            | TailwindCSS                         |
| Hosting            | Vercel (free tier)                  |
| Backend            | Vercel Serverless Functions         |
| Database           | Convex                              |
| Authentication     | Google OAuth via NextAuth.js        |

---

## Features

- **Sign in with Google** – no password required.
- **Questionnaire** – users fill in a profile (name, age range, interests, etc.).
- **Secure storage** – profiles, likes, and quiz questions are stored in Convex through server-side route handlers.
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
  ConvexClientProvider.tsx  Client-side Convex provider
  providers.tsx             Client-side provider composition
/lib
  auth.ts                   NextAuth configuration
  storage.ts                Convex storage helper (server-side only)
/convex
  schema.ts                 Convex database schema
  storage.ts                Internal Convex queries and mutations
/types
  index.ts                  Shared TypeScript types
  next-auth.d.ts            NextAuth session type augmentation
/utils
  matching.ts               Compatibility scoring & match generation
.env.example                Template for required environment variables
```

---

## Convex Data Model

The app stores three collections in Convex:

- `participants` for profile records and quiz answers.
- `likes` for one-way like/dislike decisions and mutual match detection.
- `quizQuestions` for the editable admin quiz.

---

## Quick Deploy

The deploy button above will create a new Vercel project from this repository and attach the Convex Marketplace integration during import.

It cannot fully eliminate manual setup because these values are project-specific and must still be supplied by the person deploying:

- Google OAuth client ID and secret
- NextAuth secret and deployment URL
- Vercel Blob token
- Admin email allow-list

So the realistic outcome is one-click Vercel + Convex provisioning, plus one short pass through the environment variable form.

---

## Setup Guide

### 1. Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Enable the **Google People API** if your org requires explicit consent-screen setup.

### 2. Google OAuth Credentials (for user sign-in)

1. In Google Cloud Console → **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth 2.0 Client ID**.
3. Application type: **Web application**.
4. Add the following to **Authorised redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local dev)
   - `https://your-vercel-domain.vercel.app/api/auth/callback/google` (production)
5. Copy the **Client ID** and **Client Secret**.

### 4. Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable                 | Where to find it                                                |
| ------------------------ | --------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`       | OAuth 2.0 Client ID                                             |
| `GOOGLE_CLIENT_SECRET`   | OAuth 2.0 Client Secret                                         |
| `NEXTAUTH_SECRET`        | Run `openssl rand -base64 32`                                   |
| `NEXTAUTH_URL`           | `http://localhost:3000` (dev) or your Vercel URL                |
| `BLOB_READ_WRITE_TOKEN`  | Vercel Blob read/write token for profile photo uploads          |
| `CONVEX_DEPLOY_KEY`      | Convex deploy key for this project                              |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL, e.g. `https://your-project.convex.cloud` |
| `ADMIN_EMAILS`           | Comma-separated list of admin Google emails                     |

### 5. Local Development

```bash
npm install
npx convex dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

1. Either use the deploy button above or import the repo manually in [Vercel](https://vercel.com/new).
2. Add all environment variables from `.env.example` in the Vercel dashboard under **Settings -> Environment Variables**.
3. If you imported manually, connect the Vercel project to Convex and keep the custom prefix empty.
4. Update `NEXTAUTH_URL` to your Vercel deployment URL.
5. Update the authorised redirect URI in Google Cloud Console to match your Vercel URL.
6. Deploy. The included `vercel.json` runs `npx convex deploy --cmd 'npm run build'` so the Convex backend is deployed before the Next.js build.

---

## Matching Algorithm

The algorithm (`/utils/matching.ts`) assigns a **compatibility score (0–10)** to each pair of participants:

- **+1** for every shared interest (up to 8 interests available)
- **+3 bonus** if both participants are looking for the same thing (friendship / romance / networking)

Scores are normalised to a 0–10 scale. A greedy one-to-one assignment then pairs each person with their highest-scoring available partner.

---

## Security Notes

- Convex writes happen through serverless API routes using a server-only admin client configured with `CONVEX_DEPLOY_KEY`.
- User sessions are managed by NextAuth.js with a signed JWT cookie.
- Users can only view their own profile and matches. Other users' data is never returned by any API endpoint.
- Admin endpoints are protected by an `ADMIN_EMAILS` allow-list checked server-side.
- Input is validated with [Zod](https://zod.dev/) before writing to Convex.

---

## API Reference

| Method | Path                  | Auth  | Description                            |
| ------ | --------------------- | ----- | -------------------------------------- |
| `POST` | `/api/submit-profile` | User  | Save / update questionnaire answers    |
| `GET`  | `/api/me`             | User  | Return the caller's participant record |
| `POST` | `/api/run-matching`   | Admin | Run the matching algorithm             |
| `GET`  | `/api/my-matches`     | User  | Return the caller's matches            |

---

## License

MIT
