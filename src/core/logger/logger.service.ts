import { Logger } from '@nestjs/common';

export class CustomLogger extends Logger {
  constructor(context: string) {
    super(context);
  }
}
