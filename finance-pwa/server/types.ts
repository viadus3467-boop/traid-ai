import type { GOAL_STATUS, PERIOD_KEYS, TRANSACTION_TYPES } from "./constants.js";

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type GoalStatus = (typeof GOAL_STATUS)[number];
export type PeriodKey = (typeof PERIOD_KEYS)[number];
export type AuthProvider = "local" | "google";

export interface UserProfile {
  id: number;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  authProvider: AuthProvider;
  googleLinked: boolean;
  hasPin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface FamilyMember {
  id: number;
  name: string;
  createdAt: string;
}

export interface ExpenseTemplate {
  id: string;
  label: string;
  category: string;
  amount: number | null;
  description: string;
  note: string;
}

export interface AppSettings {
  expenseCategories: string[];
  incomeSources: string[];
  categoryBudgets: Record<string, number>;
  expenseTemplates: ExpenseTemplate[];
  updatedAt: string;
}

export interface TransactionRecord {
  id: string;
  userId: number;
  familyMemberId: number;
  familyMemberName: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  note: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalRecord {
  id: string;
  userId: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  status: GoalStatus;
  remainingAmount: number;
  progressPercent: number;
  daysLeft: number | null;
  dailyTarget: number | null;
  weeklyTarget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AggregateItem {
  label: string;
  value: number;
}

export interface TrendPoint {
  label: string;
  dateKey: string;
  value: number;
}

export interface BudgetAlert {
  category: string;
  limit: number;
  spent: number;
  status: "warning" | "exceeded";
}

export interface FamilyInsight {
  member: FamilyMember;
  income: number;
  expense: number;
  net: number;
  operationsCount: number;
  lastActivity: string | null;
}

export interface DashboardSnapshot {
  period: PeriodKey;
  anchor: string;
  label: string;
  balance: number;
  periodIncome: number;
  periodExpense: number;
  periodNet: number;
  recentTransactions: TransactionRecord[];
  activeGoal: GoalRecord | null;
  budgetAlerts: BudgetAlert[];
}

export interface StatisticsSnapshot {
  period: PeriodKey;
  anchor: string;
  label: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  balance: number;
  biggestExpense: TransactionRecord | null;
  frequentCategory: string | null;
  expensesByCategory: AggregateItem[];
  incomeBySource: AggregateItem[];
  expensesByMember: AggregateItem[];
  incomesByMember: AggregateItem[];
  spendTrend: TrendPoint[];
  categoryShare: AggregateItem[];
}

export interface TransactionFilters {
  type?: TransactionType;
  category?: string;
  familyMemberId?: number;
  from?: string;
  to?: string;
  search?: string;
}

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  user: UserProfile;
  familyMembers: FamilyMember[];
  transactions: TransactionRecord[];
  goals: GoalRecord[];
  settings: AppSettings;
}

export interface PersistenceSnapshot {
  schemaVersion: number;
  persistedAt: string;
  user: {
    id: number;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    authProvider: AuthProvider;
    googleSubject: string | null;
    createdAt: string;
    pinCodeHash: string | null;
    lastLoginAt: string | null;
  };
  familyMembers: FamilyMember[];
  transactions: TransactionRecord[];
  goals: GoalRecord[];
  settings: AppSettings;
}
