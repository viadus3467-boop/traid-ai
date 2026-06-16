import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type SessionPurpose = "auth" | "pin";

type SessionPayload = {
  userId: number;
  exp: number;
  purpose: SessionPurpose;
  version: string;
};

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");

  if (!salt || !derived) {
    return false;
  }

  const candidate = scryptSync(pin, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(derived, "hex"));
}

export function getPinVersion(pinHash: string | null): string {
  return createHash("sha256").update(pinHash ?? "no-pin").digest("hex").slice(0, 16);
}

export function getAuthVersion(googleSubject: string | null): string {
  return createHash("sha256").update(googleSubject ?? "no-google-owner").digest("hex").slice(0, 16);
}

function signPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function createSignedSessionToken(secret: string, purpose: SessionPurpose, version: string, userId = 1) {
  const payload: SessionPayload = {
    userId,
    exp: Date.now() + SESSION_TTL_MS,
    purpose,
    version,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(secret, encoded);

  return {
    token: `${encoded}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
  };
}

function verifySignedSessionToken(
  token: string,
  secret: string,
  purpose: SessionPurpose,
  version: string,
): SessionPayload | null {
  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expectedSignature = signPayload(secret, encoded);

  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;

    if (payload.exp < Date.now() || payload.purpose !== purpose || payload.version !== version) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createPinSessionToken(secret: string, pinVersion: string, userId = 1) {
  return createSignedSessionToken(secret, "pin", pinVersion, userId);
}

export function verifyPinSessionToken(token: string, secret: string, pinVersion: string): SessionPayload | null {
  return verifySignedSessionToken(token, secret, "pin", pinVersion);
}

export function createAuthSessionToken(secret: string, authVersion: string, userId = 1) {
  return createSignedSessionToken(secret, "auth", authVersion, userId);
}

export function verifyAuthSessionToken(token: string, secret: string, authVersion: string): SessionPayload | null {
  return verifySignedSessionToken(token, secret, "auth", authVersion);
}
