import type { ExpenseTemplate } from "./types.js";

export const APP_NAME = "Finora";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Еда",
  "Транспорт",
  "Одежда",
  "Развлечения",
  "Здоровье",
  "Дом",
  "Подписки",
  "Другое",
];

export const DEFAULT_INCOME_SOURCES = ["Зарплата", "Подработка", "Подарок", "Продажа", "Другое"];

export const DEFAULT_EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    id: "groceries",
    label: "Продукты",
    category: "Еда",
    amount: null,
    description: "Продукты",
    note: "",
  },
  {
    id: "taxi",
    label: "Такси",
    category: "Транспорт",
    amount: null,
    description: "Поездка",
    note: "",
  },
  {
    id: "coffee",
    label: "Кофе",
    category: "Еда",
    amount: null,
    description: "Кофе",
    note: "",
  },
];

export const PERIOD_KEYS = ["day", "week", "month", "year"] as const;
export const GOAL_STATUS = ["active", "completed", "overdue"] as const;
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export const MAX_TEXT_LENGTH = 120;
export const MAX_NOTE_LENGTH = 280;
