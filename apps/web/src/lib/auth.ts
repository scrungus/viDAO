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

// Test-only auth bypass. Gated on TEST_AUTH_SECRET being non-empty at runtime
// AND the incoming request carrying a matching `x-test-auth-secret` header.
// The env var is only ever set by the Helm chart when `test.enabled=true`, so
// production pods cannot activate the bypass — the gate is the secret's
// presence, not NODE_ENV (Next.js dev mode forces NODE_ENV=development).
// Returns undefined to mean "not bypassed, continue the real flow"; null to
// mean "bypassed but user not found"; or a synthetic PrivyUser for a match.
async function tryTestAuthBypass(
  hdrs: Awaited<ReturnType<typeof import("next/headers").headers>>,
): Promise<PrivyUser | null | undefined> {
  const secret = process.env.TEST_AUTH_SECRET;
  if (!secret) return undefined;
  if (hdrs.get("x-test-auth-secret") !== secret) return undefined;

  const userId = hdrs.get("x-test-auth-user-id");
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!dbUser) return null;

  const synthetic = {
    id: `test:${dbUser.id}`,
    createdAt: dbUser.createdAt,
    linkedAccounts: [],
    email: { address: dbUser.email },
    wallet: dbUser.walletAddress ? { address: dbUser.walletAddress } : undefined,
  } as unknown as PrivyUser;
  return synthetic;
}

export async function getCurrentPrivyUser(): Promise<PrivyUser | null> {
  try {
    const cookieStore = await cookies();
    const { headers: headerStore } = await import("next/headers");
    const hdrs = await headerStore();

    const testBypass = await tryTestAuthBypass(hdrs);
    if (testBypass !== undefined) return testBypass;

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
