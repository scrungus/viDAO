"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function PrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!APP_ID) {
    return <>{children}</>;
  }
  return (
    <PrivyProviderBase
      appId={APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#7c3aed",
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
