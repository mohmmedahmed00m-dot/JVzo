import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedAsset, Template } from '../../database/entities';
import { GeneratorsService } from './generators.service';
import { AiEngineService } from './ai-engine/ai-engine.service';
import { LlmClientService } from './ai-engine/llm-client.service';

@Module({
  imports: [TypeOrmModule.forFeature([GeneratedAsset, Template])],
  providers: [GeneratorsService, AiEngineService, LlmClientService],
  exports: [GeneratorsService, AiEngineService],
})
export class GeneratorsModule {}
