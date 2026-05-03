/**
 * Seed 4 demo merchants — claimed by the most recent user in the DB —
 * and print a ready-to-paste QRIS string for each at multiple amounts.
 *
 * Use during demo prep so the Merchant page shows realistic Indonesian
 * SME identities (Toko Sarah, Warung Kopi Malam, etc) instead of a
 * lonely "Toko Demo" row, and so the demo presenter has 12 pre-made
 * QRIS strings to paste into /pay → Manual mode.
 *
 * Idempotent — uses ON CONFLICT (nmid) DO NOTHING for inserts.
 *
 * Usage (from repo root or apps/api):
 *   npm run seed:demo-merchants
 */

import { createClient } from "@supabase/supabase-js";

interface DemoMerchant {
  name: string;
  nmid: string;
  city: string;
  category_code: string;
  bank_code: string | null;
  account_number: string | null;
  account_holder: string | null;
}

const MERCHANTS: DemoMerchant[] = [
  {
    name: "Toko Sarah",
    nmid: "ID2024SARAHMERCH01",
    city: "Yogyakarta",
    category_code: "5499", // miscellaneous food stores
    bank_code: "014", // BCA
    account_number: "1234567890",
    account_holder: "Sarah Putri",
  },
  {
    name: "Warung Kopi Malam",
    nmid: "ID2024KOPIMLM02",
    city: "Bandung",
    category_code: "5814", // fast food restaurants
    bank_code: "008", // Mandiri
    account_number: "9876543210",
    account_holder: "Andika Pratama",
  },
  {
    name: "Online Shop ID",
    nmid: "ID2024ONLINEID03",
    city: "Jakarta",
    category_code: "5999", // miscellaneous retail
    bank_code: "009", // BNI
    account_number: "5555666677",
    account_holder: "Putri Wulandari",
  },
  {
    name: "Bengkel Motor Jaya",
    nmid: "ID2024BENGKEL04",
    city: "Surabaya",
    category_code: "7531", // auto body repair shops
    bank_code: "002", // BRI
    account_number: "1111222233",
    account_holder: "Joko Santoso",
  },
];

const DEMO_AMOUNTS = [10_000, 50_000, 250_000];

function envOrDie(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ ${name} not set`);
    process.exit(1);
  }
  return v;
}

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}

function crc16ccitt(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).padStart(4, "0").toUpperCase();
}

function buildQrisString(
  m: DemoMerchant,
  amount: number | null,
): string {
  const merchantInfo =
    tlv("00", "ID.CO.QRIS.WWW") +
    tlv("01", m.nmid) +
    tlv("02", "ID2020303652") +
    tlv("03", "UMI");

  const parts: string[] = [];
  parts.push(tlv("00", "01"));
  parts.push(tlv("01", amount === null ? "11" : "12"));
  parts.push(tlv("26", merchantInfo));
  parts.push(tlv("52", m.category_code));
  parts.push(tlv("53", "360"));
  if (amount !== null) parts.push(tlv("54", String(amount)));
  parts.push(tlv("58", "ID"));
  parts.push(tlv("59", m.name.slice(0, 25)));
  parts.push(tlv("60", m.city.slice(0, 15)));

  const beforeCrc = parts.join("") + "6304";
  const crc = crc16ccitt(beforeCrc);
  return beforeCrc + crc;
}

async function main() {
  const supabaseUrl = envOrDie("SUPABASE_URL");
  const serviceRole = envOrDie("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  // Pick the most recent user as the merchant owner. For multi-user testing,
  // this could be parameterized via --user-email or --privy-id.
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, email, solana_address")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (userErr || !user) {
    console.error("❌ no user found in DB. Sign up via the app first.");
    process.exit(1);
  }
  console.log(`Owner: ${user.email ?? user.id}\n`);

  // Idempotent insert — skip rows whose NMID already exists.
  for (const m of MERCHANTS) {
    const { error: insErr } = await supabase
      .from("merchants")
      .upsert(
        {
          owner_user_id: user.id,
          name: m.name,
          nmid: m.nmid,
          city: m.city,
          is_verified: true, // demo data, mark verified for cleaner UI
          bank_code: m.bank_code,
          account_number: m.account_number,
          account_holder: m.account_holder,
        },
        { onConflict: "nmid", ignoreDuplicates: true },
      );
    if (insErr) {
      console.error(`  ✗ ${m.name} (${m.nmid}): ${insErr.message}`);
    } else {
      console.log(`  ✓ ${m.name} (${m.nmid}) @ ${m.city}`);
    }
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("DEMO QRIS STRINGS — paste into /pay → Manual mode");
  console.log("──────────────────────────────────────────────\n");

  for (const m of MERCHANTS) {
    console.log(`▸ ${m.name} (${m.city}) — NMID ${m.nmid}`);
    for (const amt of DEMO_AMOUNTS) {
      const qris = buildQrisString(m, amt);
      console.log(`  Rp ${amt.toLocaleString("id-ID")}:`);
      console.log(`    ${qris}\n`);
    }
    // Also a static one (no amount — user inputs at scan time)
    const staticQris = buildQrisString(m, null);
    console.log(`  Static (user inputs amount):`);
    console.log(`    ${staticQris}\n`);
  }

  console.log(
    "Done. Check /merchant in the app to see the seeded merchants,",
  );
  console.log("and /pay → Manual to paste any QRIS string above.");
}

main().catch((err) => {
  console.error("❌ seed failed:", err);
  process.exit(1);
});
