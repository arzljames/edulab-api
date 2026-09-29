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

describe('Profiles (e2e)', () => {
  let app: INestApplication<App>;
  let supabase: { from: jest.Mock; auth: { getUser: jest.Mock } };

  const mockUser = {
    id: 'user-1',
    email: 'teacher@edulab.dev',
  } as User;

  const profileId = 'a1b2c3d4-e5f6-4789-90ab-cdef01234567';

  const profileRow = {
    id: mockUser.id,
    first_name: 'Jane',
    middle_name: 'Marie',
    last_name: 'Doe',
    profile_photo: 'https://storage.edulab.dev/avatars/jane-doe.png',
    created_at: '2026-01-10T08:30:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
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
    supabase = { from: jest.fn(), auth: { getUser: jest.fn() } };

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

  describe('GET /profiles/me', () => {
    it('returns 401 with no Authorization header', () => {
      return request(app.getHttpServer()).get('/api/v1/profiles/me').expect(401);
    });

    it('returns 200 with the mapped profile for a valid bearer token', async () => {
      authenticate();
      queueFrom(createQueryBuilder({ data: profileRow, error: null }));

      const response = await request(app.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        id: mockUser.id,
        firstName: 'Jane',
        middleName: 'Marie',
        lastName: 'Doe',
        profilePhoto: 'https://storage.edulab.dev/avatars/jane-doe.png',
        createdAt: profileRow.created_at,
        updatedAt: profileRow.updated_at,
      });
    });
  });

  describe('GET /profiles/:id', () => {
    it('returns 200 with the mapped profile without authentication', async () => {
      queueFrom(createQueryBuilder({ data: profileRow, error: null }));

      const response = await request(app.getHttpServer())
        .get(`/api/v1/profiles/${profileId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: mockUser.id,
        firstName: 'Jane',
        middleName: 'Marie',
        lastName: 'Doe',
        profilePhoto: 'https://storage.edulab.dev/avatars/jane-doe.png',
        createdAt: profileRow.created_at,
        updatedAt: profileRow.updated_at,
      });
    });

    it('returns 404 when the profile does not exist', async () => {
      queueFrom(createQueryBuilder({ data: null, error: null }));

      await request(app.getHttpServer())
        .get(`/api/v1/profiles/${profileId}`)
        .expect(404);
    });
  });

  describe('PATCH /profiles/me', () => {
    it('returns 401 with no Authorization header', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .send({ firstName: 'Jane' })
        .expect(401);
    });

    it('returns 200 with the updated profile for a partial body', async () => {
      authenticate();
      const updatedRow = { ...profileRow, first_name: 'Janet' };
      queueFrom(createQueryBuilder({ data: updatedRow, error: null }));

      const response = await request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ firstName: 'Janet' })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ id: mockUser.id, firstName: 'Janet' }),
      );
    });

    it('rejects a firstName over 100 chars with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer valid-token')
        .send({ firstName: 'x'.repeat(101) })
        .expect(400);
    });
  });
});
