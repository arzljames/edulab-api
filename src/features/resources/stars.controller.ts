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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { StarsService } from './stars.service';

/**
 * No shared `@Controller('...')` base path: routes mix a resource-nested
 * action (`resources/:id/star`) with a flat listing (`stars`), so each
 * handler declares its own full path.
 */
@ApiTags('stars')
@Controller()
export class StarsController {
  constructor(private readonly starsService: StarsService) {}

  @Post('resources/:id/star')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Star a resource.' })
  @ApiCreatedResponse({ description: 'The resource was starred.' })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async star(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.starsService.star(resourceId, userId);
  }

  @Delete('resources/:id/star')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a star from a resource.' })
  @ApiNoContentResponse({ description: 'The star was removed.' })
  async unstar(
    @Param('id', ParseUUIDPipe) resourceId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.starsService.unstar(resourceId, userId);
  }

  @Get('stars')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the caller's starred resources." })
  @ApiOkResponse({
    description: "The caller's starred resources.",
    type: ResourceResponseDto,
    isArray: true,
  })
  async findMine(
    @CurrentUser('id') userId: string,
  ): Promise<ResourceResponseDto[]> {
    return this.starsService.findMine(userId);
  }
}
