import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/supabase/database.types';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import type { ActivityLogEntryResponseDto } from './dto/activity-log-entry-response.dto';
import type { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import type { ActivityLogRow } from './interfaces/activity-log-row.interface';

function toActivityLogEntryResponse(
  row: ActivityLogRow,
): ActivityLogEntryResponseDto {
  return {
    id: row.audit_log_id,
    actionTitle: row.action_title,
    description: row.description,
    icon: row.icon,
    createdAt: row.created_at,
  };
}

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @Inject(REQUEST_SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async findMine(
    userId: string,
    query: ActivityLogQueryDto,
  ): Promise<ActivityLogEntryResponseDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error } = await this.supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(
        `Failed to fetch activity log for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to fetch activity log.');
    }

    return (data ?? []).map(toActivityLogEntryResponse);
  }

  /**
   * Records an activity entry for the *calling* user via the `log_activity`
   * RPC (`SECURITY DEFINER`; always attributes the entry to `auth.uid()`
   * server-side — there is no user id parameter, so a caller can never
   * attribute an entry to someone else).
   *
   * Deliberately never throws: activity logging is a best-effort side
   * effect of some other operation (a resource was created, a comment was
   * posted, ...) that has already succeeded by the time this is called. A
   * transient failure to record the log entry must not fail the caller's
   * actual operation — it's only logged server-side.
   */
  async record(
    actionTitle: string,
    description?: string,
    icon?: string,
  ): Promise<void> {
    const { error } = await this.supabase.rpc('log_activity', {
      p_action_title: actionTitle,
      p_description: description,
      p_icon: icon,
    });

    if (error) {
      this.logger.error(`Failed to record activity "${actionTitle}": ${error.message}`);
    }
  }
}
