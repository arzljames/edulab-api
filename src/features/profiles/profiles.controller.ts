import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the caller's own profile." })
  @ApiOkResponse({
    description: "The caller's profile.",
    type: ProfileResponseDto,
  })
  async getMe(
    @CurrentUser('id') userId: string,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.findOne(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single profile by id.' })
  @ApiOkResponse({
    description: 'The requested profile.',
    type: ProfileResponseDto,
  })
  @ApiNotFoundResponse({ description: 'The profile does not exist.' })
  async findOne(@Param('id') id: string): Promise<ProfileResponseDto> {
    return this.profilesService.findOne(id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update the caller's own profile." })
  @ApiOkResponse({
    description: 'The updated profile.',
    type: ProfileResponseDto,
  })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.update(userId, dto);
  }
}
