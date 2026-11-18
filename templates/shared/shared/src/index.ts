import { defineApp } from '@vectoragents/vs-apps';

export const PERMISSION = 'hello:view';

export const definition = defineApp({
  key: 'hello-app',
  name: 'Hello app',
  version: '0.1.0',
  pages: [
    {
      key: 'home',
      label: 'Home',
      path: '/',
      permission: PERMISSION,
    },
  ],
  permissions: [{ key: PERMISSION, label: 'View hello', effect: 'read' }],
});
