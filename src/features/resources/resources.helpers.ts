import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/supabase/database.types';
import { ResourceVisibility } from './dto/create-resource.dto';
import type { ResourceResponseDto } from './dto/resource-response.dto';
import { ResourceStatus } from './dto/update-resource.dto';
import type { ResourceRow, TagRow } from './interfaces/resource-row.interface';

const logger = new Logger('ResourcesHelpers');

export const RESOURCE_SELECT_WITH_TAGS = '*, resource_tags(tags(name))';

export type ResourceWithTags = ResourceRow & {
  resource_tags: { tags: Pick<TagRow, 'name'> | null }[] | null;
};

export function extractTagNames(row: ResourceWithTags): string[] {
  return (row.resource_tags ?? [])
    .map((join) => join.tags?.name)
    .filter((name): name is string => Boolean(name));
}

export function toResourceResponse(
  row: ResourceRow,
  tags: string[],
): ResourceResponseDto {
  return {
    id: row.resource_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    gradeLevel: row.grade_level,
    subject: row.subject,
    file: row.file,
    visibility: row.visibility as ResourceVisibility,
    status: row.status as ResourceStatus,
    publishedAt: row.published_at,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Confirms a resource exists and is visible to the caller (RLS already
 * scopes the SELECT to owner-or-public+published) before allowing a
 * dependent action against it — bookmarking, starring, or commenting on a
 * resource that doesn't exist or isn't visible should 404, not silently
 * fail an FK/RLS check further down.
 */
export async function assertResourceVisible(
  supabase: SupabaseClient<Database>,
  resourceId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('resources')
    .select('resource_id')
    .eq('resource_id', resourceId)
    .maybeSingle();

  if (error) {
    logger.error(`Failed to verify resource ${resourceId}: ${error.message}`);
    throw new BadRequestException('Failed to verify resource.');
  }

  if (!data) {
    throw new NotFoundException('Resource not found.');
  }
}
