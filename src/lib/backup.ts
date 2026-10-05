import type { SupabaseClient } from '@supabase/supabase-js';

// Every table the owner can read, saved into one JSON file. Lesson PDFs and pictures are not in it
// (download each lesson as a kit for those). Rows are read 1,000 at a time, because that is the
// most the database sends in one go.
export const BACKUP_TABLES = ['lessons', 'videos', 'tickets', 'contact_requests', 'inbox_messages', 'outbox', 'settings'] as const;

export async function backupEverything(supabase: SupabaseClient): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { made_at: new Date().toISOString(), format: 'byte-sized-buddies-backup-1' };
  for (const table of BACKUP_TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999);
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    out[table] = rows;
  }
  return out;
}
