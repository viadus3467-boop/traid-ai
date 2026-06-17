import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  APP_NAME,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_TEMPLATES,
  DEFAULT_INCOME_SOURCES,
  GOAL_STATUS,
  MAX_NOTE_LENGTH,
  MAX_TEXT_LENGTH,
  PERIOD_KEYS,
  TRANSACTION_TYPES,
} from "./constants.js";
import { diffDays, enumerateDateKeys, getPeriodRange, isValidDateKey, monthKey, monthLabel, todayKey } from "./date.js";
import { ApiError } from "./errors.js";
import type { GoogleIdentity } from "./google-auth.js";
import { createPinSessionToken, getAuthVersion, getPinVersion, hashPin, verifyPin } from "./security.js";
import type {
  AggregateItem,
  AppSettings,
  BudgetAlert,
  DashboardSnapshot,
  ExportPayload,
  FamilyInsight,
  FamilyMember,
  GoalRecord,
  GoalStatus,
  PeriodKey,
  PersistenceSnapshot,
  StatisticsSnapshot,
  TransactionFilters,
  TransactionRecord,
  TransactionType,
  UserProfile,
  ExpenseTemplate,
  AuthProvider,
} from "./types.js";

type TransactionInput = {
  familyMemberId: number;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  note?: string;
  date: string;
};

type GoalInput = {
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  status?: GoalStatus;
};

type ValidatedGoalInput = {
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: GoalStatus;
};

type SettingsInput = Partial<{
  expenseCategories: string[];
  incomeSources: string[];
  categoryBudgets: Record<string, number>;
  expenseTemplates: ExpenseTemplate[];
}>;

type ImportMode = "replace" | "merge";

