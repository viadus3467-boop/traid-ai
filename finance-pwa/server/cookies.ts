import type express from "express";

export const AUTH_COOKIE_NAME = "finora-auth";
export const GOOGLE_STATE_COOKIE_NAME = "finora-google-state";

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  if (!header) {
    return cookies;
  }

  for (const chunk of header.split(";")) {
    const separatorIndex = chunk.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = chunk.slice(0, separatorIndex).trim();
    const value = chunk.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    cookies.set(key, decodeURIComponent(value));
  }

  return cookies;
}

export function getCookie(request: express.Request, name: string): string | null {
  return parseCookies(request.headers.cookie).get(name) ?? null;
}

function isSecureRequest(request: express.Request) {
  if (request.secure) {
    return true;
  }

  const forwardedProto = request.headers["x-forwarded-proto"];
  return typeof forwardedProto === "string" && forwardedProto.split(",")[0]?.trim() === "https";
}

function baseCookieOptions(request: express.Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
  };
}

export function setSessionCookie(
  request: express.Request,
  response: express.Response,
  name: string,
  value: string,
  maxAge: number,
) {
  response.cookie(name, value, {
    ...baseCookieOptions(request),
    maxAge,
  });
}

export function clearCookie(request: express.Request, response: express.Response, name: string) {
  response.clearCookie(name, baseCookieOptions(request));
}
