import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './features/auth/auth.module';

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
  imports: [...observeImports, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
