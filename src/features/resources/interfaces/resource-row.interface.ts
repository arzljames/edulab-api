import type { Database } from '../../../shared/supabase/database.types';

/**
 * Row shapes sourced from the generated Supabase types, re-exported here so
 * services/controllers in this feature have a short, feature-local import
 * path. These are internal shapes, not response contracts — response DTOs
 * (mapped from these rows) are added by api-designer in a later pass.
 */
export type ResourceRow = Database['public']['Tables']['resources']['Row'];
export type TagRow = Database['public']['Tables']['tags']['Row'];
export type BookmarkRow = Database['public']['Tables']['bookmarks']['Row'];
export type StarRow = Database['public']['Tables']['stars']['Row'];
export type CommentRow = Database['public']['Tables']['comments']['Row'];
