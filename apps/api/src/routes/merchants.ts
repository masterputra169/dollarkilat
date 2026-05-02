import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  MerchantClaimRequestSchema,
  MerchantUpdateRequestSchema,
  type Merchant,
  type MerchantDashboardResponse,
  type MerchantTransaction,
} from "@dollarkilat/shared";
import { authMiddleware, type AuthVariables } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

export const merchants = new Hono<{ Variables: AuthVariables }>();

merchants.use("*", authMiddleware);

// ── helpers ──────────────────────────────────────────────────

async function getInternalUserId(privyUserId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("privy_id", privyUserId)
    .maybeSingle();
  if (error) {
    console.error("[merchants] users lookup failed:", error);
    return null;
  }
  return data?.id ?? null;
}

interface MerchantRow {
  id: string;
  name: string;
  nmid: string;
  city: string | null;
  is_verified: boolean;
  bank_code: string | null;
  account_number: string | null;
  account_holder: string | null;
  created_at: string;
}

function rowToMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    name: row.name,
    nmid: row.nmid,
    city: row.city,
    is_verified: row.is_verified,
    bank_code: row.bank_code,
    account_number: row.account_number,
    account_holder: row.account_holder,
    created_at: row.created_at,
  };
}

// ── routes ───────────────────────────────────────────────────

/**
 * GET /merchants/me — list merchants owned by the authenticated user.
 * MVP: support 1+ merchants per user; UI shows the first as "default".
 */
merchants.get("/me", async (c) => {
  const userId = await getInternalUserId(c.get("privyUserId"));
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  const { data, error } = await supabaseAdmin
    .from("merchants")
    .select("id, name, nmid, city, is_verified, bank_code, account_number, account_holder, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[merchants/me] list failed:", error);
    return c.json({ error: "list_failed" }, 500);
  }
  return c.json({
    merchants: (data as MerchantRow[]).map(rowToMerchant),
  });
});

/**
 * POST /merchants — claim a merchant identity.
 * Conflict (409) if NMID already claimed by anyone (it's globally unique).
 * Hackathon scope: no proof-of-ownership check. Production should verify
 * against Bank Indonesia QRIS registry.
 */
merchants.post(
  "/",
  zValidator("json", MerchantClaimRequestSchema),
  async (c) => {
    const userId = await getInternalUserId(c.get("privyUserId"));
    if (!userId) return c.json({ error: "user_not_synced" }, 404);

    const input = c.req.valid("json");

    const { data, error } = await supabaseAdmin
      .from("merchants")
      .insert({
        owner_user_id: userId,
        name: input.name,
        nmid: input.nmid.toUpperCase(),
        city: input.city ?? null,
        bank_code: input.bank_code ?? null,
        account_number: input.account_number ?? null,
        account_holder: input.account_holder ?? null,
      })
      .select("id, name, nmid, city, is_verified, bank_code, account_number, account_holder, created_at")
      .single();

    if (error) {
      // Postgres unique violation = nmid taken
      if (error.code === "23505") {
        return c.json(
          {
            error: "nmid_taken",
            message: "NMID itu sudah diklaim. Pakai NMID lain.",
          },
          409,
        );
      }
      console.error("[merchants/claim] insert failed:", error);
      return c.json({ error: "claim_failed" }, 500);
    }

    return c.json({ merchant: rowToMerchant(data as MerchantRow) }, 201);
  },
);

/**
 * PATCH /merchants/:id — edit owned merchant in place. Keeps the row
 * (and its transactions FK) so historical payments stay linked. NMID
 * stays globally unique → 23505 maps to nmid_taken.
 */
