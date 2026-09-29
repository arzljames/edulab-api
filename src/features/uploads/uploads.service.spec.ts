import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { CLOUDINARY_CLIENT, type CloudinaryClient } from './cloudinary-client.provider';
import cloudinaryConfig from './uploads-config';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let cloudinary: {
    uploader: { upload_stream: jest.Mock };
  };
  let config: ConfigType<typeof cloudinaryConfig>;

  // Drives the promise inside `uploadFile` by invoking whatever callback was
  // passed to `upload_stream` as soon as the returned stream's `.end()` is
  // called with the file buffer.
  function mockUploadStream(
    invoke: (
      callback: (
        error?: UploadApiErrorResponse,
        result?: UploadApiResponse,
      ) => void,
    ) => void,
  ): void {
    cloudinary.uploader.upload_stream.mockImplementation(
      (
        _options: unknown,
        callback: (
          error?: UploadApiErrorResponse,
          result?: UploadApiResponse,
        ) => void,
      ) => ({
        end: () => invoke(callback),
      }),
    );
  }

  const buildFile = (): Express.Multer.File =>
    ({
      buffer: Buffer.from('file-contents'),
      mimetype: 'image/png',
      originalname: 'photo.png',
    }) as Express.Multer.File;

  beforeEach(async () => {
    cloudinary = { uploader: { upload_stream: jest.fn() } };
    config = {
      cloudName: 'demo-cloud',
      apiKey: 'demo-key',
      apiSecret: 'demo-secret',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: CLOUDINARY_CLIENT, useValue: cloudinary as unknown as CloudinaryClient },
        { provide: cloudinaryConfig.KEY, useValue: config },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('resolves to the secure URL when the upload succeeds', async () => {
      mockUploadStream((callback) =>
        callback(undefined, {
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/abc.png',
        } as UploadApiResponse),
      );

      const result = await service.uploadFile(buildFile());

      expect(result).toEqual({
        url: 'https://res.cloudinary.com/demo/image/upload/v1/abc.png',
      });
      expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
        { folder: 'edulab/resources', resource_type: 'auto' },
        expect.any(Function),
      );
    });

    it.each([
      ['cloudName', { cloudName: undefined, apiKey: 'k', apiSecret: 's' }],
      ['apiKey', { cloudName: 'c', apiKey: undefined, apiSecret: 's' }],
      ['apiSecret', { cloudName: 'c', apiKey: 'k', apiSecret: undefined }],
    ])(
      'throws InternalServerErrorException when %s is missing, without attempting an upload',
      async (_label, partialConfig) => {
        config.cloudName = partialConfig.cloudName;
        config.apiKey = partialConfig.apiKey;
        config.apiSecret = partialConfig.apiSecret;

        await expect(service.uploadFile(buildFile())).rejects.toBeInstanceOf(
          InternalServerErrorException,
        );
        expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
      },
    );

    it('throws BadRequestException when the Cloudinary callback returns an error', async () => {
      mockUploadStream((callback) =>
        callback({ message: 'boom' } as UploadApiErrorResponse, undefined),
      );

      await expect(service.uploadFile(buildFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the Cloudinary callback returns neither an error nor a result', async () => {
      mockUploadStream((callback) => callback(undefined, undefined));

      await expect(service.uploadFile(buildFile())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
