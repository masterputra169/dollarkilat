# 06 — Sponsored Tx + Delegated Actions

> **Baca file ini saat:** kerjain fee payer wallet, `/api/sponsor-tx`, `/api/qris/pay`, atau delegated actions consent flow.
>
> **Status:** CRITICAL untuk UX dan untuk pitch. Kalau ini gagal demo, kredibilitas jatuh.

---

## Kenapa Ini Penting

UX optimization terbagi 2 layer yang bekerja paralel:

1. **Layer 1: Gasless** — user tidak perlu beli SOL. Kita bayarin gas via fee payer.
2. **Layer 2: Popupless** — user tidak perlu sign popup tiap transaksi. Pre-authorize sekali via delegated actions.

Tanpa keduanya, UX kita terasa seperti dApp biasa. Dengan keduanya, UX kita terasa seperti GoPay.

---

## Layer 1: Gasless via Fee Payer Pattern

### Konsep

Solana tidak punya "Account Abstraction" seperti EVM. Yang setara adalah **Fee Payer Pattern** yang **native di protocol level**:

- 1 transaksi Solana boleh punya 2 signer:
  1. **Owner authority** (user) — authorize tindakan (transfer USDC milik dia)
  2. **Fee payer** (backend kita) — bayar gas SOL
- Onchain terlihat normal — tidak ada smart contract khusus
- Tidak ada middleware, tidak ada relayer protocol — pure Solana primitive

### Strategi Hybrid Sponsored Model (LOCKED)

| Tier | Quota | Mekanisme |
| --- | --- | --- |
| **Free (default)** | 5 tx pertama | 100% sponsored oleh kita |
| **Active user** | Unlimited | Gas auto-deduct dari fee aplikasi 0.5% |
| **Premium (future)** | Unlimited | Always free, bayar subscription |

### Kalkulasi ekonomi

- Cost per sponsored tx: ~$0.0001 = ~Rp 1.5
- 5 tx × Rp 1.5 = **Rp 7.5 per user acquisition**
- Untuk user yang convert → 0.5% fee × avg Rp 50.000 tx = Rp 250 revenue per tx
- **Break-even setelah 1 transaksi paid.** Sangat profitable.

### Funding strategy

| Phase | Network | SOL Balance | Cost (USD) |
| --- | --- | --- | --- |
| Hackathon demo | Devnet | 5 SOL (faucet) | $0 |
| Beta launch | Mainnet | 5 SOL | ~$1.000 |
| Production v1 | Mainnet | 50 SOL (10K tx/bln) | ~$10.000/bln, atau $0.001/tx |
| Auto top-up | Mainnet | Cron-triggered | Operasional |

### Code: Generate Fee Payer

```ts
// scripts/generate-fee-payer.ts
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const keypair = Keypair.generate();
console.log('Public key:', keypair.publicKey.toBase58());
console.log('Private key (base58):', bs58.encode(keypair.secretKey));
console.log('\nSimpan private key ke .env.local sebagai FEE_PAYER_PRIVATE_KEY');
console.log('Fund dengan: solana airdrop 5', keypair.publicKey.toBase58(), '--url devnet');
```

### Code: Backend signer helper

```ts
// lib/fee-payer.ts
import { Keypair, Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

let _feePayer: Keypair | null = null;

export function getFeePayer(): Keypair {
  if (_feePayer) return _feePayer;
  const secret = process.env.FEE_PAYER_PRIVATE_KEY;
  if (!secret) throw new Error('FEE_PAYER_PRIVATE_KEY not set');
  _feePayer = Keypair.fromSecretKey(bs58.decode(secret));
  return _feePayer;
}

export function getConnection(): Connection {
  const url = process.env.HELIUS_RPC_URL;
  if (!url) throw new Error('HELIUS_RPC_URL not set');
  return new Connection(url, 'confirmed');
}
```

---

## Layer 2: Popupless via Privy Delegated Actions

