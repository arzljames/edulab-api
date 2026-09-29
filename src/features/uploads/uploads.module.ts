import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedSupabaseModule } from '../../shared/supabase/supabase.module';
import { cloudinaryClientProvider } from './cloudinary-client.provider';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import cloudinaryConfig from './uploads-config';

@Module({
  imports: [ConfigModule.forFeature(cloudinaryConfig), SharedSupabaseModule],
  controllers: [UploadsController],
  providers: [cloudinaryClientProvider, UploadsService],
})
export class UploadsModule {}
