import { Pool } from "pg";
import type { FinanceStore } from "./store.js";

export class SnapshotSync {
  private pool: Pool | null;

  constructor(databaseUrl?: string) {
    this.pool = databaseUrl
      ? new Pool({
          connectionString: databaseUrl,
          ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
        })
      : null;
  }

  async init(store: FinanceStore) {
    if (!this.pool) {
      return;
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_snapshots (
        id INTEGER PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const result = await this.pool.query("SELECT payload FROM app_snapshots WHERE id = $1", [1]);

    if (result.rows[0]?.payload) {
      store.hydrateFromPersistenceSnapshot(result.rows[0].payload);
      return;
    }

    await this.save(store);
  }

  async save(store: FinanceStore) {
    if (!this.pool) {
      return;
    }

    const payload = JSON.stringify(store.createPersistenceSnapshot());

    await this.pool.query(
      `
        INSERT INTO app_snapshots (id, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      [1, payload],
    );
  }
}
