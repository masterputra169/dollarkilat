import { publicEnv } from "./env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiOptions extends RequestInit {
  /** Privy access token. Pass `undefined` for unauthenticated calls. */
  token?: string | null;
}

/**
 * Thin fetch wrapper for @dollarkilat/api. Adds bearer auth + JSON parsing
 * + structured error throwing.
 *
 * Usage:
 *   const token = await getAccessToken();
 *   const { user } = await api<{ user: User }>("/users/sync", {
 *     method: "POST",
 *     token,
 *   });
 */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const url = `${publicEnv.apiUrl()}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    const code = (body as { error?: string } | null)?.error ?? "http_error";
    const message = (body as { message?: string } | null)?.message ?? res.statusText;
    throw new ApiError(res.status, code, message);
  }

  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
