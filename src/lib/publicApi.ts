import { isConfigured, supabaseKey, supabaseUrl } from './config';

// Public pages call the database with plain fetch, so they do not need the whole Supabase library.
// Only database functions that are safe for strangers are called here (see supabase/schema.sql).

export class ApiError extends Error {
  /** True when the database refused with one of our own plain-language messages. */
  friendly: boolean;
  constructor(message: string, friendly: boolean) {
    super(message);
    this.friendly = friendly;
  }
}

export const genericError = 'Something went wrong. Please try again in a few minutes.';

export async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!isConfigured) throw new ApiError('Not connected.', false);
  const headers: Record<string, string> = { apikey: supabaseKey, 'Content-Type': 'application/json' };
  // Older anon keys are JWTs and also go in Authorization. Newer publishable keys do not.
  if (supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseKey}`;

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch {
    throw new ApiError(genericError, false);
  }

  const text = await response.text();
  const body = text ? safeJson(text) : null;
  if (!response.ok) {
    // Messages we raise ourselves in the database arrive with code P0001. Anything else stays generic.
    const ours = body && typeof body === 'object' && (body as { code?: string }).code === 'P0001';
    throw new ApiError(ours ? String((body as { message?: string }).message) : genericError, Boolean(ours));
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

/** Reads rows the public is allowed to see (for example published lessons). The database rules decide what comes back. */
export async function restGet<T>(pathAndQuery: string): Promise<T> {
  if (!isConfigured) throw new ApiError('Not connected.', false);
  const headers: Record<string, string> = { apikey: supabaseKey };
  if (supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseKey}`;
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/${pathAndQuery}`, { headers });
  } catch {
    throw new ApiError(genericError, false);
  }
  if (!response.ok) throw new ApiError(genericError, false);
  return (await response.json()) as T;
}
