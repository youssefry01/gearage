import type { Gender, SecurityEventType } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import type { Tx } from "@/server/repositories/inventory.repository";

type Db = Tx | ReturnType<typeof getDb>;

// --- Profile -------------------------------------------------------------------------------------------------------

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date | null;
  gender: Gender | null;
  createdAt: Date;
};

export async function getProfile(userId: string, db: Db = getDb()): Promise<Profile | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      createdAt: true,
    },
  });
}

export type ProfileUpdate = {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date | null;
  gender: Gender | null;
};

/** Writes only the profile columns of the given account. `name` is the display name Better Auth requires. */
export async function updateProfile(
  userId: string,
  data: ProfileUpdate,
  now: Date,
  db: Db = getDb(),
): Promise<boolean> {
  const result = await db.user.updateMany({
    where: { id: userId },
    data: { ...data, name: `${data.firstName} ${data.lastName}`, updatedAt: now },
  });
  return result.count === 1;
}

// --- Sessions ------------------------------------------------------------------------------------------------------

/** What the sessions list may know about a session. The secret `token` is deliberately NOT selectable through here. */
export type SessionRow = {
  id: string;
  device: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
};

/** Live sessions of one account (never another's), newest activity first. */
export async function listSessions(
  userId: string,
  now: Date,
  limit: number,
  db: Db = getDb(),
): Promise<SessionRow[]> {
  return db.session.findMany({
    where: { userId, expiresAt: { gt: now } },
    select: { id: true, device: true, createdAt: true, updatedAt: true, expiresAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
}

/** Deletes one session, only if it belongs to `userId` and is not `keepSessionId`. Returns how many rows went. */
export async function deleteSession(
  userId: string,
  sessionId: string,
  keepSessionId: string,
  db: Db = getDb(),
): Promise<number> {
  const result = await db.session.deleteMany({
    where: { id: sessionId, userId, NOT: { id: keepSessionId } },
  });
  return result.count;
}

/** Deletes every session of `userId` except `keepSessionId`. Returns how many rows went. */
export async function deleteOtherSessions(
  userId: string,
  keepSessionId: string,
  db: Db = getDb(),
): Promise<number> {
  const result = await db.session.deleteMany({ where: { userId, NOT: { id: keepSessionId } } });
  return result.count;
}

// --- Security events -----------------------------------------------------------------------------------------------

export type SecurityEventRow = {
  id: string;
  type: SecurityEventType;
  device: string | null;
  createdAt: Date;
};

export async function insertSecurityEvent(
  event: { userId: string; type: SecurityEventType; device?: string | null; createdAt: Date },
  db: Db = getDb(),
): Promise<void> {
  await db.securityEvent.create({
    data: {
      userId: event.userId,
      type: event.type,
      device: event.type === "SIGN_IN" ? (event.device ?? null) : null,
      createdAt: event.createdAt,
    },
  });
}

export async function listSecurityEvents(
  userId: string,
  limit: number,
  db: Db = getDb(),
): Promise<SecurityEventRow[]> {
  return db.securityEvent.findMany({
    where: { userId },
    select: { id: true, type: true, device: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
}
