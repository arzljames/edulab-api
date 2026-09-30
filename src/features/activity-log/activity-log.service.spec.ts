import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, Logger } from '@nestjs/common';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import { ActivityLogService } from './activity-log.service';
import type { ActivityLogQueryDto } from './dto/activity-log-query.dto';

/**
 * Minimal chainable query-builder mock for `.from('audit_logs').select('*')
 * .eq(...).order(...).range(...)`, terminated by a direct `await` (no
 * `.single()`/`.maybeSingle()` call in `findMine`). Kept local to this spec
 * rather than reused from the resources feature's mock, per the "code used
 * by only one feature stays in that feature" convention.
 */
interface QueryBuilderMock<T> {
  select: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  eq: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  order: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  range: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  then: <TResult1 = unknown, TResult2 = never>(
    onFulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
}

function createQueryBuilder<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): QueryBuilderMock<T> {
  const builder = {} as QueryBuilderMock<T>;
  const chainMethods = ['select', 'eq', 'order', 'range'] as const;
  for (const method of chainMethods) {
    builder[method] = jest.fn(() => builder);
  }
  // eslint-disable-next-line unicorn/no-thenable
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

describe('ActivityLogService', () => {
  let service: ActivityLogService;
  let supabase: { from: jest.Mock; rpc: jest.Mock };

  const auditLogRow = {
    audit_log_id: 'log-1',
    user_id: 'user-1',
    action_title: 'Created resource',
    description: 'Grade 5 Fractions Worksheet',
    icon: 'plus-circle',
    created_at: '2026-01-10T08:30:00.000Z',
  };

  beforeEach(async () => {
    supabase = { from: jest.fn(), rpc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLogService,
        { provide: REQUEST_SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();

    service = module.get<ActivityLogService>(ActivityLogService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findMine', () => {
    it('maps rows from snake_case to camelCase, with no userId in the response', async () => {
      const builder = createQueryBuilder({ data: [auditLogRow], error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findMine('user-1', {});

      expect(supabase.from).toHaveBeenCalledWith('audit_logs');
      expect(builder.select).toHaveBeenCalledWith('*');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual([
        {
          id: 'log-1',
          actionTitle: 'Created resource',
          description: 'Grade 5 Fractions Worksheet',
          icon: 'plus-circle',
          createdAt: auditLogRow.created_at,
        },
      ]);
      expect(result[0]).not.toHaveProperty('userId');
    });

    it('defaults to page 1 / limit 20 when the query is empty, requesting range(0, 19)', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.findMine('user-1', {});

      expect(builder.range).toHaveBeenCalledWith(0, 19);
    });

    it('computes from/to for a given page and limit', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      supabase.from.mockReturnValueOnce(builder);

      const query: ActivityLogQueryDto = { page: 3, limit: 10 };
      await service.findMine('user-1', query);

      // page 3, limit 10 -> from = (3-1)*10 = 20, to = 20+10-1 = 29
      expect(builder.range).toHaveBeenCalledWith(20, 29);
    });

    it('computes from/to for page 1 with a custom limit', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.findMine('user-1', { page: 1, limit: 5 });

      expect(builder.range).toHaveBeenCalledWith(0, 4);
    });

    it('returns [] when data is null', async () => {
      const builder = createQueryBuilder<typeof auditLogRow>({
        data: null,
        error: null,
      });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findMine('user-1', {});

      expect(result).toEqual([]);
    });

    it('throws BadRequestException when the query errors', async () => {
      const builder = createQueryBuilder<typeof auditLogRow>({
        data: null,
        error: { message: 'db down' },
      });
      supabase.from.mockReturnValueOnce(builder);

      await expect(service.findMine('user-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('record', () => {
    it('calls the log_activity RPC with the given title, description and icon', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      await service.record('Created resource', 'Grade 5 Fractions Worksheet', 'plus-circle');

      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Created resource',
        p_description: 'Grade 5 Fractions Worksheet',
        p_icon: 'plus-circle',
      });
    });

    it('calls the RPC with undefined description/icon when omitted', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      await service.record('Bookmarked a resource');

      expect(supabase.rpc).toHaveBeenCalledWith('log_activity', {
        p_action_title: 'Bookmarked a resource',
        p_description: undefined,
        p_icon: undefined,
      });
    });

    it('resolves void on success without throwing', async () => {
      supabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      await expect(service.record('Starred a resource')).resolves.toBeUndefined();
    });

    it('never throws when the RPC errors: it only logs and resolves normally', async () => {
      const loggerErrorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'rpc failed' },
      });

      await expect(
        service.record('Posted a comment', 'hello', 'message-circle'),
      ).resolves.toBeUndefined();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to record activity "Posted a comment"'),
      );
    });
  });
});
