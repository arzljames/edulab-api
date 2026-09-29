import type { Provider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { v2 as cloudinary, type ConfigOptions } from 'cloudinary';
import cloudinaryConfig from './uploads-config';

export const CLOUDINARY_CLIENT = Symbol('CLOUDINARY_CLIENT');

export type CloudinaryClient = typeof cloudinary;

/**
 * Configures the client with whatever credentials are present, even if
 * incomplete — never throws here. Missing-config is a real possibility in
 * environments that don't touch uploads at all (tests, local dev without
 * Cloudinary set up yet), and this provider is eagerly instantiated at
 * module bootstrap, so throwing here would crash the entire app rather than
 * just the uploads feature. `UploadsService` validates config lazily, right
 * before an actual upload is attempted.
 */
export const cloudinaryClientProvider: Provider<CloudinaryClient> = {
  provide: CLOUDINARY_CLIENT,
  inject: [cloudinaryConfig.KEY],
  useFactory: (config: ConfigType<typeof cloudinaryConfig>): CloudinaryClient => {
    const options: ConfigOptions = {
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    };
    cloudinary.config(options);

    return cloudinary;
  },
};
