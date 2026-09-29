import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResourceVisibility } from './dto/create-resource.dto';
import { ResourceStatus } from './dto/update-resource.dto';
import {
  assertResourceVisible,
  extractTagNames,
  toResourceResponse,
  type ResourceWithTags,
} from './resources.helpers';
import { createQueryBuilder, createSupabaseMock } from './supabase-query-builder.mock';

describe('resources.helpers', () => {
  describe('extractTagNames', () => {
    it('extracts tag names from resource_tags join rows', () => {
      const row = {
        resource_tags: [
          { tags: { name: 'fractions' } },
          { tags: { name: 'worksheet' } },
        ],
      } as ResourceWithTags;

      expect(extractTagNames(row)).toEqual(['fractions', 'worksheet']);
    });

    it('filters out entries with a null tags join', () => {
      const row = {
        resource_tags: [{ tags: { name: 'fractions' } }, { tags: null }],
      } as ResourceWithTags;

      expect(extractTagNames(row)).toEqual(['fractions']);
    });

    it('returns an empty array when resource_tags is null', () => {
      const row = { resource_tags: null } as ResourceWithTags;

      expect(extractTagNames(row)).toEqual([]);
    });

    it('returns an empty array when resource_tags is missing entirely', () => {
      const row = {} as ResourceWithTags;

      expect(extractTagNames(row)).toEqual([]);
    });
  });

  describe('toResourceResponse', () => {
    it('maps a resource row and tag names to a ResourceResponseDto', () => {
      const row = {
        resource_id: 'r1',
        user_id: 'user-1',
        title: 'Grade 5 Fractions Worksheet',
        description: 'A worksheet',
        grade_level: 'Grade 5',
        subject: 'Mathematics',
        file: 'https://storage.edulab.dev/resources/fractions.pdf',
        visibility: ResourceVisibility.PUBLIC,
        status: ResourceStatus.PUBLISHED,
        published_at: '2026-01-15T10:00:00.000Z',
        created_at: '2026-01-10T08:30:00.000Z',
        updated_at: '2026-01-15T10:00:00.000Z',
      };

      const result = toResourceResponse(row as never, ['fractions', 'worksheet']);

      expect(result).toEqual({
        id: 'r1',
        userId: 'user-1',
        title: 'Grade 5 Fractions Worksheet',
        description: 'A worksheet',
        gradeLevel: 'Grade 5',
        subject: 'Mathematics',
        file: 'https://storage.edulab.dev/resources/fractions.pdf',
        visibility: ResourceVisibility.PUBLIC,
        status: ResourceStatus.PUBLISHED,
        publishedAt: '2026-01-15T10:00:00.000Z',
        tags: ['fractions', 'worksheet'],
        createdAt: '2026-01-10T08:30:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      });
    });

    it('passes through null optional fields untouched', () => {
      const row = {
        resource_id: 'r1',
        user_id: 'user-1',
        title: 'Untitled',
        description: null,
        grade_level: null,
        subject: null,
        file: null,
        visibility: ResourceVisibility.PRIVATE,
        status: ResourceStatus.DRAFT,
        published_at: null,
        created_at: '2026-01-10T08:30:00.000Z',
        updated_at: '2026-01-10T08:30:00.000Z',
      };

      const result = toResourceResponse(row as never, []);

      expect(result.description).toBeNull();
      expect(result.gradeLevel).toBeNull();
      expect(result.subject).toBeNull();
      expect(result.file).toBeNull();
      expect(result.publishedAt).toBeNull();
      expect(result.tags).toEqual([]);
    });
  });

  describe('assertResourceVisible', () => {
    it('resolves without throwing when the resource is visible', async () => {
      const supabase = createSupabaseMock();
      const builder = createQueryBuilder({
        data: { resource_id: 'r1' },
        error: null,
      });
      supabase.from.mockReturnValueOnce(builder);

      await expect(
        assertResourceVisible(supabase as never, 'r1'),
      ).resolves.toBeUndefined();

      expect(supabase.from).toHaveBeenCalledWith('resources');
      expect(builder.select).toHaveBeenCalledWith('resource_id');
      expect(builder.eq).toHaveBeenCalledWith('resource_id', 'r1');
    });

    it('throws NotFoundException when the lookup returns no row', async () => {
      const supabase = createSupabaseMock();
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(
        assertResourceVisible(supabase as never, 'missing-id'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when the lookup errors', async () => {
      const supabase = createSupabaseMock();
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'connection reset' } }),
      );

      await expect(
        assertResourceVisible(supabase as never, 'r1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
