import { createPrivateKey, createSign, randomBytes } from "node:crypto";

function normalizeProvider(provider) {
  return String(provider || "").trim().toLowerCase();
}

function normalizePrivateKey(privateKey) {
  return String(privateKey || "").replace(/\\n/g, "\n").trim();
}

function base64UrlEncodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid identity token.");
  }

  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

function buildRedirectUri(origin, provider) {
  return new URL(`/api/auth/oauth/callback/${provider}`, origin).toString();
}

function getGoogleConfig(origin) {
  return {
    provider: "google",
    label: "Google",
    clientId: String(process.env.TRADE_AI_GOOGLE_CLIENT_ID || "").trim(),
    clientSecret: String(process.env.TRADE_AI_GOOGLE_CLIENT_SECRET || "").trim(),
    redirectUri: buildRedirectUri(origin, "google"),
  };
}

function getAppleConfig(origin) {
  return {
    provider: "apple",
    label: "Apple / iCloud",
    clientId: String(process.env.TRADE_AI_APPLE_CLIENT_ID || "").trim(),
    teamId: String(process.env.TRADE_AI_APPLE_TEAM_ID || "").trim(),
    keyId: String(process.env.TRADE_AI_APPLE_KEY_ID || "").trim(),
    privateKey: normalizePrivateKey(process.env.TRADE_AI_APPLE_PRIVATE_KEY),
    redirectUri: buildRedirectUri(origin, "apple"),
  };
}

function assertGoogleConfig(config) {
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google sign-in is not configured yet. Add Google client ID and secret in Render.");
  }
}

function assertAppleConfig(config) {
  if (!config.clientId || !config.teamId || !config.keyId || !config.privateKey) {
    throw new Error("Apple / iCloud sign-in is not configured yet. Apple developer credentials are required.");
  }
}

function createAppleClientSecret(config) {
  assertAppleConfig(config);

  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.teamId,
    iat: issuedAt,
    exp: issuedAt + 60 * 60 * 24 * 180,
    aud: "https://appleid.apple.com",
    sub: config.clientId,
  };

  const header = {
    alg: "ES256",
    kid: config.keyId,
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("SHA256")
    .update(signingInput)
    .end()
    .sign({
      key: createPrivateKey(config.privateKey),
      dsaEncoding: "ieee-p1363",
    })
    .toString("base64url");

  return `${signingInput}.${signature}`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const providerMessage = payload?.error_description || payload?.error || `HTTP ${response.status}`;
    throw new Error(String(providerMessage));
  }

  return payload;
}

function readAppleUserName(userPayload) {
  if (!userPayload) {
    return "";
  }

  try {
    const parsed = typeof userPayload === "string" ? JSON.parse(userPayload) : userPayload;
    const first = String(parsed?.name?.firstName || "").trim();
    const last = String(parsed?.name?.lastName || "").trim();
    return `${first} ${last}`.trim();
  } catch {
    return "";
  }
}

export function createOauthState() {
  return randomBytes(24).toString("hex");
}

export function getOauthProviderLabel(provider) {
  if (normalizeProvider(provider) === "google") {
    return "Google";
  }

  if (normalizeProvider(provider) === "apple") {
    return "Apple / iCloud";
  }

  return "OAuth";
}

export function createOauthAuthorizationUrl(provider, origin, state) {
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === "google") {
    const config = getGoogleConfig(origin);
    assertGoogleConfig(config);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (normalizedProvider === "apple") {
    const config = getAppleConfig(origin);
    assertAppleConfig(config);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state,
    });
    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  throw new Error("Unsupported OAuth provider.");
}

export async function exchangeOauthCode(provider, origin, payload) {
  const normalizedProvider = normalizeProvider(provider);
  const code = String(payload?.code || "").trim();

  if (!code) {
    throw new Error("Missing authorization code.");
  }

  if (normalizedProvider === "google") {
    const config = getGoogleConfig(origin);
    assertGoogleConfig(config);

    const tokenPayload = await fetchJson("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const profile = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    return {
      provider: "google",
      providerUserId: String(profile.sub || "").trim(),
      email: String(profile.email || "").trim(),
      name: String(profile.name || profile.given_name || "").trim(),
    };
  }

  if (normalizedProvider === "apple") {
    const config = getAppleConfig(origin);
    const clientSecret = createAppleClientSecret(config);

    const tokenPayload = await fetchJson("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
    });

    const identity = decodeJwtPayload(tokenPayload.id_token);
    const name = readAppleUserName(payload.user);

    return {
      provider: "apple",
      providerUserId: String(identity.sub || "").trim(),
      email: String(identity.email || "").trim(),
      name,
    };
  }

  throw new Error("Unsupported OAuth provider.");
}
