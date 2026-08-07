import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssistantRequest } from './entities/assistant-request.entity';
import { AssistantRequestsService } from './assistant-requests.service';
import { AssistantRequestsController } from './assistant-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AssistantRequest])],
  providers: [AssistantRequestsService],
  controllers: [AssistantRequestsController],
  exports: [TypeOrmModule],
})
export class AssistantRequestsModule {}
