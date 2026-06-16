import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { clearCookie, getCookie, setSessionCookie, AUTH_COOKIE_NAME, GOOGLE_STATE_COOKIE_NAME } from "./cookies.js";
import { ApiError } from "./errors.js";
import { GoogleAuth } from "./google-auth.js";
import { verifyAuthSessionToken, verifyPinSessionToken, createAuthSessionToken } from "./security.js";
import { SnapshotSync } from "./snapshot-sync.js";
import { FinanceStore } from "./store.js";
import { PERIOD_KEYS } from "./constants.js";
import { isValidDateKey, todayKey } from "./date.js";
import type { PeriodKey, TransactionType } from "./types.js";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const databasePath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "data/finance.sqlite");
const port = Number(process.env.PORT || 3001);
const sessionSecret = process.env.SESSION_SECRET ?? `${databasePath}:finora`;
const store = new FinanceStore(databasePath, sessionSecret);
const snapshotSync = new SnapshotSync(process.env.DATABASE_URL);
await snapshotSync.init(store);
const googleAuth = new GoogleAuth();
const app = express();

const SESSION_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

app.set("trust proxy", 1);

function getPeriod(value: unknown): PeriodKey {
  if (typeof value === "string" && PERIOD_KEYS.includes(value as PeriodKey)) {
    return value as PeriodKey;
  }

  return "month";
}

function getAnchor(value: unknown): string {
  if (typeof value === "string" && isValidDateKey(value)) {
    return value;
  }

  return todayKey();
}

function getPinToken(request: express.Request): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  if (typeof request.headers["x-session-token"] === "string") {
    return request.headers["x-session-token"];
  }

  return null;
}

function getGoogleAuthSession(request: express.Request) {
  if (!googleAuth.isConfigured()) {
    return null;
  }

  const token = getCookie(request, AUTH_COOKIE_NAME);
  if (!token) {
    return null;
  }

  return verifyAuthSessionToken(token, sessionSecret, store.getAuthSessionVersion());
}

function isPinUnlocked(request: express.Request) {
  if (!store.hasPinConfigured()) {
    return true;
  }

  const token = getPinToken(request);
  return token ? Boolean(verifyPinSessionToken(token, sessionSecret, store.getSessionPinVersion())) : false;
}

function getAuthStatusPayload(request: express.Request) {
  const googleAuthEnabled = googleAuth.isConfigured();
  const authSession = getGoogleAuthSession(request);
  const isAuthenticated = !googleAuthEnabled || Boolean(authSession);
  const pinUnlocked = !isAuthenticated ? false : isPinUnlocked(request);

  return {
    appName: "Finora",
    googleAuthEnabled,
    isAuthenticated,
    pinUnlocked,
    hasPin: store.hasPinConfigured(),
    googleLoginUrl: googleAuthEnabled ? "/api/auth/google/start" : null,
    user: isAuthenticated ? store.getUserProfile() : null,
  };
}

function redirectToApp(request: express.Request, response: express.Response, params?: Record<string, string>) {
  response.redirect(302, googleAuth.getAppRedirectUrl(request, params));
}

app.use(express.json({ limit: "4mb" }));

app.use("/api", (request, response, next) => {
  const googleAuthEnabled = googleAuth.isConfigured();
  const googleSession = getGoogleAuthSession(request);

  const alwaysPublicPaths = new Set([
    "/health",
    "/auth/status",
    "/auth/google/start",
    "/auth/google/callback",
    "/auth/logout",
  ]);

  if (alwaysPublicPaths.has(request.path)) {
    next();
    return;
  }

  if (request.path === "/auth/unlock") {
    if (googleAuthEnabled && !googleSession) {
      response.status(401).json({ message: "Требуется вход через Google." });
      return;
    }

    next();
    return;
  }

  if (googleAuthEnabled && !googleSession) {
    response.status(401).json({ message: "Требуется вход через Google." });
    return;
  }

  if (!store.hasPinConfigured()) {
    next();
    return;
  }

  if (!isPinUnlocked(request)) {
    response.status(401).json({ message: "Требуется PIN-код." });
    return;
  }

  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, appName: "Finora" });
});

