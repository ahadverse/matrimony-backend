import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssistantRequestsService } from './assistant-requests.service';
import { CreateAssistantRequestDto } from './dto/create-assistant-request.dto';

// Public — the assistance-service landing page collects leads before the
// visitor has an account, so this deliberately sits outside JwtAuthGuard.
@ApiTags('assistant-requests')
@Controller('assistant-requests')
export class AssistantRequestsController {
  constructor(
    private readonly assistantRequestsService: AssistantRequestsService,
  ) {}

  @Post()
  create(@Body() dto: CreateAssistantRequestDto) {
    return this.assistantRequestsService.create(dto);
  }
}
