import {
  startTransition,
  type ChangeEvent,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Goal,
  Import,
  LockKeyhole,
  Pencil,
  PiggyBank,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  WalletCards,
} from "lucide-react";
import { DonutChart, TrendChart } from "./components/charts";
import { AppFrame, BottomNav, EmptyState, GlassCard, PeriodTabs, ProgressBar, SectionTitle, StatBadge } from "./components/primitives";
import { Sheet } from "./components/sheet";
import { api, HttpError, persistSessionToken } from "./lib/api";
import { getHistoryRange, shiftAnchor, todayKey } from "./lib/date";
import { formatDate, formatDateTime, formatDaysLeft, formatMoney, formatPercent, formatShortDate } from "./lib/format";
import type {
  AppScreen,
  AppSettings,
  BootstrapResponse,
  ExpenseTemplate,
  FamilyMember,
  GoalDraft,
  GoalRecord,
  PeriodKey,
  StatisticsSnapshot,
  TransactionDraft,
  TransactionRecord,
  TransactionType,
} from "./types";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-[22px] bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_32px_rgba(255,255,255,0.14)] transition hover:scale-[0.99]";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/12 bg-white/8 px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/12";
const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-[22px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/16";
const inputClass =
  "h-12 w-full rounded-2xl border border-white/10 bg-white/6 px-4 text-sm text-white outline-none placeholder:text-white/30 focus:border-sky-300/30 focus:bg-white/10";
const labelClass = "mb-2 block text-[11px] uppercase tracking-[0.22em] text-white/42";

type TransactionEditorState = {
  mode: "create" | "edit";
  id?: string;
  draft: TransactionDraft;
};

type GoalEditorState = {
  mode: "create" | "edit";
  id?: string;
  draft: GoalDraft;
};

type MemberEditorState = {
  mode: "create" | "edit";
  member?: FamilyMember;
  name: string;
};

function readScreen(): AppScreen {
  const hash = window.location.hash.replace("#", "");
  const screens: AppScreen[] = ["home", "history", "statistics", "goals", "family", "settings"];
  return screens.includes(hash as AppScreen) ? (hash as AppScreen) : "home";
}

function defaultTransactionDraft(
  type: TransactionType,
  members: FamilyMember[],
  settings: AppSettings,
  template?: ExpenseTemplate,
): TransactionDraft {
  const defaultCategory =
    template?.category ??
    (type === "expense" ? settings.expenseCategories[0] : settings.incomeSources[0]) ??
    "Другое";

  return {
    familyMemberId: members[0]?.id ?? 1,
    type,
    amount: template?.amount ?? 0,
    category: defaultCategory,
    description: template?.description ?? "",
    note: template?.note ?? "",
    date: todayKey(),
  };
}

function goalDraftFromGoal(goal?: GoalRecord): GoalDraft {
  return {
    title: goal?.title ?? "",
    targetAmount: goal?.targetAmount ?? 0,
    currentAmount: goal?.currentAmount ?? 0,
    deadline: goal?.deadline ?? null,
  };
}

function makeDownload(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(() => readScreen());
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [anchor, setAnchor] = useState(todayKey());
  const [authChecked, setAuthChecked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [statistics, setStatistics] = useState<StatisticsSnapshot | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings | null>(null);
  const [transactionEditor, setTransactionEditor] = useState<TransactionEditorState | null>(null);
  const [goalEditor, setGoalEditor] = useState<GoalEditorState | null>(null);
  const [memberEditor, setMemberEditor] = useState<MemberEditorState | null>(null);
  const [goalContribution, setGoalContribution] = useState<GoalRecord | null>(null);
  const [goalContributionAmount, setGoalContributionAmount] = useState("");
  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [pinMode, setPinMode] = useState<"set" | "change" | "remove">("set");
  const [pinValue, setPinValue] = useState("");
  const [currentPinValue, setCurrentPinValue] = useState("");
  const [unlockPinValue, setUnlockPinValue] = useState("");
  const [resetSheetOpen, setResetSheetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [includeGoalsOnReset, setIncludeGoalsOnReset] = useState(false);
  const [goalsResetConfirmation, setGoalsResetConfirmation] = useState("");
  const [newExpenseCategory, setNewExpenseCategory] = useState("");
  const [newIncomeSource, setNewIncomeSource] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("");
  const [newTemplateAmount, setNewTemplateAmount] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateNote, setNewTemplateNote] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [historyFilters, setHistoryFilters] = useState<{
    search: string;
    type: "all" | TransactionType;
    category: string;
    memberId: "all" | number;
    period: "all" | PeriodKey;
    anchor: string;
  }>({
    search: "",
    type: "all",
    category: "all",
    memberId: "all",
    period: "all",
    anchor: todayKey(),
  });
  const deferredSearch = useDeferredValue(historyFilters.search);

  const handleRequestError = useEffectEvent((issue: unknown) => {
    if (issue instanceof HttpError && issue.status === 401) {
      persistSessionToken(null);
      setSessionVersion((value) => value + 1);
      setError(null);
      return;
    }

    setError(issue instanceof Error ? issue.message : "Что-то пошло не так.");
  });

  const refreshData = useEffectEvent(async (nextPeriod: PeriodKey, nextAnchor: string) => {
    setLoading(true);
    setError(null);

    try {
      const [bootstrapData, statisticsData, transactionsData] = await Promise.all([
        api.bootstrap(nextPeriod, nextAnchor),
        api.statistics(nextPeriod, nextAnchor),
        api.transactions(),
      ]);

      setBootstrap(bootstrapData);
      setStatistics(statisticsData);
      setTransactions(transactionsData.items);
      setSettingsDraft(bootstrapData.settings);
    } catch (issue) {
      handleRequestError(issue);
    } finally {
      setLoading(false);
    }
  });

  const loadAuth = useEffectEvent(async () => {
    try {
      const status = await api.authStatus();
      setHasPin(status.hasPin);
      setAuthChecked(true);
    } catch (issue) {
      handleRequestError(issue);
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    const onHashChange = () => {
      startTransition(() => {
        setScreen(readScreen());
      });
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (hasPin && !api.getSessionToken()) {
      setLoading(false);
      return;
    }

    void refreshData(period, anchor);
  }, [anchor, authChecked, hasPin, period, refreshData, sessionVersion]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  function navigate(next: AppScreen) {
    startTransition(() => {
      setScreen(next);
      window.location.hash = next;
    });
  }

  async function runMutation(task: () => Promise<void>, message: string) {
    setMutating(true);
    setError(null);

    try {
      await task();
      await refreshData(period, anchor);
      setNotice(message);
    } catch (issue) {
      handleRequestError(issue);
    } finally {
      setMutating(false);
    }
  }

  async function submitUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const result = await api.unlock(unlockPinValue);
      persistSessionToken(result.token);
      setUnlockPinValue("");
      setSessionVersion((value) => value + 1);
    } catch (issue) {
      handleRequestError(issue);
    }
  }

  if (!authChecked || (loading && !bootstrap && !(hasPin && !api.getSessionToken()))) {
    return (
      <AppFrame>
        <GlassCard className="mt-12 p-8 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-[20px] bg-[linear-gradient(135deg,#6af0ff_0%,#4f7bff_52%,#9a7dff_100%)] p-[1px]">
            <div className="flex h-full items-center justify-center rounded-[19px] bg-slate-950 text-white">
              <PiggyBank className="h-6 w-6" />
            </div>
          </div>
          <div className="text-xl font-semibold">Finora</div>
          <p className="mt-2 text-sm text-white/55">Подготавливаем ваши финансы и синхронизируем данные…</p>
        </GlassCard>
      </AppFrame>
    );
  }

  if (hasPin && !api.getSessionToken()) {
    return (
      <AppFrame>
        <div className="flex min-h-[80vh] items-center">
          <GlassCard className="w-full p-6">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[linear-gradient(135deg,#6af0ff_0%,#4f7bff_52%,#9a7dff_100%)] text-slate-950">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-center text-[28px] font-semibold tracking-[-0.04em] text-white">Finora</h1>
            <p className="mt-3 text-center text-sm leading-6 text-white/58">
              Введите PIN-код, чтобы открыть бюджет, цели и семейную статистику.
            </p>
            <form className="mt-6 space-y-4" onSubmit={submitUnlock}>
              <div>
                <label className={labelClass}>PIN-код</label>
                <input
                  value={unlockPinValue}
                  onChange={(event) => setUnlockPinValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={`${inputClass} text-center text-lg tracking-[0.4em]`}
                  inputMode="numeric"
                  placeholder="0000"
                />
              </div>
              <button type="submit" className={`${primaryButton} w-full`}>
                <LockKeyhole className="h-4 w-4" />
                Открыть приложение
              </button>
            </form>
            {error ? <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}
          </GlassCard>
        </div>
      </AppFrame>
    );
  }

  const data = bootstrap;
  const stats = statistics;

  if (!data || !stats || !settingsDraft) {
    return null;
  }

  const currentBootstrap = data;
  const currentStatistics = stats;
  const currentSettings = settingsDraft;
  const settingsChanged = JSON.stringify(settingsDraft) !== JSON.stringify(data.settings);
  const historyRange = historyFilters.period === "all" ? null : getHistoryRange(historyFilters.period, historyFilters.anchor);
  const historyItems = transactions.filter((item) => {
    if (historyFilters.type !== "all" && item.type !== historyFilters.type) {
      return false;
    }

    if (historyFilters.category !== "all" && item.category !== historyFilters.category) {
      return false;
    }

    if (historyFilters.memberId !== "all" && item.familyMemberId !== historyFilters.memberId) {
      return false;
    }

    if (historyRange && (item.date < historyRange.from || item.date > historyRange.to)) {
      return false;
    }

    if (deferredSearch) {
      const content = `${item.description} ${item.note} ${item.category} ${item.familyMemberName}`.toLowerCase();
      if (!content.includes(deferredSearch.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  const allCategories = [...new Set(transactions.map((item) => item.category))];

  const quickTemplateCategory = settingsDraft.expenseCategories[0] ?? "Еда";
  const biggestExpense = currentStatistics.biggestExpense;

  function openTransactionEditor(type: TransactionType, transaction?: TransactionRecord, template?: ExpenseTemplate) {
    if (transaction) {
      setTransactionEditor({
        mode: "edit",
        id: transaction.id,
        draft: {
          familyMemberId: transaction.familyMemberId,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          description: transaction.description,
          note: transaction.note,
          date: transaction.date,
        },
      });
      return;
    }

    setTransactionEditor({
      mode: "create",
      draft: defaultTransactionDraft(type, currentBootstrap.familyMembers, currentSettings, template),
    });
  }

  async function submitTransactionForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transactionEditor) {
      return;
    }

    await runMutation(async () => {
      if (transactionEditor.mode === "edit" && transactionEditor.id) {
        await api.updateTransaction(transactionEditor.id, transactionEditor.draft);
      } else {
        await api.createTransaction(transactionEditor.draft);
      }
      setTransactionEditor(null);
    }, transactionEditor.mode === "edit" ? "Операция обновлена." : "Операция добавлена.");
  }

  async function deleteCurrentTransaction() {
    if (!transactionEditor?.id) {
      return;
    }

    await runMutation(async () => {
      await api.deleteTransaction(transactionEditor.id!);
      setTransactionEditor(null);
    }, "Операция удалена.");
  }

  async function submitGoalForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goalEditor) {
      return;
    }

    await runMutation(async () => {
      if (goalEditor.mode === "edit" && goalEditor.id) {
        await api.updateGoal(goalEditor.id, goalEditor.draft);
      } else {
        await api.createGoal(goalEditor.draft);
      }
      setGoalEditor(null);
    }, goalEditor.mode === "edit" ? "Цель обновлена." : "Цель создана.");
  }

  async function deleteGoal(id: string) {
    await runMutation(async () => {
      await api.deleteGoal(id);
    }, "Цель удалена.");
  }

  async function submitContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goalContribution) {
      return;
    }

    await runMutation(async () => {
      await api.addGoalContribution(goalContribution.id, Number(goalContributionAmount));
      setGoalContribution(null);
      setGoalContributionAmount("");
    }, "Пополнение цели сохранено.");
  }

  async function submitMemberForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberEditor) {
      return;
    }

    await runMutation(async () => {
      if (memberEditor.mode === "edit" && memberEditor.member) {
        await api.updateFamilyMember(memberEditor.member.id, memberEditor.name);
      } else {
        await api.createFamilyMember(memberEditor.name);
      }
      setMemberEditor(null);
    }, memberEditor.mode === "edit" ? "Имя обновлено." : "Член семьи добавлен.");
  }

  async function submitPinForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await runMutation(async () => {
      await api.savePin(pinMode === "remove" ? null : pinValue, currentPinValue || undefined);
      setPinSheetOpen(false);
      setPinValue("");
      setCurrentPinValue("");
      setHasPin(pinMode !== "remove");
      if (pinMode === "remove") {
        persistSessionToken(null);
        setSessionVersion((value) => value + 1);
      }
      if (pinMode !== "remove") {
        const unlock = await api.unlock(pinValue);
        persistSessionToken(unlock.token);
        setSessionVersion((value) => value + 1);
      }
    }, pinMode === "remove" ? "PIN-код отключён." : "PIN-код сохранён.");
  }

  async function saveSettingsDraft() {
    const payload = settingsDraft;
    if (!payload) {
      return;
    }

    await runMutation(async () => {
      await api.saveSettings(payload);
    }, "Настройки сохранены.");
  }

  async function exportJson() {
    try {
      const payload = await api.exportJson();
      makeDownload(`finora-backup-${todayKey()}.json`, JSON.stringify(payload, null, 2), "application/json");
      setNotice("JSON-экспорт готов.");
    } catch (issue) {
      handleRequestError(issue);
    }
  }

  async function exportCsv() {
    try {
      const content = await api.exportCsv();
      makeDownload(`finora-transactions-${todayKey()}.csv`, content, "text/csv;charset=utf-8");
      setNotice("CSV-экспорт готов.");
    } catch (issue) {
      handleRequestError(issue);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await runMutation(async () => {
        await api.importPayload(payload, importMode);
      }, importMode === "replace" ? "Данные импортированы с заменой." : "Данные импортированы и объединены.");
    } catch (issue) {
      handleRequestError(issue);
    } finally {
      event.target.value = "";
    }
  }

  async function resetStatistics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runMutation(async () => {
      await api.reset(
        resetConfirmation,
        includeGoalsOnReset,
        includeGoalsOnReset ? goalsResetConfirmation : undefined,
      );
      setResetSheetOpen(false);
      setResetConfirmation("");
      setGoalsResetConfirmation("");
      setIncludeGoalsOnReset(false);
    }, includeGoalsOnReset ? "Операции и цели очищены." : "Операции очищены.");
  }

  function updateBudget(category: string, value: string) {
    setSettingsDraft((current) => {
      if (!current) {
        return current;
      }

      const nextBudgets = { ...current.categoryBudgets };
      const parsed = Number(value);

      if (!value || Number.isNaN(parsed) || parsed <= 0) {
        delete nextBudgets[category];
      } else {
        nextBudgets[category] = parsed;
      }

      return { ...current, categoryBudgets: nextBudgets };
    });
  }

  function addCategory(kind: "expense" | "income") {
    const value = kind === "expense" ? newExpenseCategory.trim() : newIncomeSource.trim();
    if (!value) {
      return;
    }

    setSettingsDraft((current) => {
      if (!current) {
        return current;
      }

      const key = kind === "expense" ? "expenseCategories" : "incomeSources";
      const next = [...current[key], value].filter((item, index, items) => items.indexOf(item) === index);
      return { ...current, [key]: next };
    });

    if (kind === "expense") {
      setNewExpenseCategory("");
      return;
    }

    setNewIncomeSource("");
  }

  function removeCategory(kind: "expense" | "income", label: string) {
    setSettingsDraft((current) => {
      if (!current) {
        return current;
      }

      const key = kind === "expense" ? "expenseCategories" : "incomeSources";
      const next = current[key].filter((item) => item !== label);
      return { ...current, [key]: next };
    });
  }

  function addTemplate() {
    if (!newTemplateLabel.trim() || !newTemplateCategory.trim()) {
      return;
    }

    setSettingsDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        expenseTemplates: [
          ...current.expenseTemplates,
          {
            id: crypto.randomUUID(),
            label: newTemplateLabel.trim(),
            category: newTemplateCategory.trim(),
            amount: newTemplateAmount ? Number(newTemplateAmount) : null,
            description: newTemplateDescription.trim() || newTemplateLabel.trim(),
            note: newTemplateNote.trim(),
          },
        ],
      };
    });

    setNewTemplateLabel("");
    setNewTemplateCategory(quickTemplateCategory);
    setNewTemplateAmount("");
    setNewTemplateDescription("");
    setNewTemplateNote("");
  }

  function removeTemplate(id: string) {
    setSettingsDraft((current) =>
      current
        ? {
            ...current,
            expenseTemplates: current.expenseTemplates.filter((template) => template.id !== id),
          }
        : current,
    );
  }

  const screenContent = (
    <>
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/45">
            <Sparkles className="h-3.5 w-3.5" />
            Finora
          </div>
          <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.06em] text-white">Мой бюджет</h1>
          <p className="mt-2 text-sm text-white/52">Личный и семейный финансовый трекер в стиле iPhone.</p>
        </div>
        <div className="rounded-[22px] border border-white/12 bg-white/8 px-4 py-3 text-right text-xs text-white/55">
          <div>{data.dashboard.label}</div>
          <div className="mt-1 font-medium text-white/90">{formatDateTime(new Date().toISOString())}</div>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {screen === "home" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">Текущий баланс</div>
                <div className="mt-3 text-[34px] font-semibold tracking-[-0.06em] text-white">
                  {formatMoney(data.dashboard.balance)}
                </div>
              </div>
              <div className="rounded-[24px] border border-sky-300/14 bg-sky-300/10 px-3 py-2 text-right">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Осталось</div>
                <div className="mt-1 text-base font-semibold text-sky-200">
                  {formatMoney(data.dashboard.periodNet)}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatBadge label="Доходы" value={formatMoney(data.dashboard.periodIncome)} tone="income" />
              <StatBadge label="Расходы" value={formatMoney(data.dashboard.periodExpense)} tone="expense" />
            </div>
            <div className="mt-5 flex items-center gap-2">
              <button type="button" onClick={() => setAnchor(shiftAnchor(period, anchor, -1))} className={secondaryButton}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <PeriodTabs
                  period={period}
                  onChange={(next) => {
                    setPeriod(next);
                    setAnchor(todayKey());
                  }}
                />
              </div>
              <button type="button" onClick={() => setAnchor(shiftAnchor(period, anchor, 1))} className={secondaryButton}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => openTransactionEditor("expense")} className={primaryButton}>
              <Plus className="h-4 w-4" />
              Добавить расход
            </button>
            <button type="button" onClick={() => openTransactionEditor("income")} className={secondaryButton}>
              <WalletCards className="h-4 w-4" />
              Добавить доход
            </button>
          </div>

          <div>
            <SectionTitle eyebrow="Шаблоны" title="Быстрые траты" />
            <div className="flex gap-2 overflow-x-auto pb-2">
              {settingsDraft.expenseTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => openTransactionEditor("expense", undefined, template)}
                  className="shrink-0 rounded-[20px] border border-white/10 bg-white/8 px-4 py-3 text-left text-sm text-white/78"
                >
                  <div className="font-medium text-white">{template.label}</div>
                  <div className="mt-1 text-xs text-white/45">{template.category}</div>
                </button>
              ))}
            </div>
          </div>

          <SectionTitle eyebrow="Цель" title="Активное накопление" />
          {data.dashboard.activeGoal ? (
            <GlassCard>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-white">{data.dashboard.activeGoal.title}</div>
                  <div className="mt-2 text-sm text-white/58">
                    Осталось {formatMoney(data.dashboard.activeGoal.remainingAmount)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-sky-400/18 bg-sky-400/10 px-3 py-2 text-xs text-sky-200">
                  {formatPercent(data.dashboard.activeGoal.progressPercent)}
                </div>
              </div>
              <div className="mt-4">
                <ProgressBar value={data.dashboard.activeGoal.progressPercent} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatBadge label="Накоплено" value={formatMoney(data.dashboard.activeGoal.currentAmount)} tone="goal" />
                <StatBadge
                  label="Дедлайн"
                  value={data.dashboard.activeGoal.deadline ? formatDate(data.dashboard.activeGoal.deadline) : "Без срока"}
                  tone="default"
                />
              </div>
            </GlassCard>
          ) : (
            <EmptyState
              title="Целей пока нет"
              description="Создайте первую цель, чтобы видеть прогресс накоплений прямо на главном экране."
              action={
                <button
                  type="button"
                  className={primaryButton}
                  onClick={() => setGoalEditor({ mode: "create", draft: goalDraftFromGoal() })}
                >
                  <Goal className="h-4 w-4" />
                  Создать цель
                </button>
              }
            />
          )}

          {data.dashboard.budgetAlerts.length > 0 ? (
            <GlassCard className="space-y-3">
              <SectionTitle eyebrow="Лимиты" title="Бюджетные предупреждения" />
              {data.dashboard.budgetAlerts.map((alert) => (
                <div
                  key={alert.category}
                  className={`rounded-[22px] border px-4 py-3 text-sm ${
                    alert.status === "exceeded"
                      ? "border-rose-400/24 bg-rose-400/10 text-rose-200"
                      : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                  }`}
                >
                  <div className="font-medium">{alert.category}</div>
                  <div className="mt-1">
                    {formatMoney(alert.spent)} из {formatMoney(alert.limit)}
                  </div>
                </div>
              ))}
            </GlassCard>
          ) : null}

          <SectionTitle eyebrow="Лента" title="Последние операции" />
          <div className="space-y-3">
            {data.dashboard.recentTransactions.map((item) => (
              <TransactionCard key={item.id} transaction={item} onClick={() => openTransactionEditor(item.type, item)} />
            ))}
          </div>
        </motion.div>
      ) : null}

      {screen === "history" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <SectionTitle eyebrow="Поиск" title="История операций" />
          <GlassCard className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                className={`${inputClass} pl-11`}
                placeholder="Поиск по описанию, категории или члену семьи"
                value={historyFilters.search}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className={inputClass}
                value={historyFilters.type}
                onChange={(event) =>
                  setHistoryFilters((current) => ({
                    ...current,
                    type: event.target.value as "all" | TransactionType,
                  }))
                }
              >
                <option value="all">Все типы</option>
                <option value="expense">Расходы</option>
                <option value="income">Доходы</option>
              </select>
              <select
                className={inputClass}
                value={String(historyFilters.memberId)}
                onChange={(event) =>
                  setHistoryFilters((current) => ({
                    ...current,
                    memberId: event.target.value === "all" ? "all" : Number(event.target.value),
                  }))
                }
              >
                <option value="all">Вся семья</option>
                {data.familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={historyFilters.category}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="all">Все категории</option>
                {allCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={historyFilters.period}
                onChange={(event) =>
                  setHistoryFilters((current) => ({
                    ...current,
                    period: event.target.value as "all" | PeriodKey,
                  }))
                }
              >
                <option value="all">Всё время</option>
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="year">Год</option>
              </select>
            </div>
            {historyFilters.period !== "all" ? (
              <input
                type="date"
                className={inputClass}
                value={historyFilters.anchor}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, anchor: event.target.value }))}
              />
            ) : null}
          </GlassCard>

          <div className="space-y-3">
            {historyItems.length > 0 ? (
              historyItems.map((item) => (
                <TransactionCard key={item.id} transaction={item} onClick={() => openTransactionEditor(item.type, item)} />
              ))
            ) : (
              <EmptyState
                title="Ничего не найдено"
                description="Попробуйте изменить фильтры или добавить первую операцию."
              />
            )}
          </div>
        </motion.div>
      ) : null}

      {screen === "statistics" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <SectionTitle eyebrow="Аналитика" title="Финансовая статистика" />
          <GlassCard>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setAnchor(shiftAnchor(period, anchor, -1))} className={secondaryButton}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <PeriodTabs period={period} onChange={(next) => setPeriod(next)} />
              </div>
              <button type="button" onClick={() => setAnchor(shiftAnchor(period, anchor, 1))} className={secondaryButton}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 text-center text-sm text-white/58">{stats.label}</div>
          </GlassCard>

          <div className="grid grid-cols-2 gap-3">
            <StatBadge label="Доходы" value={formatMoney(stats.totalIncome)} tone="income" />
            <StatBadge label="Расходы" value={formatMoney(stats.totalExpense)} tone="expense" />
            <StatBadge label="Чистый итог" value={formatMoney(stats.net)} tone={stats.net >= 0 ? "goal" : "expense"} />
            <StatBadge label="Баланс" value={formatMoney(stats.balance)} tone="default" />
          </div>

          <GlassCard className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-white/75">Самая большая трата</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {stats.biggestExpense ? formatMoney(stats.biggestExpense.amount) : "Нет данных"}
                </div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/6 px-3 py-2 text-xs text-white/60">
                {stats.frequentCategory ? `Частая категория: ${stats.frequentCategory}` : "Категория появится после трат"}
              </div>
            </div>
            {biggestExpense ? (
              <TransactionCard transaction={biggestExpense} onClick={() => openTransactionEditor(biggestExpense.type, biggestExpense)} />
            ) : null}
          </GlassCard>

          <TrendChart title="График расходов" points={stats.spendTrend} />
          <DonutChart title="Круговая диаграмма категорий" items={stats.categoryShare} />

          <StatsList title="Расходы по категориям" items={stats.expensesByCategory} />
          <StatsList title="Доходы по источникам" items={stats.incomeBySource} />
          <StatsList title="Расходы по членам семьи" items={stats.expensesByMember} />
          <StatsList title="Доходы по членам семьи" items={stats.incomesByMember} />
        </motion.div>
      ) : null}

      {screen === "goals" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <SectionTitle
            eyebrow="Цели"
            title="Накопления"
            action={
              <button type="button" className={primaryButton} onClick={() => setGoalEditor({ mode: "create", draft: goalDraftFromGoal() })}>
                <Plus className="h-4 w-4" />
                Новая цель
              </button>
            }
          />
          {data.goals.length > 0 ? (
            data.goals.map((goal) => (
              <GlassCard key={goal.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-semibold text-white">{goal.title}</div>
                    <div className="mt-2 text-sm text-white/56">
                      {goal.deadline ? formatDate(goal.deadline) : "Без дедлайна"} · {formatDaysLeft(goal.daysLeft)}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      goal.status === "completed"
                        ? "bg-emerald-400/12 text-emerald-200"
                        : goal.status === "overdue"
                          ? "bg-rose-400/12 text-rose-200"
                          : "bg-sky-400/12 text-sky-200"
                    }`}
                  >
                    {goal.status === "completed" ? "Выполнена" : goal.status === "overdue" ? "Просрочена" : "Активная"}
                  </span>
                </div>
                <div className="mt-4">
                  <ProgressBar value={goal.progressPercent} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatBadge label="Нужно" value={formatMoney(goal.targetAmount)} tone="default" />
                  <StatBadge label="Накоплено" value={formatMoney(goal.currentAmount)} tone="goal" />
                  <StatBadge label="Осталось" value={formatMoney(goal.remainingAmount)} tone="expense" />
                  <StatBadge label="Процент" value={formatPercent(goal.progressPercent)} tone="goal" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <StatBadge
                    label="В день"
                    value={goal.dailyTarget !== null ? formatMoney(goal.dailyTarget) : "—"}
                    tone="default"
                  />
                  <StatBadge
                    label="В неделю"
                    value={goal.weeklyTarget !== null ? formatMoney(goal.weeklyTarget) : "—"}
                    tone="default"
                  />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setGoalContribution(goal)}>
                    <PiggyBank className="h-4 w-4" />
                    Пополнить
                  </button>
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => setGoalEditor({ mode: "edit", id: goal.id, draft: goalDraftFromGoal(goal) })}
                  >
                    <Pencil className="h-4 w-4" />
                    Изменить
                  </button>
                  <button type="button" className={dangerButton} onClick={() => void deleteGoal(goal.id)}>
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              </GlassCard>
            ))
          ) : (
            <EmptyState title="Пока нет целей" description="Добавьте цель накопления: iPhone, отпуск, машина или подушка безопасности." />
          )}
        </motion.div>
      ) : null}

      {screen === "family" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <SectionTitle
            eyebrow="Семья"
            title="Участники и их цифры"
            action={
              <button
                type="button"
                className={primaryButton}
                onClick={() => setMemberEditor({ mode: "create", name: "" })}
              >
                <Plus className="h-4 w-4" />
                Добавить
              </button>
            }
          />
          {data.familyInsights.map((insight) => (
            <GlassCard key={insight.member.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xl font-semibold text-white">{insight.member.name}</div>
                  <div className="mt-2 text-sm text-white/58">
                    {insight.lastActivity ? `Последняя операция: ${formatDate(insight.lastActivity)}` : "Пока без операций"}
                  </div>
                </div>
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => setMemberEditor({ mode: "edit", member: insight.member, name: insight.member.name })}
                >
                  <Pencil className="h-4 w-4" />
                  Имя
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <StatBadge label="Доход" value={formatMoney(insight.income)} tone="income" />
                <StatBadge label="Расход" value={formatMoney(insight.expense)} tone="expense" />
                <StatBadge label="Итог" value={formatMoney(insight.net)} tone={insight.net >= 0 ? "goal" : "expense"} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={secondaryButton}
                  onClick={() => {
                    setHistoryFilters((current) => ({ ...current, memberId: insight.member.id }));
                    navigate("history");
                  }}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Открыть историю
                </button>
                <button
                  type="button"
                  className={dangerButton}
                  onClick={() => void runMutation(async () => api.deleteFamilyMember(insight.member.id), "Участник удалён.")}
                >
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              </div>
            </GlassCard>
          ))}
        </motion.div>
      ) : null}

      {screen === "settings" ? (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <SectionTitle eyebrow="Настройки" title="Управление приложением" />

          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-white">PIN-код</div>
                <div className="mt-1 text-sm text-white/56">
                  {hasPin ? "Защита включена, приложение просит код при входе." : "Пока без PIN-защиты."}
                </div>
              </div>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setPinMode(hasPin ? "change" : "set");
                  setPinSheetOpen(true);
                }}
              >
                <LockKeyhole className="h-4 w-4" />
                {hasPin ? "Изменить" : "Включить"}
              </button>
            </div>
            {hasPin ? (
              <button
                type="button"
                className={dangerButton}
                onClick={() => {
                  setPinMode("remove");
                  setPinSheetOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Отключить PIN
              </button>
            ) : null}
          </GlassCard>

          <GlassCard className="space-y-4">
            <SectionTitle eyebrow="Лимиты" title="Бюджет по категориям" />
            {settingsDraft.expenseCategories.map((category) => (
              <div key={category} className="grid grid-cols-[1fr_132px] items-center gap-3">
                <div className="text-sm text-white/78">{category}</div>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  placeholder="0"
                  value={settingsDraft.categoryBudgets[category] ?? ""}
                  onChange={(event) => updateBudget(category, event.target.value)}
                />
              </div>
            ))}
          </GlassCard>

          <GlassCard className="space-y-4">
            <SectionTitle eyebrow="Категории" title="Расходы и доходы" />
            <CategoryEditor
              title="Категории расходов"
              items={settingsDraft.expenseCategories}
              value={newExpenseCategory}
              onChange={setNewExpenseCategory}
              onAdd={() => addCategory("expense")}
              onRemove={(label) => removeCategory("expense", label)}
            />
            <CategoryEditor
              title="Источники дохода"
              items={settingsDraft.incomeSources}
              value={newIncomeSource}
              onChange={setNewIncomeSource}
              onAdd={() => addCategory("income")}
              onRemove={(label) => removeCategory("income", label)}
            />
          </GlassCard>

          <GlassCard className="space-y-4">
            <SectionTitle eyebrow="Шаблоны" title="Быстрые расходы" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Название</label>
                <input className={inputClass} value={newTemplateLabel} onChange={(event) => setNewTemplateLabel(event.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Категория</label>
                <input
                  className={inputClass}
                  value={newTemplateCategory}
                  placeholder={quickTemplateCategory}
                  onChange={(event) => setNewTemplateCategory(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Сумма</label>
                <input
                  className={inputClass}
                  value={newTemplateAmount}
                  inputMode="decimal"
                  onChange={(event) => setNewTemplateAmount(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Описание</label>
                <input
                  className={inputClass}
                  value={newTemplateDescription}
                  onChange={(event) => setNewTemplateDescription(event.target.value)}
                />
              </div>
            </div>
            <textarea
              className={`${inputClass} h-24 py-3`}
              placeholder="Комментарий к шаблону"
              value={newTemplateNote}
              onChange={(event) => setNewTemplateNote(event.target.value)}
            />
            <button type="button" className={secondaryButton} onClick={addTemplate}>
              <Plus className="h-4 w-4" />
              Добавить шаблон
            </button>
            <div className="space-y-2">
              {settingsDraft.expenseTemplates.map((template) => (
                <div key={template.id} className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/6 px-4 py-3">
                  <div>
                    <div className="font-medium text-white">{template.label}</div>
                    <div className="mt-1 text-xs text-white/48">{template.category}</div>
                  </div>
                  <button type="button" className={dangerButton} onClick={() => removeTemplate(template.id)}>
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="space-y-3">
            <SectionTitle eyebrow="Данные" title="Экспорт, импорт и сброс" />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={secondaryButton} onClick={() => void exportJson()}>
                <Download className="h-4 w-4" />
                Экспорт JSON
              </button>
              <button type="button" className={secondaryButton} onClick={() => void exportCsv()}>
                <Download className="h-4 w-4" />
                Экспорт CSV
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setImportMode("replace");
                  importInputRef.current?.click();
                }}
              >
                <Upload className="h-4 w-4" />
                Импорт заменить
              </button>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setImportMode("merge");
                  importInputRef.current?.click();
                }}
              >
                <Import className="h-4 w-4" />
                Импорт добавить
              </button>
            </div>
            <button type="button" className={dangerButton} onClick={() => setResetSheetOpen(true)}>
              <CircleAlert className="h-4 w-4" />
              Сбросить статистику
            </button>
            <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
          </GlassCard>

          <GlassCard className="space-y-3">
            <SectionTitle eyebrow="О приложении" title="Finora PWA" />
            <div className="text-sm leading-6 text-white/58">
              React + Vite + Tailwind + Framer Motion на фронтенде, Express + TypeScript + SQLite на бэкенде. Данные
              сохраняются в базе, а не только в памяти или localStorage.
            </div>
          </GlassCard>

          <button
            type="button"
            className={`${primaryButton} w-full ${settingsChanged ? "" : "opacity-60"}`}
            disabled={!settingsChanged || mutating}
            onClick={() => void saveSettingsDraft()}
          >
            <Save className="h-4 w-4" />
            Сохранить настройки
          </button>
        </motion.div>
      ) : null}
    </>
  );

  return (
    <AppFrame>
      {screenContent}
      <BottomNav active={screen} onChange={navigate} />

      <Sheet open={transactionEditor !== null} title={transactionEditor?.mode === "edit" ? "Редактировать операцию" : "Новая операция"} onClose={() => setTransactionEditor(null)}>
        {transactionEditor ? (
          <form className="space-y-4" onSubmit={submitTransactionForm}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Тип</label>
                <select
                  className={inputClass}
                  value={transactionEditor.draft.type}
                  onChange={(event) =>
                    setTransactionEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              type: event.target.value as TransactionType,
                              category:
                                event.target.value === "expense"
                                  ? settingsDraft.expenseCategories[0] ?? current.draft.category
                                  : settingsDraft.incomeSources[0] ?? current.draft.category,
                            },
                          }
                        : current,
                    )
                  }
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Сумма</label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={transactionEditor.draft.amount || ""}
                  onChange={(event) =>
                    setTransactionEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: { ...current.draft, amount: Number(event.target.value) },
                          }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{transactionEditor.draft.type === "expense" ? "Категория" : "Источник дохода"}</label>
              <select
                className={inputClass}
                value={transactionEditor.draft.category}
                onChange={(event) =>
                  setTransactionEditor((current) =>
                    current ? { ...current, draft: { ...current.draft, category: event.target.value } } : current,
                  )
                }
              >
                {(transactionEditor.draft.type === "expense" ? settingsDraft.expenseCategories : settingsDraft.incomeSources).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Описание</label>
              <input
                className={inputClass}
                value={transactionEditor.draft.description}
                onChange={(event) =>
                  setTransactionEditor((current) =>
                    current ? { ...current, draft: { ...current.draft, description: event.target.value } } : current,
                  )
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Дата</label>
                <input
                  type="date"
                  className={inputClass}
                  value={transactionEditor.draft.date}
                  onChange={(event) =>
                    setTransactionEditor((current) =>
                      current ? { ...current, draft: { ...current.draft, date: event.target.value } } : current,
                    )
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Член семьи</label>
                <select
                  className={inputClass}
                  value={transactionEditor.draft.familyMemberId}
                  onChange={(event) =>
                    setTransactionEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, familyMemberId: Number(event.target.value) } }
                        : current,
                    )
                  }
                >
                  {data.familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Комментарий</label>
              <textarea
                className={`${inputClass} h-24 py-3`}
                value={transactionEditor.draft.note}
                onChange={(event) =>
                  setTransactionEditor((current) =>
                    current ? { ...current, draft: { ...current.draft, note: event.target.value } } : current,
                  )
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="submit" className={primaryButton} disabled={mutating}>
                <Save className="h-4 w-4" />
                Сохранить
              </button>
              {transactionEditor.mode === "edit" ? (
                <button type="button" className={dangerButton} onClick={() => void deleteCurrentTransaction()}>
                  <Trash2 className="h-4 w-4" />
                  Удалить
                </button>
              ) : (
                <button type="button" className={secondaryButton} onClick={() => setTransactionEditor(null)}>
                  Отмена
                </button>
              )}
            </div>
          </form>
        ) : null}
      </Sheet>

      <Sheet open={goalEditor !== null} title={goalEditor?.mode === "edit" ? "Редактировать цель" : "Новая цель"} onClose={() => setGoalEditor(null)}>
        {goalEditor ? (
          <form className="space-y-4" onSubmit={submitGoalForm}>
            <div>
              <label className={labelClass}>Название цели</label>
              <input
                className={inputClass}
                value={goalEditor.draft.title}
                onChange={(event) =>
                  setGoalEditor((current) =>
                    current ? { ...current, draft: { ...current.draft, title: event.target.value } } : current,
                  )
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Нужная сумма</label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={goalEditor.draft.targetAmount || ""}
                  onChange={(event) =>
                    setGoalEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, targetAmount: Number(event.target.value) } }
                        : current,
                    )
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Уже накоплено</label>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={goalEditor.draft.currentAmount || ""}
                  onChange={(event) =>
                    setGoalEditor((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, currentAmount: Number(event.target.value) } }
                        : current,
                    )
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Дедлайн</label>
              <input
                type="date"
                className={inputClass}
                value={goalEditor.draft.deadline ?? ""}
                onChange={(event) =>
                  setGoalEditor((current) =>
                    current
                      ? { ...current, draft: { ...current.draft, deadline: event.target.value || null } }
                      : current,
                  )
                }
              />
            </div>
            <button type="submit" className={`${primaryButton} w-full`} disabled={mutating}>
              <Save className="h-4 w-4" />
              Сохранить цель
            </button>
          </form>
        ) : null}
      </Sheet>

      <Sheet open={memberEditor !== null} title={memberEditor?.mode === "edit" ? "Редактировать участника" : "Новый участник"} onClose={() => setMemberEditor(null)}>
        {memberEditor ? (
          <form className="space-y-4" onSubmit={submitMemberForm}>
            <div>
              <label className={labelClass}>Имя</label>
              <input className={inputClass} value={memberEditor.name} onChange={(event) => setMemberEditor((current) => (current ? { ...current, name: event.target.value } : current))} />
            </div>
            <button type="submit" className={`${primaryButton} w-full`}>
              <Save className="h-4 w-4" />
              Сохранить
            </button>
          </form>
        ) : null}
      </Sheet>

      <Sheet open={goalContribution !== null} title="Пополнить цель" onClose={() => setGoalContribution(null)}>
        {goalContribution ? (
          <form className="space-y-4" onSubmit={submitContribution}>
            <div className="rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/70">
              {goalContribution.title}
            </div>
            <div>
              <label className={labelClass}>Сумма пополнения</label>
              <input
                className={inputClass}
                inputMode="decimal"
                value={goalContributionAmount}
                onChange={(event) => setGoalContributionAmount(event.target.value)}
              />
            </div>
            <button type="submit" className={`${primaryButton} w-full`}>
              <PiggyBank className="h-4 w-4" />
              Добавить к цели
            </button>
          </form>
        ) : null}
      </Sheet>

      <Sheet open={pinSheetOpen} title="PIN-код" onClose={() => setPinSheetOpen(false)}>
        <form className="space-y-4" onSubmit={submitPinForm}>
          {hasPin ? (
            <div>
              <label className={labelClass}>Текущий PIN</label>
              <input
                className={`${inputClass} text-center tracking-[0.35em]`}
                inputMode="numeric"
                value={currentPinValue}
                onChange={(event) => setCurrentPinValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          ) : null}
          {pinMode !== "remove" ? (
            <div>
              <label className={labelClass}>Новый PIN</label>
              <input
                className={`${inputClass} text-center tracking-[0.35em]`}
                inputMode="numeric"
                value={pinValue}
                onChange={(event) => setPinValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </div>
          ) : (
            <div className="rounded-[20px] border border-rose-400/18 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">
              После отключения PIN вход будет без кода, но данные в базе сохранятся.
            </div>
          )}
          <button type="submit" className={`${primaryButton} w-full`}>
            <Save className="h-4 w-4" />
            {pinMode === "remove" ? "Отключить PIN" : "Сохранить PIN"}
          </button>
        </form>
      </Sheet>

      <Sheet open={resetSheetOpen} title="Сбросить статистику" onClose={() => setResetSheetOpen(false)}>
        <form className="space-y-4" onSubmit={resetStatistics}>
          <div className="rounded-[20px] border border-amber-300/18 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">
            Сброс удаляет операции. Цели не удаляются, если вы не включите это отдельно и не подтвердите вторым кодом.
          </div>
          <div>
            <label className={labelClass}>Введите RESET</label>
            <input className={inputClass} value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} />
          </div>
          <label className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={includeGoalsOnReset}
              onChange={(event) => setIncludeGoalsOnReset(event.target.checked)}
            />
            Удалить также цели накопления
          </label>
          {includeGoalsOnReset ? (
            <div>
              <label className={labelClass}>Введите DELETE_GOALS</label>
              <input className={inputClass} value={goalsResetConfirmation} onChange={(event) => setGoalsResetConfirmation(event.target.value)} />
            </div>
          ) : null}
          <button type="submit" className={`${dangerButton} w-full`}>
            <Trash2 className="h-4 w-4" />
            Выполнить сброс
          </button>
        </form>
      </Sheet>

      <AnimatePresence>
        {notice ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed left-1/2 top-[calc(1rem+env(safe-area-inset-top))] z-[80] w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 rounded-[24px] border border-emerald-400/16 bg-emerald-400/14 px-4 py-3 text-sm text-emerald-100 shadow-[0_18px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
          >
            {notice}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppFrame>
  );
}

function TransactionCard({
  transaction,
  onClick,
}: {
  transaction: TransactionRecord;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[26px] border border-white/10 bg-white/6 p-4 text-left shadow-[0_16px_40px_rgba(0,0,0,0.2)] transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-medium text-white">{transaction.description || transaction.category}</div>
          <div className="mt-1 text-sm text-white/50">
            {transaction.category} · {transaction.familyMemberName}
          </div>
        </div>
        <div className={`text-right text-base font-semibold ${transaction.type === "income" ? "text-emerald-300" : "text-rose-300"}`}>
          {transaction.type === "income" ? "+" : "-"}
          {formatMoney(transaction.amount)}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/42">
        <span>{formatDate(transaction.date)}</span>
        <span>{transaction.note || "Без комментария"}</span>
      </div>
    </button>
  );
}

function StatsList({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  if (items.length === 0) {
    return <EmptyState title={title} description="Здесь появятся данные после первых операций за выбранный период." />;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <GlassCard>
      <div className="mb-4 text-sm font-medium text-white/75">{title}</div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/70">{item.label}</span>
              <span className="font-medium text-white">{formatMoney(item.value)}</span>
            </div>
            <ProgressBar value={(item.value / max) * 100} />
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function CategoryEditor({
  title,
  items,
  value,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (label: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 text-sm font-medium text-white/75">{title}</div>
      <div className="mb-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-sm text-white/75">
            <span>{item}</span>
            <button type="button" onClick={() => onRemove(item)} className="text-white/45">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" className={secondaryButton} onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Добавить
        </button>
      </div>
    </div>
  );
}
