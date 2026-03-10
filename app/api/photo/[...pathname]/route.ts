import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pathname: string[] }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return new NextResponse("Blob storage is not configured.", { status: 500 });
  }

  const { pathname } = await context.params;
  const blobPathname = pathname.join("/");
  if (!blobPathname) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const ifNoneMatch = request.headers.get("if-none-match") ?? undefined;
    const result = await get(blobPathname, {
      access: "private",
      ifNoneMatch,
    });

    if (!result) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          "Cache-Control": result.blob.cacheControl,
        },
      });
    }

    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType,
        "Content-Disposition": result.blob.contentDisposition,
        "Cache-Control": result.blob.cacheControl,
        ETag: result.blob.etag,
      },
    });
  } catch (error) {
    console.error("Blob fetch failed", error);
    return new NextResponse(
      error instanceof Error && process.env.NODE_ENV !== "production"
        ? `Blob fetch failed: ${error.message}`
        : "Blob fetch failed.",
      { status: 502 }
    );
  }
}