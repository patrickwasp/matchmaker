"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConvexClientProvider>
      <SessionProvider>{children}</SessionProvider>
    </ConvexClientProvider>
  );
}
