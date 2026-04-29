// Public runtime env. Validated lazily so the app fails fast in browser when
// .env.local is missing — but never crashes the build.
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Copy .env.example → apps/web/.env.local and fill it.`,
    );
  }
  return value;
}

export const publicEnv = {
  privyAppId: () => required("NEXT_PUBLIC_PRIVY_APP_ID", process.env.NEXT_PUBLIC_PRIVY_APP_ID),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  apiUrl: () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787",
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};
