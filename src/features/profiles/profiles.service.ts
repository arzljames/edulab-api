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
import type { ProfileResponseDto } from './dto/profile-response.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileRow } from './interfaces/profile-row.interface';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

function toProfileResponse(row: ProfileRow): ProfileResponseDto {
  return {
    id: row.id,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    profilePhoto: row.profile_photo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @Inject(REQUEST_SUPABASE_CLIENT)
    private readonly supabase: SupabaseClient<Database>,
  ) {}

  async findOne(id: string): Promise<ProfileResponseDto> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to fetch profile ${id}: ${error.message}`);
      throw new BadRequestException('Failed to fetch profile.');
    }

    if (!data) {
      throw new NotFoundException('Profile not found.');
    }

    return toProfileResponse(data);
  }

  async update(id: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const payload: ProfileUpdate = {};
    if (dto.firstName !== undefined) payload.first_name = dto.firstName;
    if (dto.middleName !== undefined) payload.middle_name = dto.middleName;
    if (dto.lastName !== undefined) payload.last_name = dto.lastName;
    if (dto.profilePhoto !== undefined) {
      payload.profile_photo = dto.profilePhoto;
    }

    if (Object.keys(payload).length === 0) {
      return this.findOne(id);
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      this.logger.error(`Failed to update profile ${id}: ${error.message}`);
      throw new BadRequestException('Failed to update profile.');
    }

    if (!data) {
      throw new NotFoundException('Profile not found.');
    }

    return toProfileResponse(data);
  }
}
