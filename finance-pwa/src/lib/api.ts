import type {
  AppSettings,
  AuthStatusResponse,
  BootstrapResponse,
  GoalDraft,
  GoalRecord,
  StatisticsSnapshot,
  TransactionDraft,
  TransactionRecord,
  UnlockResponse,
} from "../types";

const SESSION_KEY = "finora-session-token";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

export function persistSessionToken(token: string | null) {
  if (token) {
    sessionStorage.setItem(SESSION_KEY, token);
    return;
  }

  sessionStorage.removeItem(SESSION_KEY);
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getSessionToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = "Ошибка запроса.";

    try {
      const data = (await response.json()) as { message?: string };
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // Ignore invalid JSON error payloads.
    }

    throw new HttpError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getSessionToken,
  async authStatus() {
    return request<AuthStatusResponse>("/api/auth/status");
  },
  async unlock(pin: string) {
    return request<UnlockResponse>("/api/auth/unlock", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
  },
  async bootstrap(period: string, anchor: string) {
    return request<BootstrapResponse>(`/api/bootstrap?period=${period}&anchor=${anchor}`);
  },
  async statistics(period: string, anchor: string) {
    return request<StatisticsSnapshot>(`/api/statistics?period=${period}&anchor=${anchor}`);
  },
  async transactions(query = "") {
    return request<{ items: TransactionRecord[] }>(`/api/transactions${query}`);
  },
  async createTransaction(payload: TransactionDraft) {
    return request<TransactionRecord>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateTransaction(id: string, payload: TransactionDraft) {
    return request<TransactionRecord>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async deleteTransaction(id: string) {
    return request<void>(`/api/transactions/${id}`, {
      method: "DELETE",
    });
  },
  async createGoal(payload: GoalDraft) {
    return request<GoalRecord>("/api/goals", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async updateGoal(id: string, payload: GoalDraft) {
    return request<GoalRecord>(`/api/goals/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async addGoalContribution(id: string, amount: number) {
    return request<GoalRecord>(`/api/goals/${id}/contribution`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  },
  async deleteGoal(id: string) {
    return request<void>(`/api/goals/${id}`, {
      method: "DELETE",
    });
  },
  async createFamilyMember(name: string) {
    return request("/api/family", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  async updateFamilyMember(id: number, name: string) {
    return request(`/api/family/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
  },
  async deleteFamilyMember(id: number) {
    return request<void>(`/api/family/${id}`, {
      method: "DELETE",
    });
  },
  async saveSettings(payload: Partial<AppSettings>) {
    return request<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  async savePin(pin: string | null, currentPin?: string) {
    return request<{ hasPin: boolean }>("/api/settings/pin", {
      method: "PUT",
      body: JSON.stringify({ pin, currentPin }),
    });
  },
  async reset(confirmation: string, includeGoals = false, goalsConfirmation?: string) {
    return request<BootstrapResponse>("/api/reset", {
      method: "POST",
      body: JSON.stringify({ confirmation, includeGoals, goalsConfirmation }),
    });
  },
  async importPayload(payload: unknown, mode: "replace" | "merge") {
    return request<BootstrapResponse>("/api/import", {
      method: "POST",
      body: JSON.stringify({ payload, mode }),
    });
  },
  async exportJson() {
    const response = await fetch("/api/export?format=json", {
      headers: getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {},
    });

    if (!response.ok) {
      throw new HttpError(response.status, "Не удалось экспортировать JSON.");
    }

    return response.json();
  },
  async exportCsv() {
    const response = await fetch("/api/export?format=csv", {
      headers: getSessionToken() ? { Authorization: `Bearer ${getSessionToken()}` } : {},
    });

    if (!response.ok) {
      throw new HttpError(response.status, "Не удалось экспортировать CSV.");
    }

    return response.text();
  },
};
