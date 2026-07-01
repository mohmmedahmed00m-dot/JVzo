import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { resolve } from 'path';
import configuration from './config/configuration';
import {
  User,
  Campaign,
  GeneratedAsset,
  Template,
  License,
  Export,
  RevokedToken,
} from './database/entities';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { GeneratorsModule } from './modules/generators/generators.module';
import { ExportModule } from './modules/export/export.module';
import { LicensingModule } from './modules/licensing/licensing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Load .env eagerly from an ABSOLUTE path so the process cwd never matters.
// Without this, launching the server from another working directory fails to
// find .env and every secret (DATABASE_URL etc.) becomes undefined.
import * as dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '..', '.env') });

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '..', '.env'),
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, Campaign, GeneratedAsset, Template, License, Export, RevokedToken],
        synchronize: false, // schema managed by migrations (Section 4)
        logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL')! },
      }),
    }),
    NotificationsModule,
    LicensingModule,
    AuthModule,
    GeneratorsModule,
    CampaignsModule,
    ExportModule,
  ],
})
export class AppModule {}
