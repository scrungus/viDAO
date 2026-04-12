import { PrivyClient } from "@privy-io/server-auth";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { User } from "@/generated/prisma/client";

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

type PrivyUser = Awaited<ReturnType<typeof privy.getUser>>;
export type { PrivyUser };

export async function getCurrentPrivyUser(): Promise<PrivyUser | null> {
  try {
    const cookieStore = await cookies();
    const { headers: headerStore } = await import("next/headers");
    const hdrs = await headerStore();

    // Get access token from cookie or Authorization header
    const accessToken =
      cookieStore.get("privy-token")?.value ??
      hdrs.get("authorization")?.replace("Bearer ", "");

    if (!accessToken) {
      console.log("[auth] No privy access token in cookie or header");
      return null;
    }

    // Verify the access token and get the user's Privy DID
    const verifiedClaims = await privy.verifyAuthToken(accessToken);
    const user = await privy.getUser(verifiedClaims.userId);
    console.log("[auth] Privy user:", user?.email?.address ?? user?.id);
    return user;
  } catch (err) {
    console.log("[auth] Privy token verification failed:", err);
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const privyUser = await getCurrentPrivyUser();
  if (!privyUser) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: privyUser.email?.address ?? "" },
        { walletAddress: privyUser.wallet?.address },
      ],
    },
  });

  return user;
}

export function getPrivyUserEmail(privyUser: PrivyUser): string | null {
  return privyUser.email?.address ?? null;
}

export function getPrivyUserWallet(privyUser: PrivyUser): string | null {
  return privyUser.wallet?.address ?? null;
}
