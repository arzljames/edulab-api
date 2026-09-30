import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityLogModule } from './features/activity-log/activity-log.module';
import { AuthModule } from './features/auth/auth.module';
import { ProfilesModule } from './features/profiles/profiles.module';
import { ResourcesModule } from './features/resources/resources.module';
import { UploadsModule } from './features/uploads/uploads.module';
import { SharedSupabaseModule } from './shared/supabase/supabase.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const observeImports =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        ObserveModule.forRoot({
          appKey: 'YOUR_APP_KEY',
          appSecret: 'YOUR_APP_SECRET',
          serviceId: 'teachers-hub-api',
        }),
      ];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ...observeImports,
    SharedSupabaseModule,
    AuthModule,
    ActivityLogModule,
    ResourcesModule,
    ProfilesModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
