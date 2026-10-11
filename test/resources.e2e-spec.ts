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

describe('Resources (e2e)', () => {
  let app: INestApplication<App>;
  let supabase: { from: jest.Mock; rpc: jest.Mock; auth: { getUser: jest.Mock } };

  const mockUser = {
    id: 'user-1',
    email: 'teacher@edulab.dev',
  } as User;

  const resourceId = 'a1b2c3d4-e5f6-4789-90ab-cdef01234567';

  const resourceRow = {
    resource_id: resourceId,
    user_id: mockUser.id,
    title: 'Grade 5 Fractions Worksheet',
    description: null,
    grade_level: null,
    subject: null,
    file: null,
    visibility: 'public',
    status: 'draft',
    published_at: null,
    created_at: '2026-01-10T08:30:00.000Z',
    updated_at: '2026-01-10T08:30:00.000Z',
    resource_tags: [],
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
      // ActivityLogService.record() calls this after a successful mutation
      // and never throws on failure — default to a clean success so tests
      // that don't care about activity logging don't need to configure it.
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

  describe('validation', () => {
    it('rejects a create-resource body with no title with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .post('/api/v1/resources')
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);
    });

    it('rejects a create-resource body with a title over 200 chars with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .post('/api/v1/resources')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'x'.repeat(201) })
        .expect(400);
    });

    it('rejects a create-comment body with no comment with 400', () => {
      authenticate();

      return request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/comments`)
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);
    });
  });

  describe('guarded routes with no token', () => {
    it('returns 401 for POST /resources', () => {
      return request(app.getHttpServer())
        .post('/api/v1/resources')
        .send({ title: 'x' })
        .expect(401);
    });

    it('returns 401 for GET /resources/mine', () => {
      return request(app.getHttpServer()).get('/api/v1/resources/mine').expect(401);
    });

    it('returns 401 for PATCH /resources/:id', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/resources/${resourceId}`)
        .send({ title: 'x' })
        .expect(401);
    });

    it('returns 401 for DELETE /resources/:id', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/resources/${resourceId}`)
        .expect(401);
    });

    it('returns 401 for POST /resources/:id/bookmark', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/bookmark`)
        .expect(401);
    });

    it('returns 401 for POST /resources/:id/star', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/star`)
        .expect(401);
    });

    it('returns 401 for POST /resources/:id/comments', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/comments`)
        .send({ comment: 'hi' })
        .expect(401);
    });
  });

  describe('full resource lifecycle (mocked)', () => {
    it('creates, fetches, updates and deletes a resource', async () => {
      authenticate();

      // create(): insert into resources, then getTagNamesForResource (tags omitted).
      queueFrom(
        createQueryBuilder({ data: resourceRow, error: null }),
        createQueryBuilder({ data: [], error: null }),
      );

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/resources')
        .set('Authorization', 'Bearer valid-token')
        .send({ title: resourceRow.title })
        .expect(201);

      expect(createResponse.body).toEqual(
        expect.objectContaining({ id: resourceId, title: resourceRow.title, tags: [] }),
      );
      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Created resource',
        p_description: resourceRow.title,
        p_icon: 'plus-circle',
      });
      supabase.rpc.mockClear();

      // findOne(): single select with tags.
      queueFrom(createQueryBuilder({ data: resourceRow, error: null }));

      const findOneResponse = await request(app.getHttpServer())
        .get(`/api/v1/resources/${resourceId}`)
        .expect(200);

      expect(findOneResponse.body.id).toBe(resourceId);

      // update(): update row (title only, tags left untouched via getTagNamesForResource).
      const updatedRow = { ...resourceRow, title: 'Updated title' };
      queueFrom(
        createQueryBuilder({ data: updatedRow, error: null }),
        createQueryBuilder({ data: [], error: null }),
      );

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/v1/resources/${resourceId}`)
        .set('Authorization', 'Bearer valid-token')
        .send({ title: 'Updated title' })
        .expect(200);

      expect(updateResponse.body.title).toBe('Updated title');
      // dto.status wasn't 'published', so no activity should be recorded.
      expect(supabase.rpc).not.toHaveBeenCalled();

      // remove(): delete scoped to id + owner (also selects title, for the activity log).
      queueFrom(
        createQueryBuilder({
          data: { resource_id: resourceId, title: updatedRow.title },
          error: null,
        }),
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/resources/${resourceId}`)
        .set('Authorization', 'Bearer valid-token')
        .expect(204);

      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Deleted resource',
        p_description: updatedRow.title,
        p_icon: 'trash-2',
      });
    });
  });

  describe('bookmark / star / comment creation (mocked)', () => {
    it('bookmarks a resource', async () => {
      authenticate();
      queueFrom(
        createQueryBuilder({ data: { resource_id: resourceId }, error: null }),
        createQueryBuilder({ data: null, error: null }),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/bookmark`)
        .set('Authorization', 'Bearer valid-token')
        .expect(201);

      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Bookmarked a resource',
        p_description: undefined,
        p_icon: 'bookmark',
      });
    });

    it('stars a resource', async () => {
      authenticate();
      queueFrom(
        createQueryBuilder({ data: { resource_id: resourceId }, error: null }),
        createQueryBuilder({ data: null, error: null }),
      );

      await request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/star`)
        .set('Authorization', 'Bearer valid-token')
        .expect(201);

      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Starred a resource',
        p_description: undefined,
        p_icon: 'star',
      });
    });

    it('comments on a resource', async () => {
      authenticate();
      const commentRow = {
        comment_id: 'c1',
        resource_id: resourceId,
        user_id: mockUser.id,
        parent_comment_id: null,
        comment: 'Great resource!',
        created_at: '2026-01-10T08:30:00.000Z',
        updated_at: '2026-01-10T08:30:00.000Z',
      };
      queueFrom(
        createQueryBuilder({ data: { resource_id: resourceId }, error: null }),
        createQueryBuilder({ data: commentRow, error: null }),
      );

      const response = await request(app.getHttpServer())
        .post(`/api/v1/resources/${resourceId}/comments`)
        .set('Authorization', 'Bearer valid-token')
        .send({ comment: 'Great resource!' })
        .expect(201);

      expect(response.body).toEqual({
        id: 'c1',
        resourceId,
        userId: mockUser.id,
        parentCommentId: null,
        comment: 'Great resource!',
        createdAt: commentRow.created_at,
        updatedAt: commentRow.updated_at,
      });
      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Posted a comment',
        p_description: 'Great resource!',
        p_icon: 'message-circle',
      });
    });
  });
});
