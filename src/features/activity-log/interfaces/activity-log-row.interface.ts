import type { Database } from '../../../shared/supabase/database.types';

/**
 * Row shape sourced from the generated Supabase types, re-exported here so
 * services/controllers in this feature have a short, feature-local import
 * path. This is an internal shape, not a response contract — the response
 * DTO (mapped from this row) is added by api-designer in a later pass.
 */
export type ActivityLogRow = Database['public']['Tables']['audit_logs']['Row'];