### Konsep

Default Privy flow menampilkan biometric popup tiap kali user sign. Untuk daily payment app, ini adalah **killer friction**. Solusinya: Privy Delegated Actions.

### Cara kerja

- User memberikan konsen sekali di onboarding untuk delegasikan permission spesifik
- Setelah itu, backend bisa sign atas nama user via `privy.walletApi` — **tanpa popup**
- Mekanisme: Shamir Secret Sharing + Trusted Execution Environment (TEE) di Privy
- User retain kontrol: bisa revoke instant, set policy spesifik, export private key share

### Real-world precedent (powerful untuk pitch)

- **Pump.fun** — instant trading, no popups, millions in volume per user
- **Jupiter Quick Account** — frictionless trading via embedded wallet abstraction

### Hybrid Mode Design (LOCKED)

| Mode | Trigger | Behavior |
| --- | --- | --- |
| **One-Tap (default)** | Amount ≤ Rp 500.000 + within daily limit | Skip popup, auto-sign via delegated actions |
| **Biometric (large)** | Amount > Rp 500.000 | Show Privy popup, user biometric confirm |
| **Mode Aman (opsional)** | User toggle off di settings | Always show popup regardless |

### Delegated Actions Policy Scope (CRITICAL)

Karena attacker yang compromise app bisa drain user dalam batas delegasi, **scope harus ketat**:

```ts
// Saat user consent ke delegated actions:
{
  permissions: [{
    action: 'spl_token_transfer',
    mint: USDC_MINT,
    destination: TREASURY_USDC_ATA,  // hanya ke treasury kita
    maxAmountPerTx: 500_000_000,     // 500 USDC = ~Rp 8jt
    maxAmountPerDay: 5_000_000_000,  // 5K USDC = ~Rp 80jt
  }],
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 hari
}
```

**Re-consent tiap 30 hari** untuk security hygiene.

---

## Implementation: Backend Endpoint