app.get("/api/auth/status", (request, response) => {
  response.json(getAuthStatusPayload(request));
});

app.get("/api/auth/google/start", (request, response) => {
  if (!googleAuth.isConfigured()) {
    throw new ApiError(503, "Google OAuth не настроен на сервере.");
  }

  const state = googleAuth.createState();
  setSessionCookie(request, response, GOOGLE_STATE_COOKIE_NAME, state, 1000 * 60 * 10);
  response.redirect(302, googleAuth.getAuthorizationUrl(request, state));
});

app.get("/api/auth/google/callback", async (request, response) => {
  if (!googleAuth.isConfigured()) {
    redirectToApp(request, response, { authError: "Google OAuth не настроен на сервере." });
    return;
  }

  const providerError = typeof request.query.error === "string" ? request.query.error : null;
  if (providerError) {
    clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
    redirectToApp(request, response, { authError: "Вход через Google был отменён или отклонён." });
    return;
  }

  const expectedState = getCookie(request, GOOGLE_STATE_COOKIE_NAME);
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const code = typeof request.query.code === "string" ? request.query.code : "";

  if (!expectedState || !state || expectedState !== state) {
    clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
    redirectToApp(request, response, { authError: "Не удалось проверить безопасный вход через Google." });
    return;
  }

  if (!code) {
    clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
    redirectToApp(request, response, { authError: "Google не вернул код авторизации." });
    return;
  }

  try {
    const identity = await googleAuth.exchangeCode(request, code);
    const user = store.completeGoogleSignIn(identity);
    const authSession = createAuthSessionToken(sessionSecret, store.getAuthSessionVersion(), user.id);
    setSessionCookie(request, response, AUTH_COOKIE_NAME, authSession.token, SESSION_COOKIE_MAX_AGE);
    clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
    await snapshotSync.save(store);
    redirectToApp(request, response, { auth: "google" });
  } catch (error) {
    clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
    const message = error instanceof ApiError ? error.message : "Не удалось войти через Google.";
    redirectToApp(request, response, { authError: message });
  }
});

app.post("/api/auth/logout", (request, response) => {
  clearCookie(request, response, AUTH_COOKIE_NAME);
  clearCookie(request, response, GOOGLE_STATE_COOKIE_NAME);
  response.status(204).send();
});

app.post("/api/auth/unlock", (request, response) => {
  const pin = typeof request.body?.pin === "string" ? request.body.pin : "";
  response.json(store.unlock(pin));
});

app.get("/api/bootstrap", (request, response) => {
  response.json(store.getBootstrap(getPeriod(request.query.period), getAnchor(request.query.anchor)));
});

app.get("/api/dashboard", (request, response) => {
  response.json(store.getDashboard(getPeriod(request.query.period), getAnchor(request.query.anchor)));
});

app.get("/api/statistics", (request, response) => {
  response.json(store.getStatistics(getPeriod(request.query.period), getAnchor(request.query.anchor)));
});

app.get("/api/family", (_request, response) => {
  response.json({
    members: store.listFamilyMembers(),
    insights: store.getFamilyInsights(),
  });
});

app.post("/api/family", async (request, response) => {
  const result = store.createFamilyMember(request.body?.name);
  await snapshotSync.save(store);
  response.status(201).json(result);
});

app.put("/api/family/:id", async (request, response) => {
  const result = store.updateFamilyMember(Number(request.params.id), request.body?.name);
  await snapshotSync.save(store);
  response.json(result);
});

app.delete("/api/family/:id", async (request, response) => {
  store.deleteFamilyMember(Number(request.params.id));
  await snapshotSync.save(store);
  response.status(204).send();
});

