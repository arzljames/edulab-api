import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { REQUEST_SUPABASE_CLIENT } from './../src/shared/supabase/request-supabase-client.provider';
import { SUPABASE_CLIENT } from './../src/shared/supabase/supabase-client.provider';
import {
  createQueryBuilder,
  type QueryBuilderMock,
} from './../src/features/resources/supabase-query-builder.mock';

describe('ActivityLog (e2e)', () => {
  let app: INestApplication<App>;
  let supabase: { from: jest.Mock; rpc: jest.Mock; auth: { getUser: jest.Mock } };

  const mockUser = {
    id: 'user-1',
    email: 'teacher@edulab.dev',
  } as User;

  const auditLogRow = {
    audit_log_id: 'log-1',
    user_id: mockUser.id,
    action_title: 'Created resource',
    description: 'Grade 5 Fractions Worksheet',
    icon: 'plus-circle',
    created_at: '2026-01-10T08:30:00.000Z',
  };

  function authenticate(): void {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  }

  function queueFrom(...builders: QueryBuilderMock[]): void {
    for (const builder of builders) {
      supabase.from.mockReturnValueOnce(builder);
    }
  }

  beforeEach(async () => {
    supabase = {
      from: jest.fn(),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: { getUser: jest.fn() },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SUPABASE_CLIENT)
      .useValue(supabase)
      .overrideProvider(REQUEST_SUPABASE_CLIENT)
      .useValue(supabase)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /activity-log', () => {
    it('returns 401 with no Authorization header', () => {
      return request(app.getHttpServer()).get('/api/v1/activity-log').expect(401);
    });

    it('returns 200 with a mapped, camelCased list on success', async () => {
      authenticate();
      const builder = createQueryBuilder({ data: [auditLogRow], error: null });
      queueFrom(builder);

      const response = await request(app.getHttpServer())
        .get('/api/v1/activity-log')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 'log-1',
          actionTitle: 'Created resource',
          description: 'Grade 5 Fractions Worksheet',
          icon: 'plus-circle',
          createdAt: auditLogRow.created_at,
        },
      ]);
      expect(builder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(builder.range).toHaveBeenCalledWith(0, 19);
    });

    it('applies page/limit query params to the range', async () => {
      authenticate();
      const builder = createQueryBuilder({ data: [], error: null });
      queueFrom(builder);

      await request(app.getHttpServer())
        .get('/api/v1/activity-log')
        .query({ page: 2, limit: 5 })
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(builder.range).toHaveBeenCalledWith(5, 9);
    });

    it('rejects limit=0 with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .get('/api/v1/activity-log')
        .query({ limit: 0 })
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('rejects limit=101 (over the max of 100) with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .get('/api/v1/activity-log')
        .query({ limit: 101 })
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });
  });
});