```ts
// app/api/qris/pay/route.ts
import { PrivyClient } from '@privy-io/server-auth';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import { getFeePayer, getConnection } from '@/lib/fee-payer';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const PaySchema = z.object({
  quote_id: z.string().uuid(),
  qris_string: z.string().min(20).max(500),
  mode: z.enum(['delegated', 'biometric']),
  signed_tx: z.string().optional(), // required for biometric mode
});

export async function POST(req: Request) {
  // 1. Auth
  const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!accessToken) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  
  const verifiedClaims = await privy.verifyAuthToken(accessToken).catch(() => null);
  if (!verifiedClaims) return Response.json({ error: 'Invalid token' }, { status: 401 });
  
  // 2. Rate limit
  const rl = await rateLimit(verifiedClaims.userId, 'qris_pay');
  if (!rl.allowed) return Response.json({ error: 'Rate limited' }, { status: 429 });
  
  // 3. Parse + validate input
  const body = await req.json();
  const parsed = PaySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Invalid input' }, { status: 400 });
  const { quote_id, qris_string, mode, signed_tx } = parsed.data;
  
  // 4. Load quote, validate freshness + ownership
  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('*')
    .eq('id', quote_id)
    .single();
  if (!quote || quote.user_id !== verifiedClaims.userId) {
    return Response.json({ error: 'Invalid quote' }, { status: 400 });
  }
  if (Date.now() > new Date(quote.expires_at).getTime()) {
    return Response.json({ error: 'Quote expired' }, { status: 400 });
  }
  
  // 5. Quota check (atomic)
  const { data: user } = await supabaseAdmin.rpc('increment_sponsored_quota', {
    p_user_id: verifiedClaims.userId,
  });
  if (!user || user.sponsored_tx_used > user.sponsored_tx_quota) {
    return Response.json({ error: 'Sponsored quota exceeded' }, { status: 402 });
  }
  
  // 6. Cek delegated consent jika mode = delegated
  if (mode === 'delegated') {
    const { data: consent } = await supabaseAdmin
      .from('delegated_actions_consents')
      .select('*')
      .eq('user_id', verifiedClaims.userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('consented_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!consent || !consent.enabled) {
      return Response.json({ error: 'Delegated consent missing' }, { status: 403 });
    }
    if (quote.amount_idr > consent.max_per_tx_idr) {
      return Response.json({ error: 'Outside policy, use biometric' }, { status: 403 });
    }
    // TODO: cek max_per_day_idr (sum of today's tx)
  }
  
  // 7. Build Solana tx (USDC transfer dari user ke treasury)
  const connection = getConnection();
  const feePayer = getFeePayer();
  const tx = await buildUSDCTransferTx({
    from: new PublicKey(quote.user_solana_address),
    to: new PublicKey(process.env.TREASURY_USDC_ATA!),
    amount: quote.amount_usdc_lamports, // bigint, 6 decimals
    feePayer: feePayer.publicKey,
  });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  
  // 8. Sign user side
  let signedTx: Transaction;
  if (mode === 'delegated') {
    // No popup — Privy signs via TEE
    const result = await privy.walletApi.solana.signTransaction({
      address: quote.user_solana_address,
      chainType: 'solana',
      transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
    });
    signedTx = Transaction.from(Buffer.from(result.signedTransaction, 'base64'));
  } else {
    // Biometric mode — tx already signed by frontend
    if (!signed_tx) return Response.json({ error: 'signed_tx required' }, { status: 400 });
    signedTx = Transaction.from(Buffer.from(signed_tx, 'base64'));
  }
  
  // 9. Co-sign as fee payer + submit
  signedTx.partialSign(feePayer);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  
  // 10. Record tx in DB
  const { data: txRecord } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: verifiedClaims.userId,
      type: 'qris_payment',
      amount_usdc: quote.amount_usdc,
      amount_idr: quote.amount_idr,
      exchange_rate: quote.exchange_rate,
      status: 'solana_pending',
      solana_signature: signature,
      qris_data: { qris_string, merchant: quote.merchant_name },
      merchant_name: quote.merchant_name,
      was_sponsored: true,
      was_delegated: mode === 'delegated',
    })
    .select()
    .single();
  
  // 11. Wait confirmation (don't block response — fire and forget)
  confirmAndSettle(connection, signature, lastValidBlockHeight, txRecord!.id, qris_string);
  
  // 12. Return immediately
  return Response.json({
    transaction_id: txRecord!.id,
    status: 'solana_pending',
    signature,
  });
}

async function confirmAndSettle(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
  txId: string,
  qrisString: string
) {
  try {
    await connection.confirmTransaction({ signature, blockhash: '', lastValidBlockHeight }, 'confirmed');
    await supabaseAdmin.from('transactions').update({ status: 'solana_confirmed' }).eq('id', txId);
    
    // Trigger PJP settlement (sandbox simulation untuk demo)
    await pjpPartner.executeQRISPayment({
      qris_string: qrisString,
      idempotency_key: txId,
    });
    
    await supabaseAdmin.from('transactions').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', txId);
  } catch (err) {
    await supabaseAdmin.from('transactions').update({ status: 'failed_settlement' }).eq('id', txId);
    // TODO: refund USDC ke user
  }
}
```

---

## Anti-Abuse Checklist

- ✅ Privy session auth sebelum sign apapun
- ✅ Rate limit per user: 10 tx/menit, 100 tx/hari
- ✅ Rate limit per IP: 30 tx/menit
- ✅ Tx instruction validation: hanya USDC transfer ke treasury kita
- ✅ Amount validation: Rp 1.000 minimum, Rp 1.6 juta maksimum (mainnet bisa dinaikkan)
- ✅ Quota tracking atomic di DB (PostgreSQL UPDATE ... RETURNING)
- ✅ Sponsored tx log untuk audit + analytics
- ✅ Alert system: notifikasi kalau fee payer balance < 0.5 SOL
- ✅ Delegated consent expiration (30 hari, force re-consent)
- ✅ Delegated policy enforcement at multiple layers (Privy server-side + backend validation)
- ✅ User dashboard menampilkan "X transactions used in delegated mode today" untuk transparency

