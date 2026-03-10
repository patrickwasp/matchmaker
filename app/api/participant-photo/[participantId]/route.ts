import { NextRequest, NextResponse } from "next/server";
import { getParticipantById } from "@/lib/googleSheets";
import type { ParticipantAnswers } from "@/types";

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const [, contentType, base64Payload] = match;
  return {
    contentType,
    buffer: Buffer.from(base64Payload, "base64"),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await context.params;
  const participant = await getParticipantById(participantId);

  if (!participant) {
    return new NextResponse("Not found", { status: 404 });
  }

  let answers: ParticipantAnswers;
  try {
    answers = JSON.parse(participant.answers_json) as ParticipantAnswers;
  } catch {
    return new NextResponse("Invalid profile data", { status: 500 });
  }

  // Prefer Vercel Blob URL – redirect directly to the stored blob
  const firstBlobUrl = answers.photo_urls?.[0];
  if (firstBlobUrl) {
    const redirectUrl = firstBlobUrl.startsWith("/api/photo/")
      ? new URL(firstBlobUrl, request.url)
      : firstBlobUrl;
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  // Legacy: serve base64 data URL from answers_json
  if (!answers.photo_data_url) {
    return new NextResponse("No photo", { status: 404 });
  }

  const decoded = decodeDataUrl(answers.photo_data_url);
  if (!decoded) {
    return new NextResponse("Invalid photo", { status: 500 });
  }

  return new NextResponse(decoded.buffer, {
    status: 200,
    headers: {
      "Content-Type": decoded.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
