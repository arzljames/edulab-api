import { Module } from '@nestjs/common';
import { SharedSupabaseModule } from '../../shared/supabase/supabase.module';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';

@Module({
  imports: [SharedSupabaseModule],
  controllers: [ActivityLogController],
  providers: [ActivityLogService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