function nowIso(): string {
  return new Date().toISOString();
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function sanitizeText(value: unknown, fallback = "", maxLength = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim().slice(0, maxLength);
}

function uniqueStrings(values: unknown, fallback: string[]): string[] {
  if (!Array.isArray(values)) {
    return fallback;
  }

  const normalized = values
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .filter((value, index, items) => items.indexOf(value) === index);

  return normalized.length > 0 ? normalized : fallback;
}

function assert(condition: unknown, statusCode: number, message: string): asserts condition {
  if (!condition) {
    throw new ApiError(statusCode, message);
  }
}

function sumValues(items: TransactionRecord[], type: TransactionType): number {
  return roundMoney(items.filter((item) => item.type === type).reduce((total, item) => total + item.amount, 0));
}

function aggregate(items: TransactionRecord[], labelOf: (item: TransactionRecord) => string): AggregateItem[] {
  const bucket = new Map<string, number>();

  for (const item of items) {
    const label = labelOf(item);
    bucket.set(label, roundMoney((bucket.get(label) ?? 0) + item.amount));
  }

  return [...bucket.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

export class FinanceStore {
  private db: DatabaseSync;
  private sessionSecret: string;

  constructor(databasePath: string, sessionSecret: string) {
    const absolutePath = path.resolve(databasePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });

    this.db = new DatabaseSync(absolutePath);
    this.sessionSecret = sessionSecret;

    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);

    this.migrate();
    this.seed();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        pin_code_hash TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_member_id INTEGER NOT NULL REFERENCES family_members(id) ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL CHECK (amount > 0),
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saving_goals (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        target_amount REAL NOT NULL CHECK (target_amount > 0),
        current_amount REAL NOT NULL CHECK (current_amount >= 0),
        deadline TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'overdue')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        expense_categories TEXT NOT NULL,
        income_sources TEXT NOT NULL,
        category_budgets TEXT NOT NULL,
        expense_templates TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_family ON transactions(family_member_id);
      CREATE INDEX IF NOT EXISTS idx_goals_status ON saving_goals(status);
    `);

    const legacyUserColumns = new Set(
      this.db
        .prepare("PRAGMA table_info(users)")
        .all()
        .map((row) => String((row as { name: string }).name)),
    );
    const userTableSql = String(
      this.db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").get()?.sql ?? "",
    );

    if (userTableSql.includes("CHECK (id = 1)") || userTableSql.includes("CHECK(id = 1)")) {
      const pinHashColumn = legacyUserColumns.has("pin_code_hash") ? "pin_code_hash" : "NULL AS pin_code_hash";
      const emailColumn = legacyUserColumns.has("email") ? "email" : "NULL AS email";
      const avatarColumn = legacyUserColumns.has("avatar_url") ? "avatar_url" : "NULL AS avatar_url";
      const authProviderColumn = legacyUserColumns.has("auth_provider")
        ? "COALESCE(auth_provider, 'local') AS auth_provider"
        : "'local' AS auth_provider";
      const googleSubjectColumn = legacyUserColumns.has("google_subject") ? "google_subject" : "NULL AS google_subject";
      const lastLoginColumn = legacyUserColumns.has("last_login_at") ? "last_login_at" : "NULL AS last_login_at";

      this.db.exec("PRAGMA foreign_keys = OFF");
      this.db.exec("BEGIN IMMEDIATE");

      try {
        this.db.exec("ALTER TABLE users RENAME TO users_legacy");
        this.db.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            pin_code_hash TEXT,
            created_at TEXT NOT NULL,
            email TEXT,
            avatar_url TEXT,
            auth_provider TEXT NOT NULL DEFAULT 'local',
            google_subject TEXT,
            last_login_at TEXT
          );
        `);
        this.db.exec(`
          INSERT INTO users (id, name, pin_code_hash, created_at, email, avatar_url, auth_provider, google_subject, last_login_at)
          SELECT
            id,
            name,
            ${pinHashColumn},
            created_at,
            ${emailColumn},
            ${avatarColumn},
            ${authProviderColumn},
            ${googleSubjectColumn},
            ${lastLoginColumn}
          FROM users_legacy
        `);
        this.db.exec("DROP TABLE users_legacy");
        this.db.exec("COMMIT");
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      } finally {
        this.db.exec("PRAGMA foreign_keys = ON");
      }
    }

    const userColumns = new Set(
      this.db
        .prepare("PRAGMA table_info(users)")
        .all()
        .map((row) => String((row as { name: string }).name)),
    );

    const ensureUserColumn = (name: string, definition: string) => {
      if (!userColumns.has(name)) {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${definition}`);
      }
    };

    ensureUserColumn("email", "email TEXT");
    ensureUserColumn("avatar_url", "avatar_url TEXT");
    ensureUserColumn("auth_provider", "auth_provider TEXT NOT NULL DEFAULT 'local'");
    ensureUserColumn("google_subject", "google_subject TEXT");
    ensureUserColumn("last_login_at", "last_login_at TEXT");
    this.db.prepare("UPDATE users SET auth_provider = COALESCE(auth_provider, 'local')").run();
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject
      ON users(google_subject)
      WHERE google_subject IS NOT NULL;
    `);
  }

  private seed() {
    const now = nowIso();
    const usersCount = Number(this.db.prepare("SELECT COUNT(*) AS count FROM users").get()?.count ?? 0);
    if (usersCount === 0) {
      this.db.prepare("INSERT INTO users (id, name, created_at, auth_provider) VALUES (1, ?, ?, 'local')").run("Я", now);
    }

    this.ensureUserResources(1, "Я");
  }

  private withTransaction<T>(callback: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private settingsRowToModel(row: any): AppSettings {
    return {
      expenseCategories: uniqueStrings(JSON.parse(row.expense_categories), DEFAULT_EXPENSE_CATEGORIES),
      incomeSources: uniqueStrings(JSON.parse(row.income_sources), DEFAULT_INCOME_SOURCES),
      categoryBudgets: this.normalizeBudgets(JSON.parse(row.category_budgets)),
      expenseTemplates: this.normalizeTemplates(JSON.parse(row.expense_templates)),
      updatedAt: String(row.updated_at),
    };
  }

  private createDefaultSettings(updatedAt = nowIso()): AppSettings {
    return {
      expenseCategories: [...DEFAULT_EXPENSE_CATEGORIES],
      incomeSources: [...DEFAULT_INCOME_SOURCES],
      categoryBudgets: {},
      expenseTemplates: [...DEFAULT_EXPENSE_TEMPLATES],
      updatedAt,
    };
  }

  private saveSettings(userId: number, next: AppSettings): AppSettings {
    this.db
      .prepare(
        `INSERT INTO app_settings (user_id, expense_categories, income_sources, category_budgets, expense_templates, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id)
         DO UPDATE SET
           expense_categories = excluded.expense_categories,
           income_sources = excluded.income_sources,
           category_budgets = excluded.category_budgets,
           expense_templates = excluded.expense_templates,
           updated_at = excluded.updated_at`,
      )
      .run(
        userId,
        JSON.stringify(next.expenseCategories),
        JSON.stringify(next.incomeSources),
        JSON.stringify(next.categoryBudgets),
        JSON.stringify(next.expenseTemplates),
        next.updatedAt,
      );

    return next;
  }

  private ensureUserResources(userId: number, familyMemberName = "Я") {
    const nextMemberName = sanitizeText(familyMemberName, "Я") || "Я";
    const membersCount = Number(
      this.db.prepare("SELECT COUNT(*) AS count FROM family_members WHERE user_id = ?").get(userId)?.count ?? 0,
    );

    if (membersCount === 0) {
      this.db.prepare("INSERT INTO family_members (user_id, name, created_at) VALUES (?, ?, ?)").run(userId, nextMemberName, nowIso());
    }

    const settingsRow = this.db.prepare("SELECT user_id FROM app_settings WHERE user_id = ?").get(userId);
    if (!settingsRow) {
      this.saveSettings(userId, this.createDefaultSettings());
    }
  }

  private normalizeBudgets(value: unknown): Record<string, number> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    const result: Record<string, number> = {};

    for (const [key, rawAmount] of Object.entries(value)) {
      const label = sanitizeText(key);
      const amount = Number(rawAmount);

      if (label && Number.isFinite(amount) && amount > 0) {
        result[label] = roundMoney(amount);
      }
    }

    return result;
  }

  private normalizeTemplates(value: unknown): ExpenseTemplate[] {
    if (!Array.isArray(value)) {
      return [...DEFAULT_EXPENSE_TEMPLATES];
    }

    const templates = value
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const label = sanitizeText((item as any).label);
        const category = sanitizeText((item as any).category);

        if (!label || !category) {
          return null;
        }

        const amountValue = Number((item as any).amount);

        return {
          id: sanitizeText((item as any).id, randomUUID(), 60),
          label,
          category,
          amount: Number.isFinite(amountValue) && amountValue > 0 ? roundMoney(amountValue) : null,
          description: sanitizeText((item as any).description, label),
          note: sanitizeText((item as any).note, "", MAX_NOTE_LENGTH),
        } satisfies ExpenseTemplate;
      })
      .filter((item): item is ExpenseTemplate => item !== null);

    return templates.length > 0 ? templates : [...DEFAULT_EXPENSE_TEMPLATES];
  }

  private transactionRowToModel(row: any): TransactionRecord {
    return {
      id: String(row.id),
      userId: Number(row.user_id),
      familyMemberId: Number(row.family_member_id),
      familyMemberName: String(row.family_member_name),
      type: row.type as TransactionType,
      amount: Number(row.amount),
      category: String(row.category),
      description: String(row.description),
      note: String(row.note),
      date: String(row.date),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private goalRowToModel(row: any): GoalRecord {
    const deadline = row.deadline ? String(row.deadline) : null;
    const targetAmount = Number(row.target_amount);
    const currentAmount = Number(row.current_amount);
    const status = this.deriveGoalStatus(targetAmount, currentAmount, deadline);
    const remainingAmount = roundMoney(Math.max(0, targetAmount - currentAmount));
    const progressPercent = targetAmount > 0 ? Math.min(100, roundMoney((currentAmount / targetAmount) * 100)) : 0;
    const daysLeft = deadline ? Math.max(0, diffDays(deadline, todayKey())) : null;
    const dailyTarget = deadline && daysLeft && remainingAmount > 0 ? roundMoney(remainingAmount / daysLeft) : null;
    const weeklyTarget = dailyTarget !== null ? roundMoney(dailyTarget * 7) : null;

    return {
      id: String(row.id),
      userId: Number(row.user_id),
      title: String(row.title),
      targetAmount,
      currentAmount,
      deadline,
      status,
      remainingAmount,
      progressPercent,
      daysLeft,
      dailyTarget,
      weeklyTarget,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private deriveGoalStatus(targetAmount: number, currentAmount: number, deadline: string | null): GoalStatus {
    if (currentAmount >= targetAmount) {
      return "completed";
    }

    if (deadline && deadline < todayKey()) {
      return "overdue";
    }

    return "active";
  }

  private syncGoalStatuses(userId: number): GoalRecord[] {
    const rows = this.db.prepare("SELECT * FROM saving_goals WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
    const goals = rows.map((row) => this.goalRowToModel(row));
    const now = nowIso();

    for (const goal of goals) {
      const stored = rows.find((row) => String(row.id) === goal.id);
      if (stored && String(stored.status) !== goal.status) {
        this.db
          .prepare("UPDATE saving_goals SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?")
          .run(goal.status, now, goal.id, userId);
        goal.updatedAt = now;
      }
    }

    return goals.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private queryTransactionsBase(userId: number): TransactionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT
          t.*,
          fm.name AS family_member_name
        FROM transactions t
        JOIN family_members fm ON fm.id = t.family_member_id
        WHERE t.user_id = ? AND fm.user_id = ?
        ORDER BY t.date DESC, t.created_at DESC`,
      )
      .all(userId, userId);

    return rows.map((row) => this.transactionRowToModel(row));
  }

  private ensureFamilyMemberExists(userId: number, id: number) {
    const row = this.db.prepare("SELECT id FROM family_members WHERE id = ? AND user_id = ?").get(id, userId);
    assert(row, 404, "Член семьи не найден.");
  }

  private validateTransactionInput(userId: number, input: TransactionInput): TransactionInput {
    const type = input.type;
    assert(TRANSACTION_TYPES.includes(type), 400, "Некорректный тип операции.");

    const amount = Number(input.amount);
    assert(Number.isFinite(amount) && amount > 0, 400, "Сумма должна быть больше 0.");
    assert(isValidDateKey(input.date), 400, "Укажите корректную дату операции.");

    const category = sanitizeText(input.category);
    assert(category, 400, "Укажите категорию или источник.");

    const familyMemberId = Number(input.familyMemberId);
    assert(Number.isInteger(familyMemberId) && familyMemberId > 0, 400, "Укажите члена семьи.");
    this.ensureFamilyMemberExists(userId, familyMemberId);

    return {
      type,
      amount: roundMoney(amount),
      date: input.date,
      category,
      familyMemberId,
      description: sanitizeText(input.description),
      note: sanitizeText(input.note, "", MAX_NOTE_LENGTH),
    };
  }

  private validateGoalInput(input: GoalInput): ValidatedGoalInput {
    const title = sanitizeText(input.title);
    assert(title, 400, "Укажите название цели.");

    const targetAmount = Number(input.targetAmount);
    const currentAmount = Number(input.currentAmount);
    assert(Number.isFinite(targetAmount) && targetAmount > 0, 400, "Нужная сумма должна быть больше 0.");
    assert(Number.isFinite(currentAmount) && currentAmount >= 0, 400, "Текущая сумма не может быть отрицательной.");

    const deadline = input.deadline ? sanitizeText(input.deadline) : null;
    if (deadline) {
      assert(isValidDateKey(deadline), 400, "Укажите корректный дедлайн.");
    }

    const status = this.deriveGoalStatus(targetAmount, currentAmount, deadline);

    return {
      title,
      targetAmount: roundMoney(targetAmount),
      currentAmount: roundMoney(currentAmount),
      deadline,
      status,
    };
  }

  public getAppMetadata() {
    return { appName: APP_NAME };
  }

  public hasUser(userId: number): boolean {
    return Boolean(this.getUserRowById(userId));
  }

  private getUserRowById(userId: number) {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }

  private getUserRowByGoogleSubject(subject: string) {
    return this.db.prepare("SELECT * FROM users WHERE google_subject = ?").get(subject);
  }

  private getRawPinHash(userId: number): string | null {
    const row = this.getUserRowById(userId);
    return row?.pin_code_hash ? String(row.pin_code_hash) : null;
  }

  private getGoogleSubject(userId: number): string | null {
    const row = this.getUserRowById(userId);
    return row?.google_subject ? String(row.google_subject) : null;
  }

  private getStoredAuthProvider(row: any): AuthProvider {
    return row?.auth_provider === "google" ? "google" : "local";
  }

  public getUserProfile(userId: number): UserProfile {
    const row = this.getUserRowById(userId);
    assert(row, 500, "Пользователь не инициализирован.");
    return {
      id: Number(row.id),
      name: String(row.name),
      email: row.email ? String(row.email) : null,
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
      authProvider: this.getStoredAuthProvider(row),
      googleLinked: Boolean(row.google_subject),
      hasPin: Boolean(row.pin_code_hash),
      createdAt: String(row.created_at),
      lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    };
  }

  public hasPinConfigured(userId: number): boolean {
    return Boolean(this.getRawPinHash(userId));
  }

  public getAuthSessionVersion(userId: number) {
    return getAuthVersion(this.getGoogleSubject(userId));
  }

  public isGoogleLinked(userId: number) {
    return Boolean(this.getGoogleSubject(userId));
  }

  public completeGoogleSignIn(identity: GoogleIdentity) {
    const now = nowIso();
    const nextName = sanitizeText(identity.name, identity.email) || identity.email;
    const nextEmail = sanitizeText(identity.email, "", 160) || null;
    const nextAvatarUrl = sanitizeText(identity.avatarUrl ?? "", "", 500) || null;
    const existingRow = this.getUserRowByGoogleSubject(identity.subject);

    if (existingRow) {
      const userId = Number(existingRow.id);
      this.db
        .prepare(
          "UPDATE users SET name = ?, email = ?, avatar_url = ?, auth_provider = ?, google_subject = ?, last_login_at = ? WHERE id = ?",
        )
        .run(nextName, nextEmail, nextAvatarUrl, "google", identity.subject, now, userId);
      this.ensureUserResources(userId, "Я");
      return this.getUserProfile(userId);
    }

    const result = this.db
      .prepare(
        "INSERT INTO users (name, pin_code_hash, created_at, email, avatar_url, auth_provider, google_subject, last_login_at) VALUES (?, NULL, ?, ?, ?, 'google', ?, ?)",
      )
      .run(nextName, now, nextEmail, nextAvatarUrl, identity.subject, now);
    const userId = Number(result.lastInsertRowid);
    this.ensureUserResources(userId, "Я");
    return this.getUserProfile(userId);
  }

  public getSettings(userId: number): AppSettings {
    const row = this.db.prepare("SELECT * FROM app_settings WHERE user_id = ?").get(userId);
    if (!row) {
      this.ensureUserResources(userId, "Я");
      return this.getSettings(userId);
    }
    return this.settingsRowToModel(row);
  }

  public listFamilyMembers(userId: number): FamilyMember[] {
    return this.db
      .prepare("SELECT id, name, created_at FROM family_members WHERE user_id = ? ORDER BY created_at ASC")
      .all(userId)
      .map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
      }));
  }

  public createFamilyMember(userId: number, name: string): FamilyMember {
    const trimmed = sanitizeText(name);
    assert(trimmed, 400, "Введите имя члена семьи.");
    const now = nowIso();
    const result = this.db
      .prepare("INSERT INTO family_members (user_id, name, created_at) VALUES (?, ?, ?)")
      .run(userId, trimmed, now);
    return {
      id: Number(result.lastInsertRowid),
      name: trimmed,
      createdAt: now,
    };
  }

  public updateFamilyMember(userId: number, id: number, name: string): FamilyMember {
    this.ensureFamilyMemberExists(userId, id);
    const trimmed = sanitizeText(name);
    assert(trimmed, 400, "Введите имя члена семьи.");
    this.db.prepare("UPDATE family_members SET name = ? WHERE id = ? AND user_id = ?").run(trimmed, id, userId);
    return this.listFamilyMembers(userId).find((member) => member.id === id)!;
  }

  public deleteFamilyMember(userId: number, id: number) {
    const members = this.listFamilyMembers(userId);
    const member = members.find((item) => item.id === id);
    assert(member, 404, "Член семьи не найден.");
    assert(members.length > 1, 400, "Нельзя удалить последнего участника семьи.");

    const fallbackMember = members.find((item) => item.id !== id);
    assert(fallbackMember, 400, "Нужен хотя бы один участник семьи.");

    this.withTransaction(() => {
      this.db
        .prepare("UPDATE transactions SET family_member_id = ? WHERE user_id = ? AND family_member_id = ?")
        .run(fallbackMember.id, userId, id);
      this.db.prepare("DELETE FROM family_members WHERE id = ? AND user_id = ?").run(id, userId);
    });
  }

  public listTransactions(userId: number, filters: TransactionFilters = {}): TransactionRecord[] {
    return this.queryTransactionsBase(userId).filter((item) => {
      if (filters.type && item.type !== filters.type) {
        return false;
      }

      if (filters.category && item.category !== filters.category) {
        return false;
      }

      if (filters.familyMemberId && item.familyMemberId !== filters.familyMemberId) {
        return false;
      }

      if (filters.from && item.date < filters.from) {
        return false;
      }

      if (filters.to && item.date > filters.to) {
        return false;
      }

      if (filters.search) {
        const haystack = `${item.description} ${item.note} ${item.category} ${item.familyMemberName}`.toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }

  public getTransaction(userId: number, id: string): TransactionRecord {
    const transaction = this.listTransactions(userId).find((item) => item.id === id);
    assert(transaction, 404, "Операция не найдена.");
    return transaction;
  }

  public createTransaction(userId: number, input: TransactionInput): TransactionRecord {
    const validated = this.validateTransactionInput(userId, input);
    const now = nowIso();
    const id = randomUUID();

    this.db
      .prepare(
        "INSERT INTO transactions (id, user_id, family_member_id, type, amount, category, description, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        userId,
        validated.familyMemberId,
        validated.type,
        validated.amount,
        validated.category,
        validated.description ?? "",
        validated.note ?? "",
        validated.date,
        now,
        now,
      );

    return this.getTransaction(userId, id);
  }

  public updateTransaction(userId: number, id: string, input: TransactionInput): TransactionRecord {
    this.getTransaction(userId, id);
    const validated = this.validateTransactionInput(userId, input);
    const now = nowIso();

    this.db
      .prepare(
        "UPDATE transactions SET family_member_id = ?, type = ?, amount = ?, category = ?, description = ?, note = ?, date = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(
        validated.familyMemberId,
        validated.type,
        validated.amount,
        validated.category,
        validated.description ?? "",
        validated.note ?? "",
        validated.date,
        now,
        id,
        userId,
      );

    return this.getTransaction(userId, id);
  }

  public deleteTransaction(userId: number, id: string) {
    this.getTransaction(userId, id);
    this.db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(id, userId);
  }

  public listGoals(userId: number): GoalRecord[] {
    return this.syncGoalStatuses(userId);
  }

  public createGoal(userId: number, input: GoalInput): GoalRecord {
    const validated = this.validateGoalInput(input);
    const now = nowIso();
    const id = randomUUID();

    this.db
      .prepare(
        "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        userId,
        validated.title,
        validated.targetAmount,
        validated.currentAmount,
        validated.deadline ?? null,
        validated.status,
        now,
        now,
      );

    return this.listGoals(userId).find((goal) => goal.id === id)!;
  }

  public updateGoal(userId: number, id: string, input: GoalInput): GoalRecord {
    const goal = this.listGoals(userId).find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    const validated = this.validateGoalInput(input);
    const now = nowIso();

    this.db
      .prepare(
        "UPDATE saving_goals SET title = ?, target_amount = ?, current_amount = ?, deadline = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      )
      .run(
        validated.title,
        validated.targetAmount,
        validated.currentAmount,
        validated.deadline ?? null,
        validated.status,
        now,
        id,
        userId,
      );

    return this.listGoals(userId).find((item) => item.id === id)!;
  }

  public addGoalContribution(userId: number, id: string, amount: number): GoalRecord {
    const goal = this.listGoals(userId).find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    const increment = Number(amount);
    assert(Number.isFinite(increment) && increment > 0, 400, "Сумма пополнения должна быть больше 0.");
    const nextCurrentAmount = roundMoney(goal.currentAmount + increment);
    return this.updateGoal(userId, id, {
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: nextCurrentAmount,
      deadline: goal.deadline,
    });
  }

  public deleteGoal(userId: number, id: string) {
    const goal = this.listGoals(userId).find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    this.db.prepare("DELETE FROM saving_goals WHERE id = ? AND user_id = ?").run(id, userId);
  }

  public updateSettings(userId: number, input: SettingsInput): AppSettings {
    const current = this.getSettings(userId);
    const next: AppSettings = {
      expenseCategories: input.expenseCategories ? uniqueStrings(input.expenseCategories, current.expenseCategories) : current.expenseCategories,
      incomeSources: input.incomeSources ? uniqueStrings(input.incomeSources, current.incomeSources) : current.incomeSources,
      categoryBudgets: input.categoryBudgets ? this.normalizeBudgets(input.categoryBudgets) : current.categoryBudgets,
      expenseTemplates: input.expenseTemplates ? this.normalizeTemplates(input.expenseTemplates) : current.expenseTemplates,
      updatedAt: nowIso(),
    };

    return this.saveSettings(userId, next);
  }

  public setPin(userId: number, nextPin: string | null, currentPin?: string) {
    const existingHash = this.getRawPinHash(userId);

    if (existingHash) {
      assert(currentPin, 400, "Введите текущий PIN-код.");
      assert(verifyPin(currentPin, existingHash), 401, "Текущий PIN-код неверный.");
    }

    if (nextPin === null || nextPin === "") {
      this.db.prepare("UPDATE users SET pin_code_hash = NULL WHERE id = ?").run(userId);
      return { hasPin: false };
    }

    assert(/^\d{4,6}$/.test(nextPin), 400, "PIN-код должен содержать от 4 до 6 цифр.");
    this.db.prepare("UPDATE users SET pin_code_hash = ? WHERE id = ?").run(hashPin(nextPin), userId);
    return { hasPin: true };
  }

  public unlock(userId: number, pin: string) {
    const pinHash = this.getRawPinHash(userId);

    if (!pinHash) {
      const session = createPinSessionToken(this.sessionSecret, getPinVersion(null), userId);
      return { ...session, hasPin: false };
    }

    assert(/^\d{4,6}$/.test(pin), 400, "PIN-код должен содержать от 4 до 6 цифр.");
    assert(verifyPin(pin, pinHash), 401, "Неверный PIN-код.");

    return {
      ...createPinSessionToken(this.sessionSecret, getPinVersion(pinHash), userId),
      hasPin: true,
    };
  }

  public getSessionPinVersion(userId: number) {
    return getPinVersion(this.getRawPinHash(userId));
  }

  public getBudgetAlerts(userId: number, anchor = todayKey()): BudgetAlert[] {
    const settings = this.getSettings(userId);
    const monthRange = getPeriodRange("month", anchor);
    const expenses = this.listTransactions(userId, {
      type: "expense",
      from: monthRange.startKey,
      to: monthRange.endKey,
    });
    const spentByCategory = aggregate(expenses, (item) => item.category);

    return spentByCategory
      .map((item) => {
        const limit = settings.categoryBudgets[item.label];
        if (!limit) {
          return null;
        }

        const ratio = item.value / limit;

        if (ratio >= 1) {
          return { category: item.label, limit, spent: item.value, status: "exceeded" as const };
        }

        if (ratio >= 0.85) {
          return { category: item.label, limit, spent: item.value, status: "warning" as const };
        }

        return null;
      })
      .filter((item): item is BudgetAlert => item !== null);
  }

  public getDashboard(userId: number, period: PeriodKey, anchor = todayKey()): DashboardSnapshot {
    assert(PERIOD_KEYS.includes(period), 400, "Некорректный период.");
    const range = getPeriodRange(period, anchor);
    const allTransactions = this.listTransactions(userId);
    const rangedTransactions = this.listTransactions(userId, { from: range.startKey, to: range.endKey });
    const periodIncome = sumValues(rangedTransactions, "income");
    const periodExpense = sumValues(rangedTransactions, "expense");
    const balance = roundMoney(sumValues(allTransactions, "income") - sumValues(allTransactions, "expense"));
    const goals = this.listGoals(userId);
    const activeGoal =
      goals
        .filter((goal) => goal.status !== "completed")
        .sort((left, right) => {
          const leftDeadline = left.deadline ?? "9999-12-31";
          const rightDeadline = right.deadline ?? "9999-12-31";
          return leftDeadline.localeCompare(rightDeadline);
        })[0] ?? null;

    return {
      period,
      anchor,
      label: range.label,
      balance,
      periodIncome,
      periodExpense,
      periodNet: roundMoney(periodIncome - periodExpense),
      recentTransactions: allTransactions.slice(0, 8),
      activeGoal,
      budgetAlerts: this.getBudgetAlerts(userId, anchor),
    };
  }

  public getFamilyInsights(userId: number): FamilyInsight[] {
    const members = this.listFamilyMembers(userId);
    const allTransactions = this.listTransactions(userId);

    return members.map((member) => {
      const items = allTransactions.filter((item) => item.familyMemberId === member.id);
      const income = sumValues(items, "income");
      const expense = sumValues(items, "expense");
      return {
        member,
        income,
        expense,
        net: roundMoney(income - expense),
        operationsCount: items.length,
        lastActivity: items[0]?.date ?? null,
      };
    });
  }

  public getStatistics(userId: number, period: PeriodKey, anchor = todayKey()): StatisticsSnapshot {
    assert(PERIOD_KEYS.includes(period), 400, "Некорректный период.");
    const range = getPeriodRange(period, anchor);
    const allTransactions = this.listTransactions(userId);
    const items = this.listTransactions(userId, { from: range.startKey, to: range.endKey });
    const expenses = items.filter((item) => item.type === "expense");
    const incomes = items.filter((item) => item.type === "income");
    const biggestExpense = expenses.slice().sort((left, right) => right.amount - left.amount)[0] ?? null;
    const categoryCounts = new Map<string, number>();

    for (const expense of expenses) {
      categoryCounts.set(expense.category, (categoryCounts.get(expense.category) ?? 0) + 1);
    }

    const frequentCategory =
      [...categoryCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

    const spendTrend =
      period === "year"
        ? Array.from({ length: 12 }, (_, index) => {
            const month = `${range.startKey.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
            const value = expenses
              .filter((item) => item.date.startsWith(month))
              .reduce((total, item) => total + item.amount, 0);
            return {
              label: monthLabel(month),
              dateKey: `${month}-01`,
              value: roundMoney(value),
            };
          })
        : enumerateDateKeys(range.startKey, range.endKey).map((dateKey) => ({
            label: dateKey.slice(8),
            dateKey,
            value: roundMoney(expenses.filter((item) => item.date === dateKey).reduce((total, item) => total + item.amount, 0)),
          }));

    return {
      period,
      anchor,
      label: range.label,
      totalIncome: sumValues(incomes, "income"),
      totalExpense: sumValues(expenses, "expense"),
      net: roundMoney(sumValues(incomes, "income") - sumValues(expenses, "expense")),
      balance: roundMoney(sumValues(allTransactions, "income") - sumValues(allTransactions, "expense")),
      biggestExpense,
      frequentCategory,
      expensesByCategory: aggregate(expenses, (item) => item.category),
      incomeBySource: aggregate(incomes, (item) => item.category),
      expensesByMember: aggregate(expenses, (item) => item.familyMemberName),
      incomesByMember: aggregate(incomes, (item) => item.familyMemberName),
      spendTrend,
      categoryShare: aggregate(expenses, (item) => item.category),
    };
  }

  public getBootstrap(userId: number, period: PeriodKey, anchor = todayKey()) {
    return {
      ...this.getAppMetadata(),
      user: this.getUserProfile(userId),
      settings: this.getSettings(userId),
      familyMembers: this.listFamilyMembers(userId),
      goals: this.listGoals(userId),
      dashboard: this.getDashboard(userId, period, anchor),
      familyInsights: this.getFamilyInsights(userId),
    };
  }

  public exportData(userId: number): ExportPayload {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      user: this.getUserProfile(userId),
      familyMembers: this.listFamilyMembers(userId),
      transactions: this.listTransactions(userId),
      goals: this.listGoals(userId),
      settings: this.getSettings(userId),
    };
  }

  public createPersistenceSnapshot(): PersistenceSnapshot {
    const users = this.db.prepare("SELECT * FROM users ORDER BY id ASC").all();

    return {
      schemaVersion: 2,
      persistedAt: nowIso(),
      users: users.map((user) => ({
        id: Number(user.id),
        name: String(user.name),
        email: user.email ? String(user.email) : null,
        avatarUrl: user.avatar_url ? String(user.avatar_url) : null,
        authProvider: this.getStoredAuthProvider(user),
        googleSubject: user.google_subject ? String(user.google_subject) : null,
        createdAt: String(user.created_at),
        pinCodeHash: user.pin_code_hash ? String(user.pin_code_hash) : null,
        lastLoginAt: user.last_login_at ? String(user.last_login_at) : null,
      })),
      familyMembers: this.db
        .prepare("SELECT id, user_id, name, created_at FROM family_members ORDER BY user_id ASC, created_at ASC")
        .all()
        .map((row) => ({
          id: Number(row.id),
          userId: Number(row.user_id),
          name: String(row.name),
          createdAt: String(row.created_at),
        })),
      transactions: this.db
        .prepare(
          `SELECT
            t.*,
            fm.name AS family_member_name
          FROM transactions t
          JOIN family_members fm ON fm.id = t.family_member_id
          ORDER BY t.user_id ASC, t.date DESC, t.created_at DESC`,
        )
        .all()
        .map((row) => this.transactionRowToModel(row)),
      goals: this.db
        .prepare("SELECT * FROM saving_goals ORDER BY user_id ASC, updated_at DESC")
        .all()
        .map((row) => this.goalRowToModel(row)),
      settingsByUser: this.db
        .prepare("SELECT * FROM app_settings ORDER BY user_id ASC")
        .all()
        .map((row) => ({
          userId: Number(row.user_id),
          ...this.settingsRowToModel(row),
        })),
    };
  }

  private replaceState(userId: number, {
    userName,
    userEmail,
    userAvatarUrl,
    authProvider,
    googleSubject,
    userCreatedAt,
    pinCodeHash,
    lastLoginAt,
    members,
    transactionItems,
    goalItems,
    settings,
  }: {
    userName: string;
    userEmail: string | null;
    userAvatarUrl: string | null;
    authProvider: AuthProvider;
    googleSubject: string | null;
    userCreatedAt: string;
    pinCodeHash: string | null;
    lastLoginAt: string | null;
    members: FamilyMember[];
    transactionItems: unknown[];
    goalItems: unknown[];
    settings: AppSettings;
  }) {
    this.withTransaction(() => {
      assert(this.hasUser(userId), 500, "Пользователь не инициализирован.");

      this.db.prepare("DELETE FROM transactions WHERE user_id = ?").run(userId);
      this.db.prepare("DELETE FROM saving_goals WHERE user_id = ?").run(userId);
      this.db.prepare("DELETE FROM family_members WHERE user_id = ?").run(userId);
      this.db.prepare("DELETE FROM app_settings WHERE user_id = ?").run(userId);

      this.db
        .prepare(
          "UPDATE users SET name = ?, email = ?, avatar_url = ?, auth_provider = ?, google_subject = ?, pin_code_hash = ?, created_at = ?, last_login_at = ? WHERE id = ?",
        )
        .run(userName, userEmail, userAvatarUrl, authProvider, googleSubject, pinCodeHash, userCreatedAt, lastLoginAt, userId);

      for (const member of members) {
        this.db
          .prepare("INSERT INTO family_members (id, user_id, name, created_at) VALUES (?, ?, ?, ?)")
          .run(member.id, userId, member.name, member.createdAt);
      }

      for (const item of transactionItems) {
        if (!item || typeof item !== "object") {
          continue;
        }

        try {
          const familyMemberId =
            members.find((member) => member.id === Number((item as any).familyMemberId))?.id ?? members[0].id;
          const validated = this.validateTransactionInput(userId, {
            familyMemberId,
            type: (item as any).type,
            amount: Number((item as any).amount),
            category: (item as any).category,
            description: (item as any).description,
            note: (item as any).note,
            date: (item as any).date,
          });
          const id = sanitizeText((item as any).id, randomUUID(), 64);
          const createdAt = typeof (item as any).createdAt === "string" ? String((item as any).createdAt) : nowIso();
          const updatedAt = typeof (item as any).updatedAt === "string" ? String((item as any).updatedAt) : createdAt;

          this.db
            .prepare(
              "INSERT INTO transactions (id, user_id, family_member_id, type, amount, category, description, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              id,
              userId,
              validated.familyMemberId,
              validated.type,
              validated.amount,
              validated.category,
              validated.description ?? "",
              validated.note ?? "",
              validated.date,
              createdAt,
              updatedAt,
            );
        } catch {
          // Skip invalid transaction rows when restoring state.
        }
      }

      for (const item of goalItems) {
        if (!item || typeof item !== "object") {
          continue;
        }

        try {
          const validated = this.validateGoalInput({
            title: (item as any).title,
            targetAmount: Number((item as any).targetAmount),
            currentAmount: Number((item as any).currentAmount),
            deadline: (item as any).deadline,
          });
          const id = sanitizeText((item as any).id, randomUUID(), 64);
          const createdAt = typeof (item as any).createdAt === "string" ? String((item as any).createdAt) : nowIso();
          const updatedAt = typeof (item as any).updatedAt === "string" ? String((item as any).updatedAt) : createdAt;

          this.db
            .prepare(
              "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              id,
              userId,
              validated.title,
              validated.targetAmount,
              validated.currentAmount,
              validated.deadline ?? null,
              validated.status,
              createdAt,
              updatedAt,
            );
        } catch {
          // Skip invalid goal rows when restoring state.
        }
      }

      this.saveSettings(userId, {
        expenseCategories: settings.expenseCategories,
        incomeSources: settings.incomeSources,
        categoryBudgets: settings.categoryBudgets,
        expenseTemplates: settings.expenseTemplates,
        updatedAt: settings.updatedAt || nowIso(),
      });
    });
  }

  public hydrateFromPersistenceSnapshot(payload: unknown) {
    assert(payload && typeof payload === "object", 400, "Некорректный persistence snapshot.");
    const snapshot = payload as Partial<PersistenceSnapshot>;

    if (Array.isArray(snapshot.users) && Array.isArray(snapshot.familyMembers) && Array.isArray(snapshot.settingsByUser)) {
      const snapshotUsers = snapshot.users;
      const snapshotFamilyMembers = snapshot.familyMembers;
      const snapshotSettingsByUser = snapshot.settingsByUser;
      const restoredUserIds = new Set<number>();
      const familyMemberOwners = new Map<number, number>();

      this.withTransaction(() => {
        this.db.prepare("DELETE FROM transactions").run();
        this.db.prepare("DELETE FROM saving_goals").run();
        this.db.prepare("DELETE FROM family_members").run();
        this.db.prepare("DELETE FROM app_settings").run();
        this.db.prepare("DELETE FROM users").run();

        for (const rawUser of snapshotUsers) {
          if (!rawUser || typeof rawUser !== "object") {
            continue;
          }

          const userId = Number((rawUser as any).id);
          const name = sanitizeText((rawUser as any).name, "Я");
          if (!Number.isInteger(userId) || userId <= 0 || !name) {
            continue;
          }

          this.db
            .prepare(
              "INSERT INTO users (id, name, pin_code_hash, created_at, email, avatar_url, auth_provider, google_subject, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              userId,
              name,
              typeof (rawUser as any).pinCodeHash === "string" ? String((rawUser as any).pinCodeHash) : null,
              typeof (rawUser as any).createdAt === "string" ? String((rawUser as any).createdAt) : nowIso(),
              typeof (rawUser as any).email === "string" ? sanitizeText((rawUser as any).email, "", 160) || null : null,
              typeof (rawUser as any).avatarUrl === "string"
                ? sanitizeText((rawUser as any).avatarUrl, "", 500) || null
                : null,
              (rawUser as any).authProvider === "google" ? "google" : "local",
              typeof (rawUser as any).googleSubject === "string"
                ? sanitizeText((rawUser as any).googleSubject, "", 255) || null
                : null,
              typeof (rawUser as any).lastLoginAt === "string" ? String((rawUser as any).lastLoginAt) : null,
            );
          restoredUserIds.add(userId);
        }

        for (const rawMember of snapshotFamilyMembers) {
          if (!rawMember || typeof rawMember !== "object") {
            continue;
          }

          const memberId = Number((rawMember as any).id);
          const memberUserId = Number((rawMember as any).userId);
          const name = sanitizeText((rawMember as any).name);
          if (!Number.isInteger(memberId) || memberId <= 0 || !restoredUserIds.has(memberUserId) || !name) {
            continue;
          }

          this.db
            .prepare("INSERT INTO family_members (id, user_id, name, created_at) VALUES (?, ?, ?, ?)")
            .run(
              memberId,
              memberUserId,
              name,
              typeof (rawMember as any).createdAt === "string" ? String((rawMember as any).createdAt) : nowIso(),
            );
          familyMemberOwners.set(memberId, memberUserId);
        }

        for (const rawSettings of snapshotSettingsByUser) {
          if (!rawSettings || typeof rawSettings !== "object") {
            continue;
          }

          const settingsUserId = Number((rawSettings as any).userId);
          if (!restoredUserIds.has(settingsUserId)) {
            continue;
          }

          this.saveSettings(settingsUserId, {
            expenseCategories: uniqueStrings((rawSettings as any).expenseCategories, DEFAULT_EXPENSE_CATEGORIES),
            incomeSources: uniqueStrings((rawSettings as any).incomeSources, DEFAULT_INCOME_SOURCES),
            categoryBudgets: this.normalizeBudgets((rawSettings as any).categoryBudgets),
            expenseTemplates: this.normalizeTemplates((rawSettings as any).expenseTemplates),
            updatedAt:
              typeof (rawSettings as any).updatedAt === "string" ? String((rawSettings as any).updatedAt) : nowIso(),
          });
        }

        for (const item of Array.isArray(snapshot.transactions) ? snapshot.transactions : []) {
          if (!item || typeof item !== "object") {
            continue;
          }

          try {
            const itemUserId = Number((item as any).userId);
            const familyMemberId = Number((item as any).familyMemberId);
            if (!restoredUserIds.has(itemUserId) || familyMemberOwners.get(familyMemberId) !== itemUserId) {
              continue;
            }

            const validated = this.validateTransactionInput(itemUserId, {
              familyMemberId,
              type: (item as any).type,
              amount: Number((item as any).amount),
              category: (item as any).category,
              description: (item as any).description,
              note: (item as any).note,
              date: (item as any).date,
            });
            const id = sanitizeText((item as any).id, randomUUID(), 64);
            const createdAt = typeof (item as any).createdAt === "string" ? String((item as any).createdAt) : nowIso();
            const updatedAt = typeof (item as any).updatedAt === "string" ? String((item as any).updatedAt) : createdAt;

            this.db
              .prepare(
                "INSERT INTO transactions (id, user_id, family_member_id, type, amount, category, description, note, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              )
              .run(
                id,
                itemUserId,
                validated.familyMemberId,
                validated.type,
                validated.amount,
                validated.category,
                validated.description ?? "",
                validated.note ?? "",
                validated.date,
                createdAt,
                updatedAt,
              );
          } catch {
            // Skip invalid transaction rows when restoring state.
          }
        }

        for (const item of Array.isArray(snapshot.goals) ? snapshot.goals : []) {
          if (!item || typeof item !== "object") {
            continue;
          }

          try {
            const itemUserId = Number((item as any).userId);
            if (!restoredUserIds.has(itemUserId)) {
              continue;
            }

            const validated = this.validateGoalInput({
              title: (item as any).title,
              targetAmount: Number((item as any).targetAmount),
              currentAmount: Number((item as any).currentAmount),
              deadline: (item as any).deadline,
            });
            const id = sanitizeText((item as any).id, randomUUID(), 64);
            const createdAt = typeof (item as any).createdAt === "string" ? String((item as any).createdAt) : nowIso();
            const updatedAt = typeof (item as any).updatedAt === "string" ? String((item as any).updatedAt) : createdAt;

            this.db
              .prepare(
                "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              )
              .run(
                id,
                itemUserId,
                validated.title,
                validated.targetAmount,
                validated.currentAmount,
                validated.deadline ?? null,
                validated.status,
                createdAt,
                updatedAt,
              );
          } catch {
            // Skip invalid goal rows when restoring state.
          }
        }
      });

      if (restoredUserIds.size === 0) {
        this.seed();
      } else {
        for (const userId of restoredUserIds) {
          this.ensureUserResources(userId, "Я");
        }
      }

      return;
    }

    const currentSettings = this.getSettings(1);
    const currentUser = this.getUserProfile(1);
    const normalizedSettings: AppSettings = {
      expenseCategories: uniqueStrings(snapshot.settings?.expenseCategories, currentSettings.expenseCategories),
      incomeSources: uniqueStrings(snapshot.settings?.incomeSources, currentSettings.incomeSources),
      categoryBudgets: this.normalizeBudgets(snapshot.settings?.categoryBudgets),
      expenseTemplates: this.normalizeTemplates(snapshot.settings?.expenseTemplates),
      updatedAt:
        snapshot.settings && typeof snapshot.settings.updatedAt === "string"
          ? snapshot.settings.updatedAt
          : nowIso(),
    };

    const normalizedMembers = Array.isArray(snapshot.familyMembers)
      ? snapshot.familyMembers
          .map((member) => {
            if (!member || typeof member !== "object") {
              return null;
            }

            const memberId = Number((member as any).id);
            const name = sanitizeText((member as any).name);

            if (!Number.isInteger(memberId) || memberId <= 0 || !name) {
              return null;
            }

            return {
              id: memberId,
              name,
              createdAt: typeof (member as any).createdAt === "string" ? String((member as any).createdAt) : nowIso(),
            } satisfies FamilyMember;
          })
          .filter((member): member is FamilyMember => member !== null)
      : [];

    const members = normalizedMembers.length > 0 ? normalizedMembers : [{ id: 1, name: "Я", createdAt: nowIso() }];
    const userName = sanitizeText(snapshot.user?.name, currentUser.name);
    const userEmail =
      snapshot.user && typeof snapshot.user.email === "string"
        ? sanitizeText(snapshot.user.email, "", 160) || null
        : currentUser.email;
    const userAvatarUrl =
      snapshot.user && typeof snapshot.user.avatarUrl === "string"
        ? sanitizeText(snapshot.user.avatarUrl, "", 500) || null
        : currentUser.avatarUrl;
    const authProvider =
      snapshot.user?.authProvider === "google" || snapshot.user?.authProvider === "local"
        ? snapshot.user.authProvider
        : currentUser.authProvider;
    const googleSubject =
      snapshot.user && typeof snapshot.user.googleSubject === "string"
        ? sanitizeText(snapshot.user.googleSubject, "", 255) || null
        : this.getGoogleSubject(1);
    const userCreatedAt =
      snapshot.user && typeof snapshot.user.createdAt === "string" ? snapshot.user.createdAt : currentUser.createdAt;
    const pinCodeHash =
      snapshot.user && typeof snapshot.user.pinCodeHash === "string" ? snapshot.user.pinCodeHash : null;
    const lastLoginAt =
      snapshot.user && typeof snapshot.user.lastLoginAt === "string" ? snapshot.user.lastLoginAt : currentUser.lastLoginAt;

    this.replaceState(1, {
      userName,
      userEmail,
      userAvatarUrl,
      authProvider,
      googleSubject,
      userCreatedAt,
      pinCodeHash,
      lastLoginAt,
      members,
      transactionItems: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
      goalItems: Array.isArray(snapshot.goals) ? snapshot.goals : [],
      settings: normalizedSettings,
    });
  }

  public exportTransactionsCsv(userId: number): string {
    const header = ["id", "type", "amount", "category", "description", "note", "date", "familyMember"];
    const escape = (value: string | number) => `"${String(value).replaceAll("\"", "\"\"")}"`;
    const lines = this.listTransactions(userId).map((item) =>
      [
        item.id,
        item.type,
        item.amount.toFixed(2),
        item.category,
        item.description,
        item.note,
        item.date,
        item.familyMemberName,
      ]
        .map(escape)
        .join(","),
    );
    return [header.join(","), ...lines].join("\n");
  }

  public importData(userId: number, payload: unknown, mode: ImportMode) {
    assert(payload && typeof payload === "object", 400, "Некорректный JSON для импорта.");
    const source = payload as Record<string, unknown>;
    const importedFamilyMembers = Array.isArray(source.familyMembers) ? source.familyMembers : [];
    const importedTransactions = Array.isArray(source.transactions) ? source.transactions : [];
    const importedGoals = Array.isArray(source.goals) ? source.goals : [];
    const importedSettings = source.settings && typeof source.settings === "object" ? (source.settings as Record<string, unknown>) : {};
    const importedUser = source.user && typeof source.user === "object" ? (source.user as Record<string, unknown>) : {};

    const normalizedMembers = importedFamilyMembers
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const memberId = Number((item as any).id);
        const name = sanitizeText((item as any).name);
        if (!Number.isInteger(memberId) || memberId <= 0 || !name) {
          return null;
        }

        return {
          id: memberId,
          name,
          createdAt: typeof (item as any).createdAt === "string" ? String((item as any).createdAt) : nowIso(),
        };
      })
      .filter((item): item is FamilyMember => item !== null);

    const members = normalizedMembers.length > 0 ? normalizedMembers : [{ id: 1, name: "Я", createdAt: nowIso() }];

    const currentSettings = this.getSettings(userId);
    const currentUser = this.getUserProfile(userId);
    const normalizedSettings: AppSettings = {
      expenseCategories: uniqueStrings(importedSettings.expenseCategories, currentSettings.expenseCategories),
      incomeSources: uniqueStrings(importedSettings.incomeSources, currentSettings.incomeSources),
      categoryBudgets: this.normalizeBudgets(importedSettings.categoryBudgets),
      expenseTemplates: this.normalizeTemplates(importedSettings.expenseTemplates),
      updatedAt: nowIso(),
    };

    if (mode === "replace") {
      this.replaceState(userId, {
        userName: sanitizeText(importedUser.name, "Я"),
        userEmail: currentUser.email,
        userAvatarUrl: currentUser.avatarUrl,
        authProvider: currentUser.authProvider,
        googleSubject: this.getGoogleSubject(userId),
        userCreatedAt: currentUser.createdAt,
        pinCodeHash: this.getRawPinHash(userId),
        lastLoginAt: currentUser.lastLoginAt,
        members,
        transactionItems: importedTransactions,
        goalItems: importedGoals,
        settings: normalizedSettings,
      });

      return this.getBootstrap(userId, "month", todayKey());
    }

    const existingMembers = this.listFamilyMembers(userId);
    const existingByName = new Map(existingMembers.map((member) => [member.name.toLowerCase(), member]));
    const memberMap = new Map<number, number>();

    for (const member of members) {
      const existing = existingByName.get(member.name.toLowerCase());
      if (existing) {
        memberMap.set(member.id, existing.id);
      } else {
        const created = this.createFamilyMember(userId, member.name);
        memberMap.set(member.id, created.id);
      }
    }

    for (const item of importedTransactions) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const sourceId = sanitizeText((item as any).id, randomUUID(), 64);
      if (this.listTransactions(userId).some((transaction) => transaction.id === sourceId)) {
        continue;
      }

      try {
        this.createTransaction(userId, {
          familyMemberId: memberMap.get(Number((item as any).familyMemberId)) ?? this.listFamilyMembers(userId)[0].id,
          type: (item as any).type,
          amount: Number((item as any).amount),
          category: (item as any).category,
          description: (item as any).description,
          note: (item as any).note,
          date: (item as any).date,
        });
      } catch {
        // Skip invalid imported transaction.
      }
    }

    for (const item of importedGoals) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const sourceId = sanitizeText((item as any).id, randomUUID(), 64);
      if (this.listGoals(userId).some((goal) => goal.id === sourceId)) {
        continue;
      }

      try {
        const validated = this.validateGoalInput({
          title: (item as any).title,
          targetAmount: Number((item as any).targetAmount),
          currentAmount: Number((item as any).currentAmount),
          deadline: (item as any).deadline,
        });
        const now = nowIso();
        this.db
          .prepare(
            "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            sourceId,
            userId,
            validated.title,
            validated.targetAmount,
            validated.currentAmount,
            validated.deadline ?? null,
            validated.status,
            now,
            now,
          );
      } catch {
        // Skip invalid imported goal.
      }
    }

    this.updateSettings(userId, {
      expenseCategories: [...currentSettings.expenseCategories, ...normalizedSettings.expenseCategories],
      incomeSources: [...currentSettings.incomeSources, ...normalizedSettings.incomeSources],
      categoryBudgets: { ...currentSettings.categoryBudgets, ...normalizedSettings.categoryBudgets },
      expenseTemplates: [...currentSettings.expenseTemplates, ...normalizedSettings.expenseTemplates].filter(
        (template, index, items) =>
          items.findIndex((candidate) => candidate.label === template.label && candidate.category === template.category) === index,
      ),
    });

    return this.getBootstrap(userId, "month", todayKey());
  }

  public resetTransactions(userId: number, confirmation: string, includeGoals = false, goalsConfirmation?: string) {
    assert(confirmation === "RESET", 400, "Подтвердите сброс словом RESET.");

    this.withTransaction(() => {
      this.db.prepare("DELETE FROM transactions WHERE user_id = ?").run(userId);

      if (includeGoals) {
        assert(goalsConfirmation === "DELETE_GOALS", 400, "Для удаления целей нужно отдельное подтверждение.");
        this.db.prepare("DELETE FROM saving_goals WHERE user_id = ?").run(userId);
      }
    });

    return this.getBootstrap(userId, "month", todayKey());
  }
}
