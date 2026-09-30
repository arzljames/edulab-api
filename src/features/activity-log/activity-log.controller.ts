import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogEntryResponseDto } from './dto/activity-log-entry-response.dto';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';

@ApiTags('activity-log')
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the caller's own activity log, newest first." })
  @ApiOkResponse({ type: ActivityLogEntryResponseDto, isArray: true })
  async findMine(
    @CurrentUser('id') userId: string,
    @Query() query: ActivityLogQueryDto,
  ): Promise<ActivityLogEntryResponseDto[]> {
    return this.activityLogService.findMine(userId, query);
  }
}
