import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequireCapability } from '@vectoragents/vs-apps/nest';
import type { UserTokenClaims } from '@vectoragents/vs-apps';
import { CAPABILITY } from '@hello-app/shared';

@Controller('hello')
export class HelloController {
  @Get()
  @RequireCapability(CAPABILITY)
  hello(@CurrentUser() user: UserTokenClaims) {
    return { sub: user.sub, spaceId: user.spaceId };
  }
}
