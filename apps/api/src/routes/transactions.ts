import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type {
  UserTransaction,
  TransactionListResponse,
  TransactionDetailResponse,
} from "@dollarkilat/shared";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const transactions = new Hono<{ Variables: AuthVariables }>();

transactions.use("*", authMiddleware);

interface TxRow {
  id: string;
  type: string;
  status: string;
  amount_idr: number;
  amount_usdc_lamports: number;
  app_fee_idr: number;
  exchange_rate: string;
  merchant_name: string;
  merchant_id: string | null;
  acquirer: string | null;
  signature: string | null;
  pjp_partner: string;
  pjp_id: string | null;
  pjp_settled_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTransaction(row: TxRow): UserTransaction {
  return {
    id: row.id,
    type: row.type as UserTransaction["type"],
    status: row.status as UserTransaction["status"],
    amount_idr: row.amount_idr,
    amount_usdc_lamports: String(row.amount_usdc_lamports),
    app_fee_idr: row.app_fee_idr,
    exchange_rate: row.exchange_rate,
    merchant_name: row.merchant_name,
    merchant_id: row.merchant_id,
    acquirer: row.acquirer,
    signature: row.signature,
    pjp_partner: row.pjp_partner,
    pjp_id: row.pjp_id,
    pjp_settled_at: row.pjp_settled_at,
    failure_reason: row.failure_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getInternalUserId(privyUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_id", privyUserId)
    .maybeSingle();
  if (error) {
    console.error("[transactions] users lookup failed:", error);
    return null;
  }
  return data?.id ?? null;
}

const ListQuerySchema = z.object({
  // Status filter — accepts comma-separated list of statuses or "all" (default).
  // Frontend passes friendlier groups: "pending" → solana_pending,solana_confirmed,pjp_pending
  // For now keep it raw — UI maps groups before sending.
  status: z.string().optional(),
  // Cursor pagination — ISO datetime of the last row from previous page.
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /transactions
 * List authenticated user's transactions, newest first.
 * Cursor pagination via `?before=<created_at>`.
 * Filter via `?status=completed,pjp_pending` (CSV).
 */
transactions.get("/", zValidator("query", ListQuerySchema), async (c) => {
  const userId = await getInternalUserId(c.get("privyUserId"));
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  const q = c.req.valid("query");

  let query = supabaseAdmin
    .from("transactions")
    .select(
      "id, type, status, amount_idr, amount_usdc_lamports, app_fee_idr, exchange_rate, merchant_name, merchant_id, acquirer, signature, pjp_partner, pjp_id, pjp_settled_at, failure_reason, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(q.limit + 1); // fetch one extra to know if more pages exist

  if (q.status && q.status !== "all") {
    const statuses = q.status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      query = query.in("status", statuses);
    }
  }

  if (q.before) {
    query = query.lt("created_at", q.before);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[transactions/list] query failed:", error);
    return c.json({ error: "list_failed" }, 500);
  }

  const rows = (data ?? []) as TxRow[];
  const hasMore = rows.length > q.limit;
  const pageRows = hasMore ? rows.slice(0, q.limit) : rows;

  const body: TransactionListResponse = {
    transactions: pageRows.map(rowToTransaction),
    next_cursor: hasMore ? (pageRows[pageRows.length - 1]?.created_at ?? null) : null,
  };
  return c.json(body);
});

/**
 * GET /transactions/:id
 * Single tx detail. Owner-scoped.
 */
transactions.get("/:id", async (c) => {
  const userId = await getInternalUserId(c.get("privyUserId"));
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  const id = c.req.param("id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return c.json({ error: "invalid_id" }, 400);
  }

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, type, status, amount_idr, amount_usdc_lamports, app_fee_idr, exchange_rate, merchant_name, merchant_id, acquirer, signature, pjp_partner, pjp_id, pjp_settled_at, failure_reason, created_at, updated_at, user_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[transactions/detail] query failed:", error);
    return c.json({ error: "lookup_failed" }, 500);
  }
  if (!data) return c.json({ error: "not_found" }, 404);
  if ((data as { user_id: string }).user_id !== userId) {
    // 404 instead of 403 to avoid leaking existence
    return c.json({ error: "not_found" }, 404);
  }

  const body: TransactionDetailResponse = {
    transaction: rowToTransaction(data as TxRow),
  };
  return c.json(body);
});
