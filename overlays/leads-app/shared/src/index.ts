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
    {
      key: 'leads',
      label: 'Leads',
      path: '/leads',
    },
  ],
  permissions: [
    { key: PERMISSION, label: 'View hello', effect: 'read' },
    { key: 'lead:manage', label: 'Manage Leads', effect: 'write' },
    { key: 'icp:manage', label: 'Manage ICP', effect: 'write' },
  ],
});
