import { motion } from "framer-motion";
import {
  ChartColumnBig,
  Goal,
  History,
  Home,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AppScreen, PeriodKey } from "../types";

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[440px] bg-[radial-gradient(circle_at_top,_rgba(106,162,255,0.18),transparent_26%),linear-gradient(180deg,#070a12_0%,#080c16_50%,#05070c_100%)] px-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(143,244,255,0.08),transparent_18%),radial-gradient(circle_at_82%_18%,rgba(84,130,255,0.12),transparent_24%),radial-gradient(circle_at_50%_110%,rgba(139,87,255,0.10),transparent_28%)]" />
      {children}
    </div>
  );
}

export function GlassCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.32)] backdrop-blur-2xl ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        {eyebrow ? <div className="text-[11px] uppercase tracking-[0.28em] text-white/40">{eyebrow}</div> : null}
        <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function StatBadge({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "income" | "expense" | "goal";
}) {
  const toneClass =
    tone === "income"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "expense"
        ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
        : tone === "goal"
          ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
          : "border-white/10 bg-white/6 text-white/80";

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function PeriodTabs({
  period,
  onChange,
}: {
  period: PeriodKey;
  onChange: (next: PeriodKey) => void;
}) {
  const periods: Array<{ id: PeriodKey; label: string }> = [
    { id: "day", label: "День" },
    { id: "week", label: "Неделя" },
    { id: "month", label: "Месяц" },
    { id: "year", label: "Год" },
  ];

  return (
    <div className="flex rounded-full border border-white/10 bg-white/6 p-1">
      {periods.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`flex-1 rounded-full px-3 py-2 text-sm transition ${
            item.id === period ? "bg-white text-slate-950 shadow-lg" : "text-white/60"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-white/8">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#68f0ff_0%,#4f7bff_55%,#9f7dff_100%)]"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassCard className="py-8 text-center">
      <div className="text-lg font-medium text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </GlassCard>
  );
}

export function BottomNav({
  active,
  onChange,
}: {
  active: AppScreen;
  onChange: (screen: AppScreen) => void;
}) {
  const items: Array<{ id: AppScreen; label: string; icon: LucideIcon }> = [
    { id: "home", label: "Главная", icon: Home },
    { id: "history", label: "История", icon: History },
    { id: "statistics", label: "Статистика", icon: ChartColumnBig },
    { id: "goals", label: "Цели", icon: Goal },
    { id: "family", label: "Семья", icon: Users },
    { id: "settings", label: "Настройки", icon: Settings },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3"
    >
      <div className="grid grid-cols-3 gap-1.5 rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(10,14,24,0.86),rgba(10,14,24,0.68))] px-2 py-2 shadow-[0_22px_56px_rgba(0,0,0,0.35)] backdrop-blur-3xl">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-[22px] px-1 py-2.5 text-[11px] leading-[1.1] transition ${
                isActive ? "bg-white text-slate-950" : "text-white/55"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
