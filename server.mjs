import http from "node:http";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activatePromoCode, getUserFromToken, loginUser, loginWithOauth, logoutToken, registerUser, updateUserSettings } from "./backend/auth.mjs";
import { getSnapshot } from "./backend/engine.mjs";
import { getUserActivityFromDb, registerSnapshotForUser } from "./backend/history.mjs";
import { createOauthAuthorizationUrl, createOauthState, exchangeOauthCode, getOauthProviderLabel } from "./backend/oauth.mjs";
import { filterMarketForUser, filterSignalsForUser, getVisibleSignalLimit, sortMarketForUser } from "./backend/preferences.mjs";
import { dispatchSignalPushes, getPushRuntimeConfig, removePushSubscription, savePushSubscription, sendTestPushNotification } from "./backend/push.mjs";
import { publicUser, readDb } from "./backend/store.mjs";
import {
  confirmStripePaymentSession,
  createPaymentSession,
  getPaymentProviders,
  handleNowPaymentsWebhook,
  handleStripeWebhook,
} from "./backend/payments/index.mjs";

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, ".env");
const SESSION_COOKIE_NAME = "trade_ai_session";
const OAUTH_COOKIE_NAME = "trade_ai_oauth";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const OAUTH_COOKIE_MAX_AGE = 60 * 10;
const PUSH_LOOP_MS = 75_000;
let pushLoopPromise = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

loadEnvFile();

function loadEnvFile() {
  if (!existsSync(envFile)) {
    return;
  }

  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/u, "$1");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function resolvePath(urlPath) {
  const pathname = new URL(urlPath || "/", `http://${host}:${port}`).pathname;
  const safePath = path.resolve(root, `.${pathname}`);

  if (!safePath.startsWith(root)) {
    return null;
  }

  return safePath;
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache");
  for (const [key, value] of Object.entries(extraHeaders)) {
    response.setHeader(key, value);
  }
  response.end(JSON.stringify(payload));
}

async function sendFile(filePath, response) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
}

async function readRawBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody(request) {
  const raw = await readRawBody(request);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON payload.");
  }
}

