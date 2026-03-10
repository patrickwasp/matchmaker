"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useState } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

    if (!deploymentUrl) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
    }

    return new ConvexReactClient(deploymentUrl);
  });

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}