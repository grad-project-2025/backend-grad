import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  testApp() {
    return 'Hello from backend.';
  }
}
