/**
 * Re-exports the generated Supabase database types so feature code can
 * import them via a stable `src/`-local path instead of reaching outside
 * `src/` on every call site. The canonical, generated file stays at
 * `supabase/database.types.ts` (owned by the database-specialist workflow,
 * regenerated with the Supabase CLI) — do not hand-edit either file.
 */
export type { Database, Json } from '../../../supabase/database.types';
