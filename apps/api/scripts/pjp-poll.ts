/**
 * Poll active PJP partner for pending tx status updates.
 *
 * Why: Flip Bisnis sandbox doesn't auto-settle disbursements (no real
 * money moves), so the "DONE" callback never fires automatically. This
 * script queries Flip's getStatus endpoint for every pjp_pending tx in
 * our DB and applies status transitions ourselves.
 *
 * Usage:
 *   npm run pjp:poll                 # poll all pjp_pending tx
 *   npm run pjp:poll -- --force-done # FORCE mark sandbox tx as completed
 *                                    # (demo helper, since sandbox stays PENDING)
 *
 * In production: replace this with a scheduled cron / webhook from real
 * partner. Sandbox-only convenience.
 */

import { parseArgs } from "node:util";
import { supabaseAdmin } from "../src/lib/supabase.js";
import { getPJP } from "../src/lib/pjp/index.js";

const args = parseArgs({
  options: {
    "force-done": { type: "boolean", default: false },
    limit: { type: "string", default: "50" },
  },
  allowPositionals: false,
});

const forceDone = args.values["force-done"] ?? false;
const limit = Number(args.values.limit ?? 50);

await main();

async function main() {
  const pjp = getPJP();
  console.log(`\n──────── PJP Poll (${pjp.name}) ────────\n`);

  // Pull pending tx from DB.
  const { data: rows, error } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, pjp_id, pjp_partner, status, amount_idr, merchant_name, created_at",
    )
    .in("status", ["pjp_pending", "solana_confirmed"])
    .not("pjp_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("DB lookup failed:", error);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("No pending tx found. Nothing to poll.");
    return;
  }

  console.log(`Found ${rows.length} pending tx:\n`);

  let settled = 0;
  let failed = 0;
  let stillPending = 0;

  for (const row of rows) {
    const pjp_id = row.pjp_id as string;
    const tx_id = row.id as string;
    console.log(`[${tx_id.slice(0, 8)}…]  pjp_id=${pjp_id}  amount=${row.amount_idr}  merchant=${row.merchant_name}`);

    if (forceDone) {
      // Demo / sandbox shortcut. Mark tx as completed without polling partner.
      await applyUpdate(tx_id, "completed", new Date().toISOString(), null);
      console.log("  → FORCED to completed (--force-done)\n");
      settled++;
      continue;
    }

    // Real polling
    let status;
    try {
      status = await pjp.getStatus(pjp_id);
    } catch (err) {
      console.error(`  → poll failed: ${(err as Error).message}\n`);
      continue;
    }
    console.log(`  → partner status: ${status.status}`);

    switch (status.status) {
      case "settled":
        await applyUpdate(tx_id, "completed", status.settled_at, null);
        settled++;
        console.log("  → DB updated to completed\n");
        break;
      case "failed":
      case "expired":
      case "cancelled":
        await applyUpdate(
          tx_id,
          "failed_settlement",
          null,
          status.failure_reason ?? `pjp_${status.status}`,
        );
        failed++;
        console.log(`  → DB updated to failed_settlement\n`);
        break;
      case "pending":
        stillPending++;
        console.log("  → still pending at partner\n");
        break;
    }
  }

  console.log(`\nSummary: ${settled} settled, ${failed} failed, ${stillPending} still pending`);
  if (stillPending > 0 && !forceDone) {
    console.log(
      "\nTip: Flip Bisnis sandbox doesn't auto-settle. Run with --force-done\n     to mark them completed for demo purposes.",
    );
  }
}

async function applyUpdate(
  tx_id: string,
  nextStatus: string,
  settledAt: string | null,
  failureReason: string | null,
) {
  const { error } = await supabaseAdmin
    .from("transactions")
    .update({
      status: nextStatus,
      pjp_settled_at: settledAt,
      failure_reason: failureReason,
    })
    .eq("id", tx_id);
  if (error) {
    console.error(`  ! update failed: ${error.message}`);
  }
}
