import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { BookmarksService } from './bookmarks.service';
import { ResourceResponseDto } from './dto/resource-response.dto';

/**
 * No shared `@Controller('...')` base path: routes mix a
 * resource-nested action (`resources/:id/bookmark`) with a flat listing
 * (`bookmarks`), so each handler declares its own full path.
 */
@ApiTags('bookmarks')
@Controller()
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post('resources/:id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bookmark a resource.' })
  @ApiCreatedResponse({ description: 'The resource was bookmarked.' })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async bookmark(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.bookmarksService.bookmark(resourceId, userId);
  }

  @Delete('resources/:id/bookmark')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a bookmark from a resource.' })
  @ApiNoContentResponse({ description: 'The bookmark was removed.' })
  async unbookmark(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.bookmarksService.unbookmark(resourceId, userId);
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the caller's bookmarked resources." })
  @ApiOkResponse({
    description: "The caller's bookmarked resources.",
    type: ResourceResponseDto,
    isArray: true,
  })
  async findMine(
    @CurrentUser('id') userId: string,
  ): Promise<ResourceResponseDto[]> {
    return this.bookmarksService.findMine(userId);
  }
}
