import { Controller, Get } from '@nestjs/common';
import { CurrentUser, RequirePermission } from '@vectoragents/vs-apps/nest';
import type { UserTokenClaims } from '@vectoragents/vs-apps';
import { PERMISSION } from '@hello-app/shared';

@Controller('hello')
export class HelloController {
  @Get()
  @RequirePermission(PERMISSION)
  hello(@CurrentUser() user: UserTokenClaims) {
    return { sub: user.sub, spaceId: user.spaceId };
  }
}
