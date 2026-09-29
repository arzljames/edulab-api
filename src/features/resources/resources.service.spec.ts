import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import { ResourceVisibility } from './dto/create-resource.dto';
import { ResourceStatus } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';
import { createQueryBuilder, createSupabaseMock } from './supabase-query-builder.mock';

describe('ResourcesService', () => {
  let service: ResourcesService;
  let supabase: ReturnType<typeof createSupabaseMock>;

  const resourceRow = {
    resource_id: 'r1',
    user_id: 'user-1',
    title: 'Grade 5 Fractions Worksheet',
    description: null,
    grade_level: null,
    subject: null,
    file: null,
    visibility: ResourceVisibility.PUBLIC,
    status: ResourceStatus.DRAFT,
    published_at: null,
    created_at: '2026-01-10T08:30:00.000Z',
    updated_at: '2026-01-10T08:30:00.000Z',
  };

  beforeEach(async () => {
    supabase = createSupabaseMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourcesService,
        { provide: REQUEST_SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();

    service = module.get<ResourcesService>(ResourcesService);
  });

  describe('create', () => {
    it('creates a resource and leaves tags untouched when dto.tags is undefined', async () => {
      const insertBuilder = createQueryBuilder({ data: resourceRow, error: null });
      const tagsLookupBuilder = createQueryBuilder({ data: [], error: null });
      supabase.from
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(tagsLookupBuilder);

      const result = await service.create('user-1', {
        title: resourceRow.title,
      });

      expect(supabase.from).toHaveBeenNthCalledWith(1, 'resources');
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', title: resourceRow.title }),
      );
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'resource_tags');
      expect(result).toEqual(
        expect.objectContaining({ id: 'r1', title: resourceRow.title, tags: [] }),
      );
    });

    it('creates a resource and syncs tags (clear, upsert, link) when dto.tags is provided', async () => {
      const insertBuilder = createQueryBuilder({ data: resourceRow, error: null });
      const clearBuilder = createQueryBuilder({ data: null, error: null });
      const upsertBuilder = createQueryBuilder({ data: null, error: null });
      const tagRows = [
        { tag_id: 'tag-1', name: 'fractions' },
        { tag_id: 'tag-2', name: 'worksheet' },
      ];
      const selectTagsBuilder = createQueryBuilder({ data: tagRows, error: null });
      const linkBuilder = createQueryBuilder({ data: null, error: null });

      supabase.from
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(clearBuilder)
        .mockReturnValueOnce(upsertBuilder)
        .mockReturnValueOnce(selectTagsBuilder)
        .mockReturnValueOnce(linkBuilder);

      const result = await service.create('user-1', {
        title: resourceRow.title,
        tags: ['fractions', 'worksheet'],
      });

      expect(clearBuilder.delete).toHaveBeenCalled();
      expect(clearBuilder.eq).toHaveBeenCalledWith('resource_id', 'r1');
      expect(upsertBuilder.upsert).toHaveBeenCalledWith(
        [{ name: 'fractions' }, { name: 'worksheet' }],
        { onConflict: 'name', ignoreDuplicates: true },
      );
      expect(selectTagsBuilder.in).toHaveBeenCalledWith('name', [
        'fractions',
        'worksheet',
      ]);
      expect(linkBuilder.insert).toHaveBeenCalledWith([
        { resource_id: 'r1', tag_id: 'tag-1' },
        { resource_id: 'r1', tag_id: 'tag-2' },
      ]);
      expect(result.tags).toEqual(['fractions', 'worksheet']);
    });

    it('skips the upsert/link steps when dto.tags is an empty (or all-blank) array', async () => {
      const insertBuilder = createQueryBuilder({ data: resourceRow, error: null });
      const clearBuilder = createQueryBuilder({ data: null, error: null });

      supabase.from
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(clearBuilder);

      const result = await service.create('user-1', {
        title: resourceRow.title,
        tags: ['   '],
      });

      expect(supabase.from).toHaveBeenCalledTimes(2);
      expect(result.tags).toEqual([]);
    });

    it('throws BadRequestException when the insert fails', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'insert failed' } }),
      );

      await expect(
        service.create('user-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    const rowWithTags = {
      ...resourceRow,
      status: ResourceStatus.PUBLISHED,
      resource_tags: [{ tags: { name: 'fractions' } }],
    };

    it('always filters by public visibility and published status', async () => {
      const builder = createQueryBuilder({ data: [rowWithTags], error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findAll({});

      expect(supabase.from).toHaveBeenCalledWith('resources');
      expect(builder.eq).toHaveBeenCalledWith('visibility', 'public');
      expect(builder.eq).toHaveBeenCalledWith('status', 'published');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.range).toHaveBeenCalledWith(0, 19);
      expect(result).toEqual([
        expect.objectContaining({ id: 'r1', tags: ['fractions'] }),
      ]);
    });

    it('applies the subject and gradeLevel filters when given', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.findAll({ subject: 'Mathematics', gradeLevel: 'Grade 5' });

      expect(builder.eq).toHaveBeenCalledWith('subject', 'Mathematics');
      expect(builder.eq).toHaveBeenCalledWith('grade_level', 'Grade 5');
    });

    it('applies pagination based on page/limit', async () => {
      const builder = createQueryBuilder({ data: [], error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.findAll({ page: 3, limit: 10 });

      expect(builder.range).toHaveBeenCalledWith(20, 29);
    });

    it('filters by tag when a matching tag/resources exist', async () => {
      const listBuilder = createQueryBuilder({ data: [rowWithTags], error: null });
      const tagLookupBuilder = createQueryBuilder({
        data: { tag_id: 'tag-1' },
        error: null,
      });
      const linksBuilder = createQueryBuilder({
        data: [{ resource_id: 'r1' }],
        error: null,
      });

      supabase.from
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(tagLookupBuilder)
        .mockReturnValueOnce(linksBuilder);

      const result = await service.findAll({ tag: 'fractions' });

      expect(tagLookupBuilder.eq).toHaveBeenCalledWith('name', 'fractions');
      expect(linksBuilder.eq).toHaveBeenCalledWith('tag_id', 'tag-1');
      expect(listBuilder.in).toHaveBeenCalledWith('resource_id', ['r1']);
      expect(result).toHaveLength(1);
    });

    it('returns [] without querying resources when the tag does not exist', async () => {
      const listBuilder = createQueryBuilder({ data: [rowWithTags], error: null });
      const tagLookupBuilder = createQueryBuilder({ data: null, error: null });

      supabase.from
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(tagLookupBuilder);

      const result = await service.findAll({ tag: 'nonexistent' });

      expect(result).toEqual([]);
      expect(listBuilder.in).not.toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it('returns [] when the tag exists but has no linked resources', async () => {
      const listBuilder = createQueryBuilder({ data: [rowWithTags], error: null });
      const tagLookupBuilder = createQueryBuilder({
        data: { tag_id: 'tag-1' },
        error: null,
      });
      const linksBuilder = createQueryBuilder({ data: [], error: null });

      supabase.from
        .mockReturnValueOnce(listBuilder)
        .mockReturnValueOnce(tagLookupBuilder)
        .mockReturnValueOnce(linksBuilder);

      const result = await service.findAll({ tag: 'lonely-tag' });

      expect(result).toEqual([]);
      expect(listBuilder.in).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the list query errors', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'db down' } }),
      );

      await expect(service.findAll({})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findMine', () => {
    it('returns the caller resources ordered by created_at desc', async () => {
      const rowWithTags = { ...resourceRow, resource_tags: [] };
      const builder = createQueryBuilder({ data: [rowWithTags], error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findMine('user-1');

      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toHaveLength(1);
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

  describe('findOne', () => {
    it('returns the mapped resource when found', async () => {
      const rowWithTags = { ...resourceRow, resource_tags: [] };
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: rowWithTags, error: null }),
      );

      const result = await service.findOne('r1');

      expect(result.id).toBe('r1');
    });

    it('throws NotFoundException when no row is found', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException on error', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.findOne('r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates provided fields, scoped to id + owner, and syncs tags', async () => {
      const updatedRow = { ...resourceRow, title: 'New title' };
      const updateBuilder = createQueryBuilder({ data: updatedRow, error: null });
      const clearBuilder = createQueryBuilder({ data: null, error: null });
      const upsertBuilder = createQueryBuilder({ data: null, error: null });
      const selectTagsBuilder = createQueryBuilder({
        data: [{ tag_id: 'tag-1', name: 'new-tag' }],
        error: null,
      });
      const linkBuilder = createQueryBuilder({ data: null, error: null });

      supabase.from
        .mockReturnValueOnce(updateBuilder)
        .mockReturnValueOnce(clearBuilder)
        .mockReturnValueOnce(upsertBuilder)
        .mockReturnValueOnce(selectTagsBuilder)
        .mockReturnValueOnce(linkBuilder);

      const result = await service.update('r1', 'user-1', {
        title: 'New title',
        tags: ['new-tag'],
      });

      expect(updateBuilder.update).toHaveBeenCalledWith({ title: 'New title' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('resource_id', 'r1');
      expect(updateBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result.title).toBe('New title');
      expect(result.tags).toEqual(['new-tag']);
    });

    it('fetches the existing row without updating when the payload is empty, leaving tags untouched', async () => {
      const rowWithTags = { ...resourceRow };
      const selectBuilder = createQueryBuilder({ data: rowWithTags, error: null });
      const tagsLookupBuilder = createQueryBuilder({
        data: [{ tags: { name: 'existing-tag' } }],
        error: null,
      });

      supabase.from
        .mockReturnValueOnce(selectBuilder)
        .mockReturnValueOnce(tagsLookupBuilder);

      const result = await service.update('r1', 'user-1', {});

      expect(selectBuilder.update).not.toHaveBeenCalled();
      expect(selectBuilder.select).toHaveBeenCalledWith('*');
      expect(selectBuilder.eq).toHaveBeenCalledWith('resource_id', 'r1');
      expect(selectBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(result.tags).toEqual(['existing-tag']);
    });

    it('throws NotFoundException when the update matches no row', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(
        service.update('missing', 'user-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundException when the fallback select (empty payload) matches no row', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.update('missing', 'user-1', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the update errors', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(
        service.update('r1', 'user-1', { title: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the resource scoped to id + owner', async () => {
      const builder = createQueryBuilder({ data: { resource_id: 'r1' }, error: null });
      supabase.from.mockReturnValueOnce(builder);

      await service.remove('r1', 'user-1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('resource_id', 'r1');
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

      await expect(service.remove('r1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('findAllTags', () => {
    it('returns all tags ordered by name', async () => {
      const tagRows = [{ tag_id: 't1', name: 'fractions', created_at: '2026-01-01' }];
      const builder = createQueryBuilder({ data: tagRows, error: null });
      supabase.from.mockReturnValueOnce(builder);

      const result = await service.findAllTags();

      expect(builder.order).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual([
        { id: 't1', name: 'fractions', createdAt: '2026-01-01' },
      ]);
    });

    it('throws BadRequestException on error', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.findAllTags()).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
