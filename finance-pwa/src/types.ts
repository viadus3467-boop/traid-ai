export type TransactionType = "income" | "expense";
export type PeriodKey = "day" | "week" | "month" | "year";
export type GoalStatus = "active" | "completed" | "overdue";
export type AppScreen = "home" | "history" | "statistics" | "goals" | "family" | "settings";
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

export interface BootstrapResponse {
  appName: string;
  user: UserProfile;
  settings: AppSettings;
  familyMembers: FamilyMember[];
  goals: GoalRecord[];
  dashboard: DashboardSnapshot;
  familyInsights: FamilyInsight[];
}

export interface AuthStatusResponse {
  appName: string;
  googleAuthEnabled: boolean;
  isAuthenticated: boolean;
  pinUnlocked: boolean;
  hasPin: boolean;
  googleLoginUrl: string | null;
  user: UserProfile | null;
}

export interface UnlockResponse {
  token: string;
  expiresAt: string;
  hasPin: boolean;
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

export interface TransactionDraft {
  familyMemberId: number;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  note: string;
  date: string;
}

export interface GoalDraft {
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
}
