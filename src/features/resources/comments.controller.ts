import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

/**
 * No shared `@Controller('...')` base path: routes mix resource-nested
 * paths (`resources/:id/comments`) with flat comment-by-id paths
 * (`comments/:id`), so each handler declares its own full path.
 */
@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('resources/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to a resource.' })
  @ApiCreatedResponse({
    description: 'The created comment.',
    type: CommentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async create(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(resourceId, userId, dto);
  }

  @Get('resources/:id/comments')
  @ApiOperation({ summary: 'List comments on a resource.' })
  @ApiOkResponse({
    description: 'Comments on the resource.',
    type: CommentResponseDto,
    isArray: true,
  })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async findAllForResource(
    @Param('id', ParseUUIDPipe) resourceId: string,
  ): Promise<CommentResponseDto[]> {
    return this.commentsService.findAllForResource(resourceId);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a comment owned by the caller.' })
  @ApiOkResponse({
    description: 'The updated comment.',
    type: CommentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'The comment does not exist.' })
  async update(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.update(commentId, userId, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a comment owned by the caller.' })
  @ApiNoContentResponse({ description: 'The comment was deleted.' })
  @ApiNotFoundResponse({ description: 'The comment does not exist.' })
  async remove(
    @Param('id', ParseUUIDPipe) commentId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.commentsService.remove(commentId, userId);
  }
}
