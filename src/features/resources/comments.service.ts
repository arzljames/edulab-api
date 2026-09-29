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
import type { CommentResponseDto } from './dto/comment-response.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { UpdateCommentDto } from './dto/update-comment.dto';
import type { CommentRow } from './interfaces/resource-row.interface';
import { assertResourceVisible } from './resources.helpers';

function toCommentResponse(row: CommentRow): CommentResponseDto {
  return {
    id: row.comment_id,
    resourceId: row.resource_id,
    userId: row.user_id,
    parentCommentId: row.parent_comment_id,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @Inject(REQUEST_SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async create(
    resourceId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    await assertResourceVisible(this.supabase, resourceId);

    const { data, error } = await this.supabase
      .from('comments')
      .insert({
        resource_id: resourceId,
        user_id: userId,
        parent_comment_id: dto.parentCommentId ?? null,
        comment: dto.comment,
      })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to create comment on resource ${resourceId}: ${error?.message}`,
      );
      throw new BadRequestException('Failed to create comment.');
    }

    return toCommentResponse(data);
  }

  async findAllForResource(resourceId: string): Promise<CommentResponseDto[]> {
    await assertResourceVisible(this.supabase, resourceId);

    const { data, error } = await this.supabase
      .from('comments')
      .select('*')
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error(
        `Failed to fetch comments for resource ${resourceId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to fetch comments.');
    }

    return (data ?? []).map(toCommentResponse);
  }

  async update(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    const { data, error } = await this.supabase
      .from('comments')
      .update({ comment: dto.comment })
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to update comment ${commentId}: ${error.message}`);
      throw new BadRequestException('Failed to update comment.');
    }

    if (!data) {
      throw new NotFoundException('Comment not found.');
    }

    return toCommentResponse(data);
  }

  async remove(commentId: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('comments')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .select('comment_id')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to delete comment ${commentId}: ${error.message}`);
      throw new BadRequestException('Failed to delete comment.');
    }

    if (!data) {
      throw new NotFoundException('Comment not found.');
    }
  }
}
