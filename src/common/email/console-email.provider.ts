import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`-> ${to}: [${subject}] ${body}`);
  }
}
