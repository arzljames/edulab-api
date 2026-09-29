import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { User } from '@supabase/supabase-js';
import type { UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SUPABASE_CLIENT } from './../src/shared/supabase/supabase-client.provider';
import { CLOUDINARY_CLIENT } from './../src/features/uploads/cloudinary-client.provider';

describe('Uploads (e2e)', () => {
  let app: INestApplication<App>;
  let supabase: { auth: { getUser: jest.Mock } };
  let cloudinary: { uploader: { upload_stream: jest.Mock } };

  const mockUser = {
    id: 'user-1',
    email: 'teacher@edulab.dev',
  } as User;

  const mockedUploadUrl =
    'https://res.cloudinary.com/demo/image/upload/v1700000000/edulab/resources/abc123.png';

  function authenticate(): void {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
  }

  // Mirrors the shape uploads.service.spec.ts uses: `upload_stream` returns
  // a writable-stream-like object whose `.end()` synchronously drives the
  // callback originally passed to `upload_stream`.
  function mockUploadStreamOnce(
    invoke: (
      callback: (
        error?: UploadApiErrorResponse,
        result?: UploadApiResponse,
      ) => void,
    ) => void,
  ): void {
    cloudinary.uploader.upload_stream.mockImplementationOnce(
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

  beforeEach(async () => {
    supabase = { auth: { getUser: jest.fn() } };
    cloudinary = { uploader: { upload_stream: jest.fn() } };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SUPABASE_CLIENT)
      .useValue(supabase)
      .overrideProvider(CLOUDINARY_CLIENT)
      .useValue(cloudinary)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 401 with no bearer token', () => {
    return request(app.getHttpServer())
      .post('/api/v1/uploads')
      .attach('file', Buffer.from('hello'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(401);
  });

  it('returns 400 "No file provided." when the request has no file field', async () => {
    authenticate();

    const response = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', 'Bearer valid-token')
      .expect(400);

    expect(response.body.message).toBe('No file provided.');
  });

  it('returns 400 when uploading a file with a disallowed mimetype', async () => {
    authenticate();

    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from('MZ-fake-exe-bytes'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('returns 413 when the file exceeds the 15MB limit', async () => {
    authenticate();

    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);

    await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', 'Bearer valid-token')
      .attach('file', oversizedBuffer, {
        filename: 'huge.png',
        contentType: 'image/png',
      })
      .expect(413);
  });

  it('returns 201 with the uploaded URL on success', async () => {
    authenticate();
    mockUploadStreamOnce((callback) =>
      callback(undefined, { secure_url: mockedUploadUrl } as UploadApiResponse),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/uploads')
      .set('Authorization', 'Bearer valid-token')
      .attach('file', Buffer.from('small-file-contents'), {
        filename: 'photo.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual({ url: mockedUploadUrl });
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      { folder: 'edulab/resources', resource_type: 'auto' },
      expect.any(Function),
    );
  });
});
