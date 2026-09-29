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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ResourceListQueryDto } from './dto/resource-list-query.dto';
import { ResourceResponseDto } from './dto/resource-response.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new resource owned by the caller.' })
  @ApiCreatedResponse({
    description: 'The created resource.',
    type: ResourceResponseDto,
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateResourceDto,
  ): Promise<ResourceResponseDto> {
    return this.resourcesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List resources visible to the caller.' })
  @ApiOkResponse({
    description: 'Resources matching the given filters.',
    type: ResourceResponseDto,
    isArray: true,
  })
  async findAll(
    @Query() query: ResourceListQueryDto,
  ): Promise<ResourceResponseDto[]> {
    return this.resourcesService.findAll(query);
  }

  // Registered before `:id` so it isn't shadowed by the dynamic param route.
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the caller's own resources." })
  @ApiOkResponse({
    description: "The caller's resources.",
    type: ResourceResponseDto,
    isArray: true,
  })
  async findMine(
    @CurrentUser('id') userId: string,
  ): Promise<ResourceResponseDto[]> {
    return this.resourcesService.findMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single resource by id.' })
  @ApiOkResponse({
    description: 'The requested resource.',
    type: ResourceResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'The resource does not exist or is not visible to the caller.',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponseDto> {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a resource owned by the caller.' })
  @ApiOkResponse({
    description: 'The updated resource.',
    type: ResourceResponseDto,
  })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceResponseDto> {
    return this.resourcesService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a resource owned by the caller.' })
  @ApiNotFoundResponse({ description: 'The resource does not exist.' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    return this.resourcesService.remove(id, userId);
  }
}

/**
 * `GET /tags` doesn't share a base path with the rest of `/resources`, but
 * tags are resource-scoped data (there's no independent tags domain), so
 * this stays in the resources feature rather than becoming a new top-level
 * feature. It reuses `ResourcesService` rather than a separate service,
 * since it has no state or logic of its own beyond one read.
 */
@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags.' })
  @ApiOkResponse({
    description: 'All tags.',
    type: TagResponseDto,
    isArray: true,
  })
  async findAll(): Promise<TagResponseDto[]> {
    return this.resourcesService.findAllTags();
  }
}
