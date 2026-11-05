import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { Public } from '@vectoragents/vs-apps/nest';

@Injectable()
export class CanaryService {}

@Controller('canary')
export class CanaryController {
  // Type-only injection: the service arrives only when the dev runner emits decorator metadata.
  constructor(private readonly service: CanaryService) {}

  @Public()
  @Get()
  canary() {
    return { injected: this.service !== undefined };
  }
}

@Module({ controllers: [CanaryController], providers: [CanaryService] })
export class CanaryModule {}
