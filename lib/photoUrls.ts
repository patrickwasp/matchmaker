export function getAppBaseUrl(): string | undefined {
  const configured =
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return configured?.replace(/\/$/, "");
}

export function buildPhotoProxyPath(blobPathname: string) {
  return `/api/photo/${blobPathname}`;
}

export function isPhotoReference(photoUrl: string) {
  if (photoUrl.startsWith("/api/photo/")) {
    return true;
  }

  try {
    const parsedUrl = new URL(photoUrl);
    return parsedUrl.pathname.startsWith("/api/photo/");
  } catch {
    return false;
  }
}

export function canonicalizePhotoUrl(photoUrl: string) {
  if (photoUrl.startsWith("/api/photo/")) {
    return photoUrl;
  }

  try {
    const parsedUrl = new URL(photoUrl);
    if (parsedUrl.pathname.startsWith("/api/photo/")) {
      return parsedUrl.pathname;
    }
  } catch {
    return photoUrl;
  }

  return photoUrl;
}

export function normalizePhotoUrl(photoUrl: string, baseUrl = getAppBaseUrl()) {
  const canonicalPhotoUrl = canonicalizePhotoUrl(photoUrl);
  if (canonicalPhotoUrl.startsWith("/api/photo/")) {
    return baseUrl ? `${baseUrl}${canonicalPhotoUrl}` : canonicalPhotoUrl;
  }

  return canonicalPhotoUrl;
}