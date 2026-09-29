import { Module } from '@nestjs/common';
import { SharedSupabaseModule } from '../../shared/supabase/supabase.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [SharedSupabaseModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
