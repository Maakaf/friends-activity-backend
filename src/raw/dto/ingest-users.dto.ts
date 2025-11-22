import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class IngestUsersDto {
  @ApiProperty({
    type: [String],
    example: ['barlavi1', 'UrielOfir', 'Lidor57'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  users!: string[];
}
