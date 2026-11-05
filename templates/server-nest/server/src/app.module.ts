import { Module } from '@nestjs/common';
import { AppPlatformModule } from '@vectoragents/vs-apps/nest';
import { MemoryCredentialStore } from './credential-store';
import { HelloController } from './hello.controller';
import { manifests } from './manifests';

@Module({
  imports: [
    AppPlatformModule.forRoot({
      options: () => ({
        // The platform module takes the Space origin; SPACE_API_URL ends in /api.
        spaceBaseUrl: (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, ''),
        spaceJwksUrl: process.env.SPACE_JWKS_URL ?? '',
        allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN ?? '',
      }),
      manifests,
      credentialStore: MemoryCredentialStore,
      // Harness mode has no Space JWKS: the module mints its own tokens. dev:space leaves VA_DEV_ISSUER unset.
      devIssuer: process.env.VA_DEV_ISSUER === 'true',
    }),
  ],
  controllers: [HelloController],
})
export class AppModule {}