---

## Tx Instruction Validation (CRITICAL)

Backend WAJIB validate bahwa tx yang akan disponsori HANYA berisi instruction yang kita expect. Tanpa ini, attacker bisa kirim malicious tx dan kita bayar gasnya.

```ts
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

function validateTxInstructions(tx: Transaction, expectedAmount: bigint, userAddress: string): void {
  // Allow only 1-2 instructions: optional ATA create + transfer
  if (tx.instructions.length > 2) {
    throw new Error('Too many instructions');
  }
  
  for (const ix of tx.instructions) {
    if (ix.programId.equals(TOKEN_PROGRAM_ID)) {
      // Decode SPL transfer instruction, verify:
      // - source ATA = user's USDC ATA
      // - destination ATA = TREASURY_USDC_ATA
      // - amount matches expectedAmount
      // - mint = USDC_MINT
      // ... (use @solana/spl-token decodeTransferInstruction)
    } else {
      throw new Error(`Unexpected program: ${ix.programId.toBase58()}`);
    }
  }
}
```

---

## Frontend: Consent Onboarding

```tsx
// app/onboarding/consent/page.tsx
'use client';
import { usePrivy } from '@privy-io/react-auth';

export default function ConsentPage() {
  const { user } = usePrivy();

  const handleConsent = async (mode: 'one-tap' | 'mode-aman') => {
    if (mode === 'mode-aman') {
      await fetch('/api/consent/delegated', { method: 'POST', body: JSON.stringify({ enabled: false }) });
    } else {
      await fetch('/api/consent/delegated', {
        method: 'POST',
        body: JSON.stringify({
          enabled: true,
          max_per_tx_idr: 500_000,
          max_per_day_idr: 5_000_000,
        }),
      });
    }
    // navigate to dashboard
  };

  return (
    <div className="...">
      <h1>Pilih cara bayar kamu</h1>
      
      <Card onClick={() => handleConsent('one-tap')}>
        <h2>⚡ One-Tap Pay (recommended)</h2>
        <p>Bayar instan untuk transaksi kecil, tanpa popup. Untuk amount besar (&gt; Rp 500.000), tetap pakai biometric.</p>
        <ul>
          <li>✅ Limit Rp 500K per transaksi</li>
          <li>✅ Limit Rp 5jt per hari</li>
          <li>✅ Bisa di-revoke kapan saja di Settings</li>
          <li>✅ Re-consent otomatis tiap 30 hari</li>
        </ul>
      </Card>
      
      <Card onClick={() => handleConsent('mode-aman')}>
        <h2>🔒 Mode Aman</h2>
        <p>Setiap transaksi butuh biometric confirm. Lebih aman, lebih ribet.</p>
      </Card>
    </div>
  );
}
```

---

## Settings: Revoke Delegated Actions

Di Settings, tampilkan:

```
─────────────────────────────────────
One-Tap Pay
[●  ] Aktif
Max per transaksi:  Rp 500.000
Max per hari:       Rp 5.000.000
Tujuan:             Treasury dollarkilat saja
Berlaku hingga:     22 Mei 2026 (27 hari lagi)

[ Revoke akses ] [ Ubah limit ]
─────────────────────────────────────

Hari ini, kamu sudah pakai 3 transaksi one-tap (Rp 145.000)
─────────────────────────────────────
```

Revoke = call `DELETE /api/consent/delegated/:id` + Privy API revoke. Efek instant.

**Powerful trust moment di demo** — show jurior bisa "matikan akses kapan saja".