async function readFormBody(request) {
  const raw = await readRawBody(request);
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

function getRequestOrigin(request) {
  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProto || "http";
  const requestHost = forwardedHost || request.headers.host || `${host}:${port}`;
  return `${protocol}://${requestHost}`;
}

function parseCookies(request) {
  const header = String(request.headers.cookie || "");
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator === -1) {
          return [part, ""];
        }
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function createSessionCookie(token) {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function createOauthCookie(provider, state) {
  return `${OAUTH_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ provider, state }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_COOKIE_MAX_AGE}`;
}

function clearOauthCookie() {
  return `${OAUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getOauthCookie(request) {
  try {
    const raw = parseCookies(request)[OAUTH_COOKIE_NAME];
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAuthToken(request) {
  const authorization = String(request.headers.authorization || "");
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  const headerToken = String(request.headers["x-auth-token"] || "").trim();
  if (headerToken) {
    return headerToken;
  }

  return String(parseCookies(request)[SESSION_COOKIE_NAME] || "").trim();
}

async function getAuthedUser(request) {
  return getUserFromToken(getAuthToken(request));
}

function toResponseUser(user) {
  if (!user) {
    return null;
  }
  return "passwordHash" in user ? publicUser(user) : user;
}

function formatPublicSession(user, request) {
  return {
    ok: true,
    user: toResponseUser(user),
    payments: getPaymentProviders(getRequestOrigin(request)),
  };
}

function redirectToApp(response, request, params = {}, cookies = []) {
  const target = new URL("/", getRequestOrigin(request));
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      target.searchParams.set(key, String(value));
    }
  }

  response.statusCode = 302;
  response.setHeader("Location", target.toString());
  if (cookies.length) {
    response.setHeader("Set-Cookie", cookies);
  }
  response.end();
}

function getPairKey(pair) {
  return String(pair || "").replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function filterAnalytics(analytics, allowedIds) {
  if (!allowedIds?.size) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(analytics || {}).filter(([key]) => allowedIds.has(key)),
  );
}

function buildNoTradeZones(market) {
  return (market || [])
    .filter((entry) => entry.status === "no_trade" && entry.noTradeReason)
    .slice(0, 6)
    .map((entry) => ({
      pair: entry.pair,
      session: entry.session,
      sessionLabel: entry.sessionLabel,
      reason: entry.noTradeReason,
      summary: entry.summary,
    }));
}

function applyDashboardFilters(snapshot, user, pair) {
  const filteredMarket = sortMarketForUser(filterMarketForUser(snapshot.market || [], user, pair), user);
  const allowedIds = new Set(filteredMarket.map((entry) => entry.id));
  const filteredSignals = filterSignalsForUser(snapshot.signals || [], user, pair);
  const signalLimit = getVisibleSignalLimit(user);

  return {
    ...snapshot,
    signals: filteredSignals.slice(0, signalLimit),
    market: filteredMarket,
    analytics: filterAnalytics(snapshot.analytics || {}, allowedIds),
  };
}

async function buildAppPayload(snapshot, user, pair) {
  await registerSnapshotForUser(user, snapshot);
  const filtered = applyDashboardFilters(snapshot, user, pair);
  const db = await readDb();
  const activity = getUserActivityFromDb(db, user.id);

  return {
    ok: true,
    user: publicUser(user),
    ...filtered,
    signalHistory: activity.signalHistory,
    pushHistory: activity.pushHistory,
    noTradeZones: buildNoTradeZones(filtered.market),
  };
}

async function requireUser(request, response) {
  const user = await getAuthedUser(request);
  if (!user) {
    sendJson(response, 401, {
      ok: false,
      message: "Authentication required.",
    });
    return null;
  }

  return user;
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${host}:${port}`);
  const { pathname } = url;

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      app: "Trade Ai",
      time: new Date().toISOString(),
    });
    return true;
  }

  if (pathname === "/api/session" && request.method === "GET") {
    const user = await getAuthedUser(request);
    sendJson(response, 200, user ? formatPublicSession(user, request) : { ok: true, user: null, payments: getPaymentProviders(getRequestOrigin(request)) });
    return true;
  }

  if (pathname === "/api/push/config" && request.method === "GET") {
    const config = await getPushRuntimeConfig();
    sendJson(response, 200, {
      ok: true,
      ...config,
    });
    return true;
  }

  if (pathname === "/api/auth/register" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const session = await registerUser(payload);
      sendJson(response, 201, {
        ok: true,
        token: session.token,
        user: session.user,
        payments: getPaymentProviders(getRequestOrigin(request)),
      }, {
        "Set-Cookie": createSessionCookie(session.token),
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/auth/oauth/start" && request.method === "GET") {
    const provider = String(url.searchParams.get("provider") || "").trim().toLowerCase();
    if (!provider) {
      sendJson(response, 400, {
        ok: false,
        message: "OAuth provider is required.",
      });
      return true;
    }

    try {
      const state = createOauthState();
      const redirectUrl = createOauthAuthorizationUrl(provider, getRequestOrigin(request), state);
      sendJson(response, 200, {
        ok: true,
        provider,
        url: redirectUrl,
      }, {
        "Set-Cookie": createOauthCookie(provider, state),
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (
    (pathname === "/api/auth/oauth/callback/google" && request.method === "GET")
    || (pathname === "/api/auth/oauth/callback/apple" && (request.method === "GET" || request.method === "POST"))
  ) {
    const provider = pathname.endsWith("/google") ? "google" : "apple";

    try {
      const payload = request.method === "POST"
        ? await readFormBody(request)
        : Object.fromEntries(url.searchParams.entries());
      const storedOauth = getOauthCookie(request);
      const incomingState = String(payload.state || "").trim();

      if (!storedOauth || storedOauth.provider !== provider || !incomingState || storedOauth.state !== incomingState) {
        throw new Error("Sign-in session expired. Please try again.");
      }

      const oauthProfile = await exchangeOauthCode(provider, getRequestOrigin(request), payload);
      const session = await loginWithOauth(oauthProfile);

      redirectToApp(response, request, {
        oauth: "success",
        provider,
      }, [
        createSessionCookie(session.token),
        clearOauthCookie(),
      ]);
    } catch (error) {
      redirectToApp(response, request, {
        oauth: "error",
        provider,
        message: error instanceof Error ? error.message : `${getOauthProviderLabel(provider)} sign-in failed.`,
      }, [
        clearOauthCookie(),
      ]);
    }
    return true;
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const session = await loginUser(payload);
      sendJson(response, 200, {
        ok: true,
        token: session.token,
        user: session.user,
        payments: getPaymentProviders(getRequestOrigin(request)),
      }, {
        "Set-Cookie": createSessionCookie(session.token),
      });
    } catch (error) {
      sendJson(response, 401, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    await logoutToken(getAuthToken(request));
    sendJson(response, 200, {
      ok: true,
    }, {
      "Set-Cookie": clearSessionCookie(),
    });
    return true;
  }

  if (pathname === "/api/profile" && request.method === "PATCH") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const payload = await readJsonBody(request);
      const updatedUser = await updateUserSettings(user.id, payload);
      sendJson(response, 200, formatPublicSession(updatedUser, request));
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/promo/activate" && request.method === "POST") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const payload = await readJsonBody(request);
      const updatedUser = await activatePromoCode(user.id, payload.code);
      sendJson(response, 200, formatPublicSession(updatedUser, request));
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/push/subscribe" && request.method === "POST") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const payload = await readJsonBody(request);
      const result = await savePushSubscription(user.id, payload.subscription);
      sendJson(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/push/unsubscribe" && request.method === "POST") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const payload = await readJsonBody(request);
      const result = await removePushSubscription(user.id, payload.endpoint);
      sendJson(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/push/test" && request.method === "POST") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const result = await sendTestPushNotification(user.id);
      sendJson(response, 200, {
        ok: true,
        ...result,
      });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/payments/providers" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      providers: getPaymentProviders(getRequestOrigin(request)),
    });
    return true;
  }

  if (pathname === "/api/payments/checkout" && request.method === "POST") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const payload = await readJsonBody(request);
      const provider = payload.provider === "crypto" ? "crypto" : "stripe";
      const session = await createPaymentSession({
        provider,
        user,
        origin: getRequestOrigin(request),
      });

      if (provider === "crypto") {
        sendJson(response, 200, {
          ok: true,
          mode: "crypto",
          invoice: session,
        });
      } else {
        sendJson(response, 200, {
          ok: true,
          mode: "redirect",
          checkoutUrl: session.url,
          sessionId: session.id,
        });
      }
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/payments/confirm" && request.method === "GET") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    const sessionId = String(url.searchParams.get("session_id") || "").trim();
    if (!sessionId) {
      sendJson(response, 400, {
        ok: false,
        message: "Missing Stripe session_id.",
      });
      return true;
    }

    try {
      const updatedUser = await confirmStripePaymentSession(sessionId);
      sendJson(response, 200, formatPublicSession(updatedUser, request));
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/webhooks/stripe" && request.method === "POST") {
    try {
      const rawBody = await readRawBody(request);
      await handleStripeWebhook(rawBody, String(request.headers["stripe-signature"] || ""));
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/webhooks/nowpayments" && request.method === "POST") {
    try {
      const rawBody = await readRawBody(request);
      await handleNowPaymentsWebhook(rawBody, String(request.headers["x-nowpayments-sig"] || ""));
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/dashboard" && request.method === "GET") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const pair = url.searchParams.get("pair");
      const snapshot = await getSnapshot(false);
      sendJson(response, 200, await buildAppPayload(snapshot, user, pair));
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: "Live market providers are temporarily unavailable.",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/market" && request.method === "GET") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const pair = url.searchParams.get("pair");
      const snapshot = await getSnapshot(false);
      sendJson(response, 200, await buildAppPayload(snapshot, user, pair));
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: "Live market providers are temporarily unavailable.",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  if (pathname === "/api/refresh" && request.method === "GET") {
    const user = await requireUser(request, response);
    if (!user) {
      return true;
    }

    try {
      const pair = url.searchParams.get("pair");
      const snapshot = await getSnapshot(true);
      sendJson(response, 200, await buildAppPayload(snapshot, user, pair));
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        message: "Live market providers are temporarily unavailable.",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  return false;
}

async function runPushLoop() {
  if (pushLoopPromise) {
    return pushLoopPromise;
  }

  pushLoopPromise = (async () => {
    try {
      const snapshot = await getSnapshot(true);
      await dispatchSignalPushes(snapshot);
    } catch (error) {
      console.error("Trade Ai push loop error:", error instanceof Error ? error.message : String(error));
    } finally {
      pushLoopPromise = null;
    }
  })();

  return pushLoopPromise;
}

const server = http.createServer(async (request, response) => {
  if ((request.url || "").startsWith("/api/")) {
    const handled = await handleApi(request, response);
    if (handled) {
      return;
    }
  }

  const requestedPath = resolvePath(request.url);
  if (!requestedPath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  let filePath = requestedPath;

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    await sendFile(filePath, response);
  } catch {
    if (path.extname(filePath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    await sendFile(path.join(root, "index.html"), response);
  }
});

server.listen(port, host, () => {
  console.log(`Trade Ai is running at http://${host}:${port}`);
  void runPushLoop();
  setInterval(() => {
    void runPushLoop();
  }, PUSH_LOOP_MS);
});
