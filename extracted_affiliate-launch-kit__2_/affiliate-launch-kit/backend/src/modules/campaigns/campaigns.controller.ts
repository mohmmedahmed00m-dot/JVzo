import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateAssetDto, RegenerateDto, ListCampaignsQuery } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LicenseGuard } from '../../common/guards/license.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@Controller('campaigns')
@UseGuards(JwtAuthGuard, LicenseGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.id, dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCampaignsQuery) {
    return this.campaigns.list(user.id, query);
  }

  @Get(':id')
  async getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { campaign: await this.campaigns.getOne(user.id, id) };
  }

  @Get(':id/assets')
  async getAssets(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.getAssets(user.id, id);
  }

  @Post(':id/duplicate')
  async duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.campaigns.duplicate(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Res() res: Response) {
    await this.campaigns.remove(user.id, id);
    return res.status(204).send();
  }

  @Patch(':id/assets/:asset_type')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('asset_type') assetType: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.campaigns.updateAsset(user.id, id, assetType, dto.content);
  }

  @Post(':id/assets/:asset_type/regenerate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('asset_type') assetType: string,
    @Body() dto: RegenerateDto,
  ) {
    return this.campaigns.regenerate(user.id, id, assetType, dto.custom_instruction);
  }
}