merchants.patch(
  "/:id",
  zValidator("json", MerchantUpdateRequestSchema),
  async (c) => {
    const userId = await getInternalUserId(c.get("privyUserId"));
    if (!userId) return c.json({ error: "user_not_synced" }, 404);

    const id = c.req.param("id");
    const input = c.req.valid("json");

    const patch: Record<string, string | null> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.nmid !== undefined) patch.nmid = input.nmid.toUpperCase();
    if (input.city !== undefined) patch.city = input.city ?? null;
    if (input.bank_code !== undefined) patch.bank_code = input.bank_code ?? null;
    if (input.account_number !== undefined)
      patch.account_number = input.account_number ?? null;
    if (input.account_holder !== undefined)
      patch.account_holder = input.account_holder ?? null;

    const { data, error } = await supabaseAdmin
      .from("merchants")
      .update(patch)
      .eq("id", id)
      .eq("owner_user_id", userId)
      .select(
        "id, name, nmid, city, is_verified, bank_code, account_number, account_holder, created_at",
      )
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return c.json(
          {
            error: "nmid_taken",
            message: "NMID itu sudah diklaim merchant lain.",
          },
          409,
        );
      }
      console.error("[merchants/patch] update failed:", error);
      return c.json({ error: "update_failed" }, 500);
    }
    if (!data) return c.json({ error: "not_found_or_not_owner" }, 404);

    return c.json({ merchant: rowToMerchant(data as MerchantRow) });
  },
);

/**
 * GET /merchants/me/dashboard — aggregate income + recent transactions
 * for the user's merchants. If user owns multiple, currently aggregates
 * across all (Day 9 polish: support per-merchant filter).
 */
merchants.get("/me/dashboard", async (c) => {
  const userId = await getInternalUserId(c.get("privyUserId"));
  if (!userId) return c.json({ error: "user_not_synced" }, 404);

  // 1. Resolve owned merchants
  const { data: ownedRows, error: mErr } = await supabaseAdmin
    .from("merchants")
    .select("id, name, nmid, city, is_verified, bank_code, account_number, account_holder, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (mErr) {
    console.error("[merchants/dashboard] merchants lookup failed:", mErr);
    return c.json({ error: "lookup_failed" }, 500);
  }
  const owned = (ownedRows ?? []) as MerchantRow[];
  if (owned.length === 0) {
    const empty: MerchantDashboardResponse = {
      merchant: null,
      total_today_idr: 0,
      total_month_idr: 0,
      count_today: 0,
      recent: [],
    };
    return c.json(empty);
  }

  const merchantIds = owned.map((m) => m.id);

  // 2. Pull recent (last 50) transactions for any of the user's merchants
  const { data: txRows, error: txErr } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, amount_idr, amount_usdc_lamports, status, signature, created_at, pjp_settled_at",
    )
    .in("merchant_db_id", merchantIds)
    .order("created_at", { ascending: false })
    .limit(50);
  if (txErr) {
    console.error("[merchants/dashboard] tx lookup failed:", txErr);
    return c.json({ error: "tx_lookup_failed" }, 500);
  }

  const recent: MerchantTransaction[] = (txRows ?? []).map((r) => ({
    id: r.id as string,
    amount_idr: Number(r.amount_idr),
    amount_usdc_lamports: String(r.amount_usdc_lamports),
    status: r.status as MerchantTransaction["status"],
    signature: (r.signature as string | null) ?? null,
    created_at: r.created_at as string,
    pjp_settled_at: (r.pjp_settled_at as string | null) ?? null,
  }));

  // 3. Aggregates — only count transactions that actually settled
  const COMPLETED_STATUSES = ["completed", "pjp_pending", "solana_confirmed"];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let totalToday = 0;
  let totalMonth = 0;
  let countToday = 0;
  for (const tx of recent) {
    if (!COMPLETED_STATUSES.includes(tx.status)) continue;
    const at = new Date(tx.created_at);
    if (at >= monthStart) totalMonth += tx.amount_idr;
    if (at >= today) {
      totalToday += tx.amount_idr;
      countToday += 1;
    }
  }

  const body: MerchantDashboardResponse = {
    // First merchant becomes the "default" view; UI can switch later.
    merchant: rowToMerchant(owned[0]!),
    total_today_idr: totalToday,
    total_month_idr: totalMonth,
    count_today: countToday,
    recent,
  };
  return c.json(body);
});
