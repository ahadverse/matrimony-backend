import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssistantRequest } from './entities/assistant-request.entity';
import { CreateAssistantRequestDto } from './dto/create-assistant-request.dto';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';

@Injectable()
export class AssistantRequestsService {
  private readonly logger = new Logger('AssistantRequestsService');

  constructor(
    @InjectRepository(AssistantRequest)
    private readonly assistantRequests: Repository<AssistantRequest>,
    private readonly adminNotifications: AdminNotificationsGateway,
  ) {}

  async create(dto: CreateAssistantRequestDto): Promise<AssistantRequest> {
    const request = await this.assistantRequests.save(
      this.assistantRequests.create(dto),
    );
    try {
      this.adminNotifications.notifyAssistantRequestCreated({
        id: request.id,
        name: request.name,
        phone: request.phone,
        email: request.email,
        createdAt: request.createdAt,
      });
    } catch (error) {
      this.logger.error('Failed to push admin notification', error as Error);
    }
    return request;
  }
}
