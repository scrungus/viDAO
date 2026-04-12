import { NextResponse } from "next/server";
import { getCurrentPrivyUser, type PrivyUser } from "./auth";
import { prisma } from "./prisma";
import type { User } from "@/generated/prisma/client";

/**
 * Wraps an API route handler to require authentication.
 * Injects the Privy user and (if registered) the DB user into the handler.
 */
export function withAuth(
  handler: (
    request: Request,
    context: { privyUser: PrivyUser; user: User | null },
  ) => Promise<NextResponse>,
) {
  return async (request: Request) => {
    const privyUser = await getCurrentPrivyUser();
    if (!privyUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = privyUser.email?.address;
    const walletAddress = privyUser.wallet?.address;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(walletAddress ? [{ walletAddress }] : []),
        ],
      },
    });

    return handler(request, { privyUser, user });
  };
}

/**
 * Like withAuth but also requires the user to exist in the DB.
 */
export function withRegisteredUser(
  handler: (
    request: Request,
    context: { privyUser: PrivyUser; user: User },
  ) => Promise<NextResponse>,
) {
  return withAuth(async (request, { privyUser, user }) => {
    if (!user) {
      return NextResponse.json(
        { error: "User not registered" },
        { status: 403 },
      );
    }
    return handler(request, { privyUser, user });
  });
}
