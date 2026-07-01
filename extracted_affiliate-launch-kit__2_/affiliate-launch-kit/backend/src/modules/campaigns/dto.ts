import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsDateString,
  MinLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TONES = ['professional', 'casual', 'hype', 'trust-based'] as const;
export const ASSET_TYPES = ['review', 'bonus', 'email_sequence', 'social_posts', 'cta'] as const;

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  product_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  product_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  niche?: string;

  @IsEnum(TONES)
  tone: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  target_audience?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(ASSET_TYPES, { each: true })
  generators_selected?: string[];
}

export class UpdateAssetDto {
  @IsString()
  content: string;
}

export class RegenerateDto {
  @IsOptional()
  @IsString()
  custom_instruction?: string;
}

export class ListCampaignsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() date_from?: string;
  @IsOptional() @IsDateString() date_to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}
