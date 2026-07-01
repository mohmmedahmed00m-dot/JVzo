import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { ExportService } from './export.service';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LicenseGuard } from '../../common/guards/license.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

class ExportDto {
  @IsOptional() @IsArray() @IsString({ each: true }) formats?: string[];
  @IsBoolean() bundle_as_zip: boolean;
}

@Controller()
@UseGuards(JwtAuthGuard, LicenseGuard)
export class ExportController {
  constructor(
    private readonly exports: ExportService,
    private readonly storage: StorageService,
  ) {}

  @Post('campaigns/:id/export')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createExport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ExportDto,
  ) {
    const formats = dto.formats && dto.formats.length ? dto.formats : ['review', 'bonus', 'emails', 'social', 'cta'];
    return this.exports.createExport(user.id, id, { formats, bundle_as_zip: dto.bundle_as_zip });
  }

  @Get('campaigns/:id/exports')
  async listExports(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.exports.listExports(user.id, id);
  }

  @Get('exports/:id/download')
  async download(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    const exportRec = await this.exports.getDownload(user.id, id);
    const buffer = await this.storage.readBuffer(exportRec.storage_path);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${exportRec.campaign_id}.zip"`);
    res.send(buffer);
  }
}
