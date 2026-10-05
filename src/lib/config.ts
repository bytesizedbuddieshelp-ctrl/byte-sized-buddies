// Public settings. They are safe in the browser: the database rules protect the data, not these values.
// Fill them in your .env file and in Cloudflare (docs/DEPLOY.md).
export const supabaseUrl: string = (import.meta.env.PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
export const supabaseKey: string = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

// False until the owner has set up Supabase. Forms say "not connected yet" until then.
export const isConfigured: boolean =
  supabaseUrl.startsWith('https://') && supabaseKey.length > 20 && !supabaseUrl.includes('YOUR-PROJECT');
