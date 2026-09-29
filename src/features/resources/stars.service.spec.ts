import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import { StarsService } from './stars.service';
import { createQueryBuilder, createSupabaseMock } from './supabase-query-builder.mock';

describe('StarsService', () => {
  let service: StarsService;
  let supabase: ReturnType<typeof createSupabaseMock>;

  beforeEach(async () => {
    supabase = createSupabaseMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StarsService,
        { provide: REQUEST_SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();

    service = module.get<StarsService>(StarsService);
  });

  describe('star', () => {
    it('upserts a star once the resource is confirmed visible', async () => {
      const visibleBuilder = createQueryBuilder({
        data: { resource_id: 'r1' },
        error: null,
      });
      const upsertBuilder = createQueryBuilder({ data: null, error: null });
      supabase.from
        .mockReturnValueOnce(visibleBuilder)
        .mockReturnValueOnce(upsertBuilder);

      await service.star('r1', 'user-1');

      expect(supabase.from).toHaveBeenNthCalledWith(1, 'resources');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'stars');
      expect(upsertBuilder.upsert).toHaveBeenCalledWith(
        { user_id: 'user-1', resource_id: 'r1' },
        { onConflict: 'user_id,resource_id', ignoreDuplicates: true },
      );
    });

    it('throws NotFoundException without upserting when the resource is not visible', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.star('missing', 'user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when the upsert fails', async () => {
      supabase.from
        .mockReturnValueOnce(
          createQueryBuilder({ data: { resource_id: 'r1' }, error: null }),
        )
        .mockReturnValueOnce(
          createQueryBuilder({ data: null, error: { message: 'boom' } }),
        );

      await expect(service.star('r1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('unstar', () => {
    it('deletes the star without checking existence first (idempotent)', async () => {
      const builder = createQueryBuilder({ data: null, error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.unstar('r1', 'user-1');

      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('resource_id', 'r1');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws BadRequestException when the delete errors', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.unstar('r1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findMine', () => {
    it('maps starred resources, filtering out any null joins', async () => {
      const rows = [
        {
          created_at: '2026-01-10T08:30:00.000Z',
          resources: {
            resource_id: 'r1',
            user_id: 'user-2',
            title: 'Fractions',
            description: null,
            grade_level: null,
            subject: null,
            file: null,
            visibility: 'public',
            status: 'published',
            published_at: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            resource_tags: [{ tags: { name: 'fractions' } }],
          },
        },
        { created_at: '2026-01-09T08:30:00.000Z', resources: null },
      ];
      const builder = createQueryBuilder({ data: rows, error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findMine('user-1');

      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({ id: 'r1', tags: ['fractions'] }),
      );
    });

    it('throws BadRequestException on error', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.findMine('user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
