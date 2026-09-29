import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { UploadApiResponse } from 'cloudinary';
import type {} from 'multer';
import {
  CLOUDINARY_CLIENT,
  type CloudinaryClient,
} from './cloudinary-client.provider';
import type { UploadResponseDto } from './dto/upload-response.dto';
import cloudinaryConfig from './uploads-config';

const CLOUDINARY_FOLDER = 'edulab/resources';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    @Inject(CLOUDINARY_CLIENT)
    private readonly cloudinary: CloudinaryClient,
    @Inject(cloudinaryConfig.KEY)
    private readonly config: ConfigType<typeof cloudinaryConfig>,
  ) {}

  async uploadFile(file: Express.Multer.File): Promise<UploadResponseDto> {
    if (!this.config.cloudName || !this.config.apiKey || !this.config.apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { folder: CLOUDINARY_FOLDER, resource_type: 'auto' },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error('Cloudinary upload returned no result.'));
            return;
          }
          resolve(uploadResult);
        },
      );
      stream.end(file.buffer);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Cloudinary upload failed: ${message}`);
      throw new BadRequestException('Failed to upload file.');
    });

    return { url: result.secure_url };
  }
}
