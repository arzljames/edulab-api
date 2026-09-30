import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { Database } from '../../shared/supabase/database.types';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import type { ResourceResponseDto } from './dto/resource-response.dto';
import {
  assertResourceVisible,
  extractTagNames,
  toResourceResponse,
  type ResourceWithTags,
} from './resources.helpers';

@Injectable()
export class StarsService {
  private readonly logger = new Logger(StarsService.name);

  constructor(
    @Inject(REQUEST_SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async star(resourceId: string, userId: string): Promise<void> {
    // Load-bearing, not defense-in-depth: unlike `comments`, the
    // `stars_insert_own` RLS policy only checks `auth.uid() = user_id` and
    // does not verify the resource is visible to the caller. This check is
    // the sole guard against starring someone else's private/draft
    // resource — do not remove it without hardening that policy first.
    await assertResourceVisible(this.supabase, resourceId);

    const { error } = await this.supabase.from('stars').upsert(
      { user_id: userId, resource_id: resourceId },
      { onConflict: 'user_id,resource_id', ignoreDuplicates: true },
    );

    if (error) {
      this.logger.error(
        `Failed to star resource ${resourceId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to star resource.');
    }

    await this.activityLogService.record('Starred a resource', undefined, 'star');
  }

  async unstar(resourceId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('stars')
      .delete()
      .eq('resource_id', resourceId)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to remove star for resource ${resourceId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to remove star.');
    }
  }

  async findMine(userId: string): Promise<ResourceResponseDto[]> {
    const { data, error } = await this.supabase
      .from('stars')
      .select('created_at, resources(*, resource_tags(tags(name)))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch stars for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to fetch stars.');
    }

    return ((data ?? []) as unknown as { resources: ResourceWithTags | null }[])
      .map((row) => row.resources)
      .filter((resource): resource is ResourceWithTags => resource !== null)
      .map((resource) => toResourceResponse(resource, extractTagNames(resource)));
  }
}
