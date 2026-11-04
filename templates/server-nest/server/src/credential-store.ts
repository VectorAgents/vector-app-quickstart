import { Injectable } from '@nestjs/common';
import type { AppCredentialStore } from '@vectoragents/vs-apps/nest';

// Keeps secrets in memory and loses them on restart. Implement AppCredentialStore over real storage before production.
@Injectable()
export class MemoryCredentialStore implements AppCredentialStore {
  private readonly secrets = new Map<string, string>();

  async upsert(appId: string, spaceId: number, secret: string): Promise<void> {
    this.secrets.set(`${appId}:${spaceId}`, secret);
  }

  async remove(appId: string, spaceId: number): Promise<void> {
    this.secrets.delete(`${appId}:${spaceId}`);
  }

  async get(appId: string, spaceId: number): Promise<string | null> {
    return this.secrets.get(`${appId}:${spaceId}`) ?? null;
  }
}
