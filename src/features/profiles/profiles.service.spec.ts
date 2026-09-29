import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { REQUEST_SUPABASE_CLIENT } from '../../shared/supabase/request-supabase-client.provider';
import { createQueryBuilder, createSupabaseMock } from '../resources/supabase-query-builder.mock';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let supabase: ReturnType<typeof createSupabaseMock>;

  const profileRow = {
    id: 'user-1',
    first_name: 'Jane',
    middle_name: 'Marie',
    last_name: 'Doe',
    profile_photo: 'https://storage.edulab.dev/avatars/jane-doe.png',
    created_at: '2026-01-10T08:30:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
  };

  beforeEach(async () => {
    supabase = createSupabaseMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: REQUEST_SUPABASE_CLIENT, useValue: supabase },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe('findOne', () => {
    it('returns the mapped profile when found', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: profileRow, error: null }),
      );

      const result = await service.findOne('user-1');

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(result).toEqual({
        id: 'user-1',
        firstName: 'Jane',
        middleName: 'Marie',
        lastName: 'Doe',
        profilePhoto: 'https://storage.edulab.dev/avatars/jane-doe.png',
        createdAt: '2026-01-10T08:30:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      });
    });

    it('throws NotFoundException when no row is found', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the query errors', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(service.findOne('user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('updates only the provided fields and maps the response, scoped to id', async () => {
      const updatedRow = { ...profileRow, first_name: 'Janet' };
      const updateBuilder = createQueryBuilder({ data: updatedRow, error: null });
      supabase.from.mockReturnValueOnce(updateBuilder);

      const result = await service.update('user-1', { firstName: 'Janet' });

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(updateBuilder.update).toHaveBeenCalledWith({ first_name: 'Janet' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result.firstName).toBe('Janet');
    });

    it('builds the update payload with all snake_case fields when every dto field is provided', async () => {
      const updatedRow = { ...profileRow };
      const updateBuilder = createQueryBuilder({ data: updatedRow, error: null });
      supabase.from.mockReturnValueOnce(updateBuilder);

      await service.update('user-1', {
        firstName: 'Jane',
        middleName: 'Marie',
        lastName: 'Doe',
        profilePhoto: 'https://storage.edulab.dev/avatars/jane-doe.png',
      });

      expect(updateBuilder.update).toHaveBeenCalledWith({
        first_name: 'Jane',
        middle_name: 'Marie',
        last_name: 'Doe',
        profile_photo: 'https://storage.edulab.dev/avatars/jane-doe.png',
      });
    });

    it('short-circuits to findOne without issuing an update when the payload is empty', async () => {
      const selectBuilder = createQueryBuilder({ data: profileRow, error: null });
      supabase.from.mockReturnValueOnce(selectBuilder);

      const result = await service.update('user-1', {});

      expect(supabase.from).toHaveBeenCalledTimes(1);
      expect(selectBuilder.update).not.toHaveBeenCalled();
      expect(selectBuilder.select).toHaveBeenCalledWith('*');
      expect(selectBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result.id).toBe('user-1');
    });

    it('throws NotFoundException when the update matches no row', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(
        service.update('missing', { firstName: 'Jane' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException via the empty-payload short-circuit when no row is found', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: null }),
      );

      await expect(service.update('missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the update errors', async () => {
      supabase.from.mockReturnValueOnce(
        createQueryBuilder({ data: null, error: { message: 'boom' } }),
      );

      await expect(
        service.update('user-1', { firstName: 'Jane' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
