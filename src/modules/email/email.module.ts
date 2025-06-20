import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailTestController } from './controllers/email-test.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [EmailTestController],
  providers: [EmailService, EmailTemplateService],
  exports: [EmailService, EmailTemplateService],
})
export class EmailModule {}
