import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description:
      'Public URL of the uploaded file. Store this string directly in the field that references it (e.g. a resource\'s `file`) — no other upload metadata is persisted.',
    example:
      'https://res.cloudinary.com/demo/image/upload/v1700000000/edulab/resources/abc123.pdf',
  })
  url: string;
}
