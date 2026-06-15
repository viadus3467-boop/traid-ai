import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { ApiError } from "./errors.js";
import { verifySessionToken } from "./security.js";
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
const app = express();

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

function getToken(request: express.Request): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  if (typeof request.headers["x-session-token"] === "string") {
    return request.headers["x-session-token"];
  }

  return null;
}

app.use(express.json({ limit: "4mb" }));

app.use("/api", (request, response, next) => {
  const publicPaths = new Set(["/health", "/auth/status", "/auth/unlock"]);

  if (publicPaths.has(request.path)) {
    next();
    return;
  }

  if (!store.hasPinConfigured()) {
    next();
    return;
  }

  const token = getToken(request);
  const isValid = token
    ? Boolean(verifySessionToken(token, sessionSecret, store.getSessionPinVersion()))
    : false;

  if (!isValid) {
    response.status(401).json({ message: "Требуется PIN-код." });
    return;
  }

  next();
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, appName: "Finora" });
});

app.get("/api/auth/status", (_request, response) => {
  response.json({
    appName: "Finora",
    hasPin: store.hasPinConfigured(),
  });
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