app.get("/api/transactions", (request, response) => {
  const filters = {
    type:
      request.query.type === "income" || request.query.type === "expense"
        ? (request.query.type as TransactionType)
        : undefined,
    category: typeof request.query.category === "string" ? request.query.category : undefined,
    familyMemberId:
      typeof request.query.familyMemberId === "string" ? Number(request.query.familyMemberId) : undefined,
    from: typeof request.query.from === "string" ? request.query.from : undefined,
    to: typeof request.query.to === "string" ? request.query.to : undefined,
    search: typeof request.query.search === "string" ? request.query.search : undefined,
  };

  response.json({
    items: store.listTransactions(filters),
  });
});

app.get("/api/transactions/:id", (request, response) => {
  response.json(store.getTransaction(request.params.id));
});

app.post("/api/transactions", async (request, response) => {
  const result = store.createTransaction(request.body);
  await snapshotSync.save(store);
  response.status(201).json(result);
});

app.put("/api/transactions/:id", async (request, response) => {
  const result = store.updateTransaction(request.params.id, request.body);
  await snapshotSync.save(store);
  response.json(result);
});

app.delete("/api/transactions/:id", async (request, response) => {
  store.deleteTransaction(request.params.id);
  await snapshotSync.save(store);
  response.status(204).send();
});

app.get("/api/goals", (_request, response) => {
  response.json({ items: store.listGoals() });
});

app.post("/api/goals", async (request, response) => {
  const result = store.createGoal(request.body);
  await snapshotSync.save(store);
  response.status(201).json(result);
});

app.put("/api/goals/:id", async (request, response) => {
  const result = store.updateGoal(request.params.id, request.body);
  await snapshotSync.save(store);
  response.json(result);
});

app.post("/api/goals/:id/contribution", async (request, response) => {
  const result = store.addGoalContribution(request.params.id, Number(request.body?.amount));
  await snapshotSync.save(store);
  response.json(result);
});

app.delete("/api/goals/:id", async (request, response) => {
  store.deleteGoal(request.params.id);
  await snapshotSync.save(store);
  response.status(204).send();
});

app.get("/api/settings", (_request, response) => {
  response.json(store.getSettings());
});

app.put("/api/settings", async (request, response) => {
  const result = store.updateSettings(request.body);
  await snapshotSync.save(store);
  response.json(result);
});

app.put("/api/settings/pin", async (request, response) => {
  const nextPin =
    typeof request.body?.pin === "string" && request.body.pin.trim()
      ? String(request.body.pin).trim()
      : null;
  const currentPin =
    typeof request.body?.currentPin === "string" && request.body.currentPin.trim()
      ? String(request.body.currentPin).trim()
      : undefined;
  const result = store.setPin(nextPin, currentPin);
  await snapshotSync.save(store);
  response.json(result);
});

app.get("/api/export", (request, response) => {
  const format = typeof request.query.format === "string" ? request.query.format : "json";

  if (format === "csv") {
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", "attachment; filename=\"finora-transactions.csv\"");
    response.send(store.exportTransactionsCsv());
    return;
  }

  response.json(store.exportData());
});

app.post("/api/import", async (request, response) => {
  const mode = request.body?.mode === "merge" ? "merge" : "replace";
  const result = store.importData(request.body?.payload, mode);
  await snapshotSync.save(store);
  response.json(result);
});

app.post("/api/reset", async (request, response) => {
  const result = store.resetTransactions(
    typeof request.body?.confirmation === "string" ? request.body.confirmation : "",
    Boolean(request.body?.includeGoals),
    typeof request.body?.goalsConfirmation === "string" ? request.body.goalsConfirmation : undefined,
  );
  await snapshotSync.save(store);
  response.json(result);
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  console.error(error);
  response.status(500).json({ message: "Внутренняя ошибка сервера." });
});

const clientDir = [
  path.resolve(currentDir, "../client"),
  path.resolve(currentDir, "../dist/client"),
  path.resolve(process.cwd(), "dist/client"),
].find((candidate) => existsSync(candidate));

if (clientDir) {
  app.use(express.static(clientDir));
  app.use((request, response, next) => {
    if (request.method !== "GET" || request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Finora API listening on ${port}`);
});
