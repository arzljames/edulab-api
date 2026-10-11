import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import { CommentsService } from './comments.service';
import { createQueryBuilder, createSupabaseMock } from './supabase-query-builder.mock';

describe('CommentsService', () => {
  let service: CommentsService;
  let supabase: ReturnType<typeof createSupabaseMock>;

  const commentRow = {
    comment_id: 'c1',
    resource_id: 'r1',
    user_id: 'user-1',
    parent_comment_id: null,
    comment: 'This worksheet was really helpful, thank you!',
    created_at: '2026-01-10T08:30:00.000Z',
    updated_at: '2026-01-10T08:30:00.000Z',
  };

  let activityLogService: { record: jest.Mock };

  beforeEach(async () => {
    supabase = createSupabaseMock();
    activityLogService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: REQUEST_SUPABASE_CLIENT, useValue: supabase },
        { provide: ActivityLogService, useValue: activityLogService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('create', () => {
    it('confirms visibility then inserts the comment', async () => {
      const visibleBuilder = createQueryBuilder({
        data: { resource_id: 'r1' },
        error: null,
      });
      const insertBuilder = createQueryBuilder({ data: commentRow, error: null });
      supabase.from
        .mockReturnValueOnce(visibleBuilder)
        .mockReturnValueOnce(insertBuilder);

      const result = await service.create('r1', 'user-1', {
        comment: commentRow.comment,
      });

      expect(supabase.from).toHaveBeenNthCalledWith(1, 'resources');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'comments');
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        resource_id: 'r1',
        user_id: 'user-1',
        parent_comment_id: null,
        comment: commentRow.comment,
      });
      expect(result).toEqual({
        id: 'c1',
        resourceId: 'r1',
        userId: 'user-1',
        parentCommentId: null,
        comment: commentRow.comment,
        createdAt: commentRow.created_at,
        updatedAt: commentRow.updated_at,
      });
      expect(activityLogService.record).toHaveBeenCalledWith(
        'Posted a comment',
        commentRow.comment,
        'message-circle',
      );
    });

    it('passes through parentCommentId for threaded replies', async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilder({ data: { resource_id: 'r1' }, error: null }),
        )
        .mockReturnValueOnce(
          createQueryBuilder({
            data: { ...commentRow, comment_id: 'c2', parent_comment_id: 'c1' },
            error: null,
          }),
        );

      const result = await service.create('r1', 'user-1', {
        comment: 'A reply',
        parentCommentId: 'c1',
      });

      expect(result.parentCommentId).toBe('c1');
      expect(activityLogService.record).toHaveBeenCalledWith(
        'Posted a comment',
        'A reply',
        'message-circle',
      );
    });

    it('throws NotFoundException without inserting or recording activity when the resource is not visible', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(
        service.create('missing', 'user-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(activityLogService.record).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the insert fails, without recording activity', async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilder({ data: { resource_id: 'r1' }, error: null }),
        )
        .mockReturnValueOnce(
          createQueryBuilder({ data: null, error: { message: 'boom' } }),
        );

      await expect(
        service.create('r1', 'user-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(activityLogService.record).not.toHaveBeenCalled();
    });
  });

  describe('findAllForResource', () => {
    it('confirms visibility then lists comments ordered oldest first', async () => {
      const visibleBuilder = createQueryBuilder({
        data: { resource_id: 'r1' },
        error: null,
      });
      const listBuilder = createQueryBuilder({ data: [commentRow], error: null });
      supabase.from
        .mockReturnValueOnce(visibleBuilder)
        .mockReturnValueOnce(listBuilder);

      const result = await service.findAllForResource('r1');

      expect(listBuilder.eq).toHaveBeenCalledWith('resource_id', 'r1');
      expect(listBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('throws NotFoundException when the resource is not visible', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.findAllForResource('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the list query errors', async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilder({ data: { resource_id: 'r1' }, error: null }),
        )
        .mockReturnValueOnce(
          createQueryBuilder({ data: null, error: { message: 'boom' } }),
        );

      await expect(service.findAllForResource('r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates the comment scoped to id + owner', async () => {
      const updatedRow = { ...commentRow, comment: 'Edited' };
      const builder = createQueryBuilder({ data: updatedRow, error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.update('c1', 'user-1', { comment: 'Edited' });

      expect(builder.update).toHaveBeenCalledWith({ comment: 'Edited' });
      expect(builder.eq).toHaveBeenCalledWith('comment_id', 'c1');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result.comment).toBe('Edited');
    });

    it('throws NotFoundException when no row matched', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(
        service.update('missing', 'user-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException on error', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(
        service.update('c1', 'user-1', { comment: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the comment scoped to id + owner', async () => {
      const builder = createQueryBuilder({ data: { comment_id: 'c1' }, error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.remove('c1', 'user-1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('comment_id', 'c1');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws NotFoundException when no row matched', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.remove('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException on error', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.remove('c1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
