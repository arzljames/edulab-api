import { Module } from '@nestjs/common';
import { SharedSupabaseModule } from '../../shared/supabase/supabase.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [SharedSupabaseModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
