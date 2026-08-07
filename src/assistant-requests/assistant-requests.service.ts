import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssistantRequest } from './entities/assistant-request.entity';
import { CreateAssistantRequestDto } from './dto/create-assistant-request.dto';

@Injectable()
export class AssistantRequestsService {
  constructor(
    @InjectRepository(AssistantRequest)
    private readonly assistantRequests: Repository<AssistantRequest>,
  ) {}

  create(dto: CreateAssistantRequestDto): Promise<AssistantRequest> {
    return this.assistantRequests.save(this.assistantRequests.create(dto));
  }
}
