import { randomBytes } from "node:crypto";
import type express from "express";
import { ApiError } from "./errors.js";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

function getBaseUrl(request: express.Request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol =
    typeof forwardedProto === "string" && forwardedProto.trim()
      ? forwardedProto.split(",")[0].trim()
      : request.protocol;
  const host = request.get("host");

  return `${protocol}://${host}`;
}

export class GoogleAuth {
  private clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  private clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  private redirectUriOverride = process.env.GOOGLE_REDIRECT_URI?.trim() ?? "";

  public isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  public createState() {
    return randomBytes(24).toString("hex");
  }

  public getRedirectUri(request: express.Request) {
    return this.redirectUriOverride || `${getBaseUrl(request)}/api/auth/google/callback`;
  }

  public getAppRedirectUrl(request: express.Request, params?: Record<string, string>) {
    const url = new URL("/", getBaseUrl(request));
    url.hash = "home";

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  public getAuthorizationUrl(request: express.Request, state: string) {
    if (!this.isConfigured()) {
      throw new ApiError(503, "Google OAuth не настроен на сервере.");
    }

    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.getRedirectUri(request));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "select_account");

    return url.toString();
  }

  public async exchangeCode(request: express.Request, code: string): Promise<GoogleIdentity> {
    if (!this.isConfigured()) {
      throw new ApiError(503, "Google OAuth не настроен на сервере.");
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.getRedirectUri(request),
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new ApiError(502, "Не удалось получить токен Google.");
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new ApiError(502, "Google не вернул access token.");
    }

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new ApiError(502, "Не удалось получить профиль Google.");
    }

    const profile = (await userResponse.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.sub || !profile.email || !profile.email_verified) {
      throw new ApiError(400, "Google аккаунт должен иметь подтверждённый email.");
    }

    return {
      subject: profile.sub,
      email: profile.email,
      name: profile.name?.trim() || profile.email,
      avatarUrl: profile.picture?.trim() || null,
    };
  }
}
