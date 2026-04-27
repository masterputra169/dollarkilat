/**
 * Cross-app constants. Keep numbers here so frontend & backend agree.
 */

// SPL token decimals
export const USDC_DECIMALS = 6;
export const IDR_DECIMALS = 0;

// USDC mint addresses
export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Quote / pricing rules
export const QUOTE_TTL_SECONDS = 30;
export const SLIPPAGE_BPS = 50; // 0.5%
export const APP_FEE_BPS = 50; // 0.5%

// Sponsored quota (free tier)
export const SPONSORED_FREE_QUOTA = 5;

// Delegated actions default policy (Indonesian Rupiah)
export const DELEGATED_DEFAULT_MAX_PER_TX_IDR = 500_000;
export const DELEGATED_DEFAULT_MAX_PER_DAY_IDR = 5_000_000;
export const DELEGATED_CONSENT_TTL_DAYS = 30;

// Payment amount bounds (IDR)
export const MIN_PAYMENT_IDR = 1_000;
export const MAX_PAYMENT_IDR = 1_600_000;

// Rate limits
export const RATE_LIMIT_PER_USER_PER_MIN = 10;
export const RATE_LIMIT_PER_USER_PER_DAY = 100;
export const RATE_LIMIT_PER_IP_PER_MIN = 30;
