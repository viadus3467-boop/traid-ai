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
import { createSessionToken, getPinVersion, hashPin, verifyPin } from "./security.js";
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
        id INTEGER PRIMARY KEY CHECK (id = 1),
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
  }

  private seed() {
    const now = nowIso();
    this.db.prepare("INSERT OR IGNORE INTO users (id, name, created_at) VALUES (1, ?, ?)").run("Я", now);

    const membersCountRow = this.db.prepare("SELECT COUNT(*) AS count FROM family_members").get();
    const membersCount = Number(membersCountRow?.count ?? 0);
    if (membersCount === 0) {
      this.db.prepare("INSERT INTO family_members (user_id, name, created_at) VALUES (1, ?, ?)").run("Я", now);
    }

    this.db.prepare(
      "INSERT OR IGNORE INTO app_settings (user_id, expense_categories, income_sources, category_budgets, expense_templates, updated_at) VALUES (1, ?, ?, ?, ?, ?)",
    ).run(
      JSON.stringify(DEFAULT_EXPENSE_CATEGORIES),
      JSON.stringify(DEFAULT_INCOME_SOURCES),
      JSON.stringify({}),
      JSON.stringify(DEFAULT_EXPENSE_TEMPLATES),
      now,
    );
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

  private saveSettings(next: AppSettings): AppSettings {
    this.db
      .prepare(
        "UPDATE app_settings SET expense_categories = ?, income_sources = ?, category_budgets = ?, expense_templates = ?, updated_at = ? WHERE user_id = 1",
      )
      .run(
        JSON.stringify(next.expenseCategories),
        JSON.stringify(next.incomeSources),
        JSON.stringify(next.categoryBudgets),
        JSON.stringify(next.expenseTemplates),
        next.updatedAt,
      );

    return next;
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

  private syncGoalStatuses(): GoalRecord[] {
    const rows = this.db.prepare("SELECT * FROM saving_goals ORDER BY updated_at DESC").all();
    const goals = rows.map((row) => this.goalRowToModel(row));
    const now = nowIso();

    for (const goal of goals) {
      const stored = rows.find((row) => String(row.id) === goal.id);
      if (stored && String(stored.status) !== goal.status) {
        this.db
          .prepare("UPDATE saving_goals SET status = ?, updated_at = ? WHERE id = ?")
          .run(goal.status, now, goal.id);
        goal.updatedAt = now;
      }
    }

    return goals.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private queryTransactionsBase(): TransactionRecord[] {
    const rows = this.db
      .prepare(
        `SELECT
          t.*,
          fm.name AS family_member_name
        FROM transactions t
        JOIN family_members fm ON fm.id = t.family_member_id
        ORDER BY t.date DESC, t.created_at DESC`,
      )
      .all();

    return rows.map((row) => this.transactionRowToModel(row));
  }

  private ensureFamilyMemberExists(id: number) {
    const row = this.db.prepare("SELECT id FROM family_members WHERE id = ?").get(id);
    assert(row, 404, "Член семьи не найден.");
  }

  private validateTransactionInput(input: TransactionInput): TransactionInput {
    const type = input.type;
    assert(TRANSACTION_TYPES.includes(type), 400, "Некорректный тип операции.");

    const amount = Number(input.amount);
    assert(Number.isFinite(amount) && amount > 0, 400, "Сумма должна быть больше 0.");
    assert(isValidDateKey(input.date), 400, "Укажите корректную дату операции.");

    const category = sanitizeText(input.category);
    assert(category, 400, "Укажите категорию или источник.");

    const familyMemberId = Number(input.familyMemberId);
    assert(Number.isInteger(familyMemberId) && familyMemberId > 0, 400, "Укажите члена семьи.");
    this.ensureFamilyMemberExists(familyMemberId);

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

  private getUserRow() {
    return this.db.prepare("SELECT * FROM users WHERE id = 1").get();
  }

  private getRawPinHash(): string | null {
    const row = this.getUserRow();
    return row?.pin_code_hash ? String(row.pin_code_hash) : null;
  }

  public getUserProfile(): UserProfile {
    const row = this.getUserRow();
    assert(row, 500, "Пользователь не инициализирован.");
    return {
      id: Number(row.id),
      name: String(row.name),
      hasPin: Boolean(row.pin_code_hash),
      createdAt: String(row.created_at),
    };
  }

  public hasPinConfigured(): boolean {
    return Boolean(this.getRawPinHash());
  }

  public getSettings(): AppSettings {
    const row = this.db.prepare("SELECT * FROM app_settings WHERE user_id = 1").get();
    return this.settingsRowToModel(row);
  }

  public listFamilyMembers(): FamilyMember[] {
    return this.db
      .prepare("SELECT id, name, created_at FROM family_members ORDER BY created_at ASC")
      .all()
      .map((row) => ({
        id: Number(row.id),
        name: String(row.name),
        createdAt: String(row.created_at),
      }));
  }

  public createFamilyMember(name: string): FamilyMember {
    const trimmed = sanitizeText(name);
    assert(trimmed, 400, "Введите имя члена семьи.");
    const now = nowIso();
    const result = this.db
      .prepare("INSERT INTO family_members (user_id, name, created_at) VALUES (1, ?, ?)")
      .run(trimmed, now);
    return {
      id: Number(result.lastInsertRowid),
      name: trimmed,
      createdAt: now,
    };
  }

  public updateFamilyMember(id: number, name: string): FamilyMember {
    this.ensureFamilyMemberExists(id);
    const trimmed = sanitizeText(name);
    assert(trimmed, 400, "Введите имя члена семьи.");
    this.db.prepare("UPDATE family_members SET name = ? WHERE id = ?").run(trimmed, id);
    return this.listFamilyMembers().find((member) => member.id === id)!;
  }

  public deleteFamilyMember(id: number) {
    const members = this.listFamilyMembers();
    const member = members.find((item) => item.id === id);
    assert(member, 404, "Член семьи не найден.");
    assert(members.length > 1, 400, "Нельзя удалить последнего участника семьи.");

    const fallbackMember = members.find((item) => item.id !== id);
    assert(fallbackMember, 400, "Нужен хотя бы один участник семьи.");

    this.withTransaction(() => {
      this.db.prepare("UPDATE transactions SET family_member_id = ? WHERE family_member_id = ?").run(fallbackMember.id, id);
      this.db.prepare("DELETE FROM family_members WHERE id = ?").run(id);
    });
  }

  public listTransactions(filters: TransactionFilters = {}): TransactionRecord[] {
    return this.queryTransactionsBase().filter((item) => {
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

  public getTransaction(id: string): TransactionRecord {
    const transaction = this.listTransactions().find((item) => item.id === id);
    assert(transaction, 404, "Операция не найдена.");
    return transaction;
  }

  public createTransaction(input: TransactionInput): TransactionRecord {
    const validated = this.validateTransactionInput(input);
    const now = nowIso();
    const id = randomUUID();

    this.db
      .prepare(
        "INSERT INTO transactions (id, user_id, family_member_id, type, amount, category, description, note, date, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
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

    return this.getTransaction(id);
  }

  public updateTransaction(id: string, input: TransactionInput): TransactionRecord {
    this.getTransaction(id);
    const validated = this.validateTransactionInput(input);
    const now = nowIso();

    this.db
      .prepare(
        "UPDATE transactions SET family_member_id = ?, type = ?, amount = ?, category = ?, description = ?, note = ?, date = ?, updated_at = ? WHERE id = ?",
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
      );

    return this.getTransaction(id);
  }

  public deleteTransaction(id: string) {
    this.getTransaction(id);
    this.db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  }

  public listGoals(): GoalRecord[] {
    return this.syncGoalStatuses();
  }

  public createGoal(input: GoalInput): GoalRecord {
    const validated = this.validateGoalInput(input);
    const now = nowIso();
    const id = randomUUID();

    this.db
      .prepare(
        "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        validated.title,
        validated.targetAmount,
        validated.currentAmount,
        validated.deadline ?? null,
        validated.status,
        now,
        now,
      );

    return this.listGoals().find((goal) => goal.id === id)!;
  }

  public updateGoal(id: string, input: GoalInput): GoalRecord {
    const goal = this.listGoals().find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    const validated = this.validateGoalInput(input);
    const now = nowIso();

    this.db
      .prepare(
        "UPDATE saving_goals SET title = ?, target_amount = ?, current_amount = ?, deadline = ?, status = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        validated.title,
        validated.targetAmount,
        validated.currentAmount,
        validated.deadline ?? null,
        validated.status,
        now,
        id,
      );

    return this.listGoals().find((item) => item.id === id)!;
  }

  public addGoalContribution(id: string, amount: number): GoalRecord {
    const goal = this.listGoals().find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    const increment = Number(amount);
    assert(Number.isFinite(increment) && increment > 0, 400, "Сумма пополнения должна быть больше 0.");
    const nextCurrentAmount = roundMoney(goal.currentAmount + increment);
    return this.updateGoal(id, {
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: nextCurrentAmount,
      deadline: goal.deadline,
    });
  }

  public deleteGoal(id: string) {
    const goal = this.listGoals().find((item) => item.id === id);
    assert(goal, 404, "Цель не найдена.");
    this.db.prepare("DELETE FROM saving_goals WHERE id = ?").run(id);
  }

  public updateSettings(input: SettingsInput): AppSettings {
    const current = this.getSettings();
    const next: AppSettings = {
      expenseCategories: input.expenseCategories ? uniqueStrings(input.expenseCategories, current.expenseCategories) : current.expenseCategories,
      incomeSources: input.incomeSources ? uniqueStrings(input.incomeSources, current.incomeSources) : current.incomeSources,
      categoryBudgets: input.categoryBudgets ? this.normalizeBudgets(input.categoryBudgets) : current.categoryBudgets,
      expenseTemplates: input.expenseTemplates ? this.normalizeTemplates(input.expenseTemplates) : current.expenseTemplates,
      updatedAt: nowIso(),
    };

    return this.saveSettings(next);
  }

  public setPin(nextPin: string | null, currentPin?: string) {
    const existingHash = this.getRawPinHash();

    if (existingHash) {
      assert(currentPin, 400, "Введите текущий PIN-код.");
      assert(verifyPin(currentPin, existingHash), 401, "Текущий PIN-код неверный.");
    }

    if (nextPin === null || nextPin === "") {
      this.db.prepare("UPDATE users SET pin_code_hash = NULL WHERE id = 1").run();
      return { hasPin: false };
    }

    assert(/^\d{4,6}$/.test(nextPin), 400, "PIN-код должен содержать от 4 до 6 цифр.");
    this.db.prepare("UPDATE users SET pin_code_hash = ? WHERE id = 1").run(hashPin(nextPin));
    return { hasPin: true };
  }

  public unlock(pin: string) {
    const pinHash = this.getRawPinHash();

    if (!pinHash) {
      const session = createSessionToken(this.sessionSecret, getPinVersion(null));
      return { ...session, hasPin: false };
    }

    assert(/^\d{4,6}$/.test(pin), 400, "PIN-код должен содержать от 4 до 6 цифр.");
    assert(verifyPin(pin, pinHash), 401, "Неверный PIN-код.");

    return {
      ...createSessionToken(this.sessionSecret, getPinVersion(pinHash)),
      hasPin: true,
    };
  }

  public getSessionPinVersion() {
    return getPinVersion(this.getRawPinHash());
  }

  public getBudgetAlerts(anchor = todayKey()): BudgetAlert[] {
    const settings = this.getSettings();
    const monthRange = getPeriodRange("month", anchor);
    const expenses = this.listTransactions({
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

  public getDashboard(period: PeriodKey, anchor = todayKey()): DashboardSnapshot {
    assert(PERIOD_KEYS.includes(period), 400, "Некорректный период.");
    const range = getPeriodRange(period, anchor);
    const allTransactions = this.listTransactions();
    const rangedTransactions = this.listTransactions({ from: range.startKey, to: range.endKey });
    const periodIncome = sumValues(rangedTransactions, "income");
    const periodExpense = sumValues(rangedTransactions, "expense");
    const balance = roundMoney(sumValues(allTransactions, "income") - sumValues(allTransactions, "expense"));
    const goals = this.listGoals();
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
      budgetAlerts: this.getBudgetAlerts(anchor),
    };
  }

  public getFamilyInsights(): FamilyInsight[] {
    const members = this.listFamilyMembers();
    const allTransactions = this.listTransactions();

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

  public getStatistics(period: PeriodKey, anchor = todayKey()): StatisticsSnapshot {
    assert(PERIOD_KEYS.includes(period), 400, "Некорректный период.");
    const range = getPeriodRange(period, anchor);
    const allTransactions = this.listTransactions();
    const items = this.listTransactions({ from: range.startKey, to: range.endKey });
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

  public getBootstrap(period: PeriodKey, anchor = todayKey()) {
    return {
      ...this.getAppMetadata(),
      user: this.getUserProfile(),
      settings: this.getSettings(),
      familyMembers: this.listFamilyMembers(),
      goals: this.listGoals(),
      dashboard: this.getDashboard(period, anchor),
      familyInsights: this.getFamilyInsights(),
    };
  }

  public exportData(): ExportPayload {
    return {
      schemaVersion: 1,
      exportedAt: nowIso(),
      user: this.getUserProfile(),
      familyMembers: this.listFamilyMembers(),
      transactions: this.listTransactions(),
      goals: this.listGoals(),
      settings: this.getSettings(),
    };
  }

  public createPersistenceSnapshot(): PersistenceSnapshot {
    const user = this.getUserRow();
    assert(user, 500, "Пользователь не инициализирован.");

    return {
      schemaVersion: 1,
      persistedAt: nowIso(),
      user: {
        id: Number(user.id),
        name: String(user.name),
        createdAt: String(user.created_at),
        pinCodeHash: user.pin_code_hash ? String(user.pin_code_hash) : null,
      },
      familyMembers: this.listFamilyMembers(),
      transactions: this.listTransactions(),
      goals: this.listGoals(),
      settings: this.getSettings(),
    };
  }

  private replaceState({
    userName,
    userCreatedAt,
    pinCodeHash,
    members,
    transactionItems,
    goalItems,
    settings,
  }: {
    userName: string;
    userCreatedAt: string;
    pinCodeHash: string | null;
    members: FamilyMember[];
    transactionItems: unknown[];
    goalItems: unknown[];
    settings: AppSettings;
  }) {
    this.withTransaction(() => {
      this.db.prepare("DELETE FROM transactions").run();
      this.db.prepare("DELETE FROM saving_goals").run();
      this.db.prepare("DELETE FROM family_members").run();

      this.db
        .prepare("UPDATE users SET name = ?, pin_code_hash = ?, created_at = ? WHERE id = 1")
        .run(userName, pinCodeHash, userCreatedAt);

      for (const member of members) {
        this.db
          .prepare("INSERT INTO family_members (id, user_id, name, created_at) VALUES (?, 1, ?, ?)")
          .run(member.id, member.name, member.createdAt);
      }

      for (const item of transactionItems) {
        if (!item || typeof item !== "object") {
          continue;
        }

        try {
          const familyMemberId =
            members.find((member) => member.id === Number((item as any).familyMemberId))?.id ?? members[0].id;
          const validated = this.validateTransactionInput({
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
              "INSERT INTO transactions (id, user_id, family_member_id, type, amount, category, description, note, date, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              id,
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
              "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              id,
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

      this.saveSettings({
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
    const currentSettings = this.getSettings();
    const currentUser = this.getUserProfile();
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
    const userCreatedAt =
      snapshot.user && typeof snapshot.user.createdAt === "string" ? snapshot.user.createdAt : currentUser.createdAt;
    const pinCodeHash =
      snapshot.user && typeof snapshot.user.pinCodeHash === "string" ? snapshot.user.pinCodeHash : null;

    this.replaceState({
      userName,
      userCreatedAt,
      pinCodeHash,
      members,
      transactionItems: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
      goalItems: Array.isArray(snapshot.goals) ? snapshot.goals : [],
      settings: normalizedSettings,
    });
  }

  public exportTransactionsCsv(): string {
    const header = ["id", "type", "amount", "category", "description", "note", "date", "familyMember"];
    const escape = (value: string | number) => `"${String(value).replaceAll("\"", "\"\"")}"`;
    const lines = this.listTransactions().map((item) =>
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

  public importData(payload: unknown, mode: ImportMode) {
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

    const currentSettings = this.getSettings();
    const currentUser = this.getUserProfile();
    const normalizedSettings: AppSettings = {
      expenseCategories: uniqueStrings(importedSettings.expenseCategories, currentSettings.expenseCategories),
      incomeSources: uniqueStrings(importedSettings.incomeSources, currentSettings.incomeSources),
      categoryBudgets: this.normalizeBudgets(importedSettings.categoryBudgets),
      expenseTemplates: this.normalizeTemplates(importedSettings.expenseTemplates),
      updatedAt: nowIso(),
    };

    if (mode === "replace") {
      this.replaceState({
        userName: sanitizeText(importedUser.name, "Я"),
        userCreatedAt: currentUser.createdAt,
        pinCodeHash: this.getRawPinHash(),
        members,
        transactionItems: importedTransactions,
        goalItems: importedGoals,
        settings: normalizedSettings,
      });

      return this.getBootstrap("month", todayKey());
    }

    const existingMembers = this.listFamilyMembers();
    const existingByName = new Map(existingMembers.map((member) => [member.name.toLowerCase(), member]));
    const memberMap = new Map<number, number>();

    for (const member of members) {
      const existing = existingByName.get(member.name.toLowerCase());
      if (existing) {
        memberMap.set(member.id, existing.id);
      } else {
        const created = this.createFamilyMember(member.name);
        memberMap.set(member.id, created.id);
      }
    }

    for (const item of importedTransactions) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const sourceId = sanitizeText((item as any).id, randomUUID(), 64);
      if (this.listTransactions().some((transaction) => transaction.id === sourceId)) {
        continue;
      }

      try {
        this.createTransaction({
          familyMemberId: memberMap.get(Number((item as any).familyMemberId)) ?? this.listFamilyMembers()[0].id,
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
      if (this.listGoals().some((goal) => goal.id === sourceId)) {
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
            "INSERT INTO saving_goals (id, user_id, title, target_amount, current_amount, deadline, status, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            sourceId,
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

    this.updateSettings({
      expenseCategories: [...currentSettings.expenseCategories, ...normalizedSettings.expenseCategories],
      incomeSources: [...currentSettings.incomeSources, ...normalizedSettings.incomeSources],
      categoryBudgets: { ...currentSettings.categoryBudgets, ...normalizedSettings.categoryBudgets },
      expenseTemplates: [...currentSettings.expenseTemplates, ...normalizedSettings.expenseTemplates].filter(
        (template, index, items) =>
          items.findIndex((candidate) => candidate.label === template.label && candidate.category === template.category) === index,
      ),
    });

    return this.getBootstrap("month", todayKey());
  }

  public resetTransactions(confirmation: string, includeGoals = false, goalsConfirmation?: string) {
    assert(confirmation === "RESET", 400, "Подтвердите сброс словом RESET.");

    this.withTransaction(() => {
      this.db.prepare("DELETE FROM transactions").run();

      if (includeGoals) {
        assert(goalsConfirmation === "DELETE_GOALS", 400, "Для удаления целей нужно отдельное подтверждение.");
        this.db.prepare("DELETE FROM saving_goals").run();
      }
    });

    return this.getBootstrap("month", todayKey());
  }
}
