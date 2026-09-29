import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Session, User } from '@supabase/supabase-js';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SUPABASE_CLIENT } from './../src/shared/supabase/supabase-client.provider';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let supabase: {
    auth: {
      signUp: jest.Mock;
      signInWithPassword: jest.Mock;
      refreshSession: jest.Mock;
      getUser: jest.Mock;
    };
  };

  const mockUser = {
    id: 'user-1',
    email: 'student@edulab.dev',
  } as User;

  const mockSession = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: 1732384421,
    expires_in: 3600,
    token_type: 'bearer',
    user: mockUser,
  } as Session;

  beforeEach(async () => {
    supabase = {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        refreshSession: jest.fn(),
        getUser: jest.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SUPABASE_CLIENT)
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

  describe('POST /auth/signup', () => {
    it('rejects an invalid email with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('rejects a missing password with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email: 'student@edulab.dev' })
        .expect(400);
    });

    it('returns 201 with an AuthResponseDto on success', async () => {
      supabase.auth.signUp.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ email: mockUser.email, password: 'Str0ngPassword!' })
        .expect(201);

      expect(response.body).toEqual({
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresAt: mockSession.expires_at,
        user: { id: mockUser.id, email: mockUser.email },
      });
    });
  });

  describe('POST /auth/login', () => {
    it('rejects an invalid email with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('rejects a missing password with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'student@edulab.dev' })
        .expect(400);
    });

    it('returns 200 with an AuthResponseDto on success', async () => {
      supabase.auth.signInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: mockUser.email, password: 'Str0ngPassword!' })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token,
        expiresAt: mockSession.expires_at,
        user: { id: mockUser.id, email: mockUser.email },
      });
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 with no Authorization header', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns 200 with the current user for a valid bearer token', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toEqual({
        id: mockUser.id,
        email: mockUser.email,
      });
      expect(supabase.auth.getUser).toHaveBeenCalledWith('valid-token');
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 401 with no Authorization header', () => {
      return request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });
  });
});
