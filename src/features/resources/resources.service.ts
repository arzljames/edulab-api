import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../shared/supabase/database.types';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import type { CreateResourceDto } from './dto/create-resource.dto';
import type { ResourceListQueryDto } from './dto/resource-list-query.dto';
import type { ResourceResponseDto } from './dto/resource-response.dto';
import type { TagResponseDto } from './dto/tag-response.dto';
import type { UpdateResourceDto } from './dto/update-resource.dto';
import type { ResourceRow } from './interfaces/resource-row.interface';
import {
  RESOURCE_SELECT_WITH_TAGS,
  extractTagNames,
  toResourceResponse,
  type ResourceWithTags,
} from './resources.helpers';

type ResourceInsert = Database['public']['Tables']['resources']['Insert'];
type ResourceUpdate = Database['public']['Tables']['resources']['Update'];

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  constructor(
    @Inject(REQUEST_SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async create(
    userId: string,
    dto: CreateResourceDto,
  ): Promise<ResourceResponseDto> {
    const payload: ResourceInsert = {
      user_id: userId,
      title: dto.title,
      description: dto.description ?? null,
      grade_level: dto.gradeLevel ?? null,
      subject: dto.subject ?? null,
      file: dto.file ?? null,
      // Omitted (undefined) lets the DB default ('public') apply.
      visibility: dto.visibility as ResourceInsert['visibility'],
    };

    const { data: resource, error } = await this.supabase
      .from('resources')
      .insert(payload)
      .select('*')
      .single();

    if (error || !resource) {
      this.logger.error(`Failed to create resource: ${error?.message}`);
      throw new BadRequestException(
        error?.message ?? 'Failed to create resource.',
      );
    }

    const tags = await this.syncTags(resource.resource_id, dto.tags);

    return toResourceResponse(resource, tags);
  }

  async findAll(query: ResourceListQueryDto): Promise<ResourceResponseDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let builder = this.supabase
      .from('resources')
      .select(RESOURCE_SELECT_WITH_TAGS)
      .eq('visibility', 'public')
      .eq('status', 'published');

    if (query.subject) {
      builder = builder.eq('subject', query.subject);
    }
    if (query.gradeLevel) {
      builder = builder.eq('grade_level', query.gradeLevel);
    }
    if (query.tag) {
      const matchingIds = await this.findResourceIdsForTag(query.tag);
      if (matchingIds.length === 0) {
        return [];
      }
      builder = builder.in('resource_id', matchingIds);
    }

    const { data, error } = await builder
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.error(`Failed to list resources: ${error.message}`);
      throw new BadRequestException('Failed to list resources.');
    }

    return ((data ?? []) as unknown as ResourceWithTags[]).map((row) =>
      toResourceResponse(row, extractTagNames(row)),
    );
  }

  async findMine(userId: string): Promise<ResourceResponseDto[]> {
    const { data, error } = await this.supabase
      .from('resources')
      .select(RESOURCE_SELECT_WITH_TAGS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to fetch resources for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to fetch your resources.');
    }

    return ((data ?? []) as unknown as ResourceWithTags[]).map((row) =>
      toResourceResponse(row, extractTagNames(row)),
    );
  }

  async findOne(id: string): Promise<ResourceResponseDto> {
    // No explicit visibility filter here: RLS already restricts this SELECT
    // to rows the caller may see (owner, or public+published), scoped by
    // whichever bearer token REQUEST_SUPABASE_CLIENT attached (if any).
    const { data, error } = await this.supabase
      .from('resources')
      .select(RESOURCE_SELECT_WITH_TAGS)
      .eq('resource_id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch resource ${id}: ${error.message}`);
      throw new BadRequestException('Failed to fetch resource.');
    }

    if (!data) {
      throw new NotFoundException('Resource not found.');
    }

    const row = data as unknown as ResourceWithTags;
    return toResourceResponse(row, extractTagNames(row));
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    const payload: ResourceUpdate = {};
    if (dto.title !== undefined) payload.title = dto.title;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.gradeLevel !== undefined) payload.grade_level = dto.gradeLevel;
    if (dto.subject !== undefined) payload.subject = dto.subject;
    if (dto.file !== undefined) payload.file = dto.file;
    if (dto.visibility !== undefined) {
      payload.visibility = dto.visibility as ResourceUpdate['visibility'];
    }
    if (dto.status !== undefined) {
      payload.status = dto.status as ResourceUpdate['status'];
    }

    let resource: ResourceRow;

    if (Object.keys(payload).length > 0) {
      const { data, error } = await this.supabase
        .from('resources')
        .update(payload)
        .eq('resource_id', id)
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        this.logger.error(`Failed to update resource ${id}: ${error.message}`);
        throw new BadRequestException('Failed to update resource.');
      }
      if (!data) {
        throw new NotFoundException('Resource not found.');
      }
      resource = data;
    } else {
      const { data, error } = await this.supabase
        .from('resources')
        .select('*')
        .eq('resource_id', id)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        this.logger.error(`Failed to fetch resource ${id}: ${error.message}`);
        throw new BadRequestException('Failed to update resource.');
      }
      if (!data) {
        throw new NotFoundException('Resource not found.');
      }
      resource = data;
    }

    const tags = await this.syncTags(id, dto.tags);

    return toResourceResponse(resource, tags);
  }

  async remove(id: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('resources')
      .delete()
      .eq('resource_id', id)
      .eq('user_id', userId)
      .select('resource_id')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to delete resource ${id}: ${error.message}`);
      throw new BadRequestException('Failed to delete resource.');
    }

    if (!data) {
      throw new NotFoundException('Resource not found.');
    }
  }

  async findAllTags(): Promise<TagResponseDto[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      this.logger.error(`Failed to fetch tags: ${error.message}`);
      throw new BadRequestException('Failed to fetch tags.');
    }

    return (data ?? []).map((tag) => ({
      id: tag.tag_id,
      name: tag.name,
      createdAt: tag.created_at,
    }));
  }

  /**
   * Upserts the given tag names and replaces this resource's tag
   * associations wholesale. When `tagNames` is undefined, existing tags are
   * left untouched (the field simply wasn't part of this request).
   */
  private async syncTags(
    resourceId: string,
    tagNames: string[] | undefined,
  ): Promise<string[]> {
    if (tagNames === undefined) {
      return this.getTagNamesForResource(resourceId);
    }

    const uniqueNames = [
      ...new Set(tagNames.map((name) => name.trim()).filter(Boolean)),
    ];

    const { error: clearError } = await this.supabase
      .from('resource_tags')
      .delete()
      .eq('resource_id', resourceId);

    if (clearError) {
      this.logger.error(
        `Failed to clear tags for resource ${resourceId}: ${clearError.message}`,
      );
      throw new BadRequestException('Failed to save tags.');
    }

    if (uniqueNames.length === 0) {
      return [];
    }

    // ON CONFLICT DO NOTHING avoids needing UPDATE privilege on `tags` under
    // RLS (only SELECT/INSERT policies exist for it) — pre-existing tags are
    // simply skipped rather than upserted-in-place.
    const { error: upsertError } = await this.supabase.from('tags').upsert(
      uniqueNames.map((name) => ({ name })),
      { onConflict: 'name', ignoreDuplicates: true },
    );

    if (upsertError) {
      this.logger.error(`Failed to upsert tags: ${upsertError.message}`);
      throw new BadRequestException('Failed to save tags.');
    }

    const { data: tagRows, error: selectError } = await this.supabase
      .from('tags')
      .select('tag_id, name')
      .in('name', uniqueNames);

    if (selectError || !tagRows) {
      this.logger.error(`Failed to load tags: ${selectError?.message}`);
      throw new BadRequestException('Failed to save tags.');
    }

    const { error: linkError } = await this.supabase
      .from('resource_tags')
      .insert(
        tagRows.map((tag) => ({
          resource_id: resourceId,
          tag_id: tag.tag_id,
        })),
      );

    if (linkError) {
      this.logger.error(
        `Failed to attach tags to resource ${resourceId}: ${linkError.message}`,
      );
      throw new BadRequestException('Failed to save tags.');
    }

    return tagRows.map((tag) => tag.name);
  }

  private async getTagNamesForResource(resourceId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('resource_tags')
      .select('tags(name)')
      .eq('resource_id', resourceId);

    if (error) {
      this.logger.error(
        `Failed to fetch tags for resource ${resourceId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to fetch tags.');
    }

    return ((data ?? []) as unknown as { tags: { name: string } | null }[])
      .map((row) => row.tags?.name)
      .filter((name): name is string => Boolean(name));
  }

  private async findResourceIdsForTag(tagName: string): Promise<string[]> {
    const { data: tagRow, error: tagError } = await this.supabase
      .from('tags')
      .select('tag_id')
      .eq('name', tagName)
      .maybeSingle();

    if (tagError) {
      this.logger.error(`Failed to look up tag "${tagName}": ${tagError.message}`);
      throw new BadRequestException('Failed to filter by tag.');
    }
    if (!tagRow) {
      return [];
    }

    const { data: links, error: linksError } = await this.supabase
      .from('resource_tags')
      .select('resource_id')
      .eq('tag_id', tagRow.tag_id);

    if (linksError) {
      this.logger.error(
        `Failed to look up resources for tag "${tagName}": ${linksError.message}`,
      );
      throw new BadRequestException('Failed to filter by tag.');
    }

    return (links ?? []).map((link) => link.resource_id);
  }
}
