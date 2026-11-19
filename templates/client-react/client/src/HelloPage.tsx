import { useEffect, useState } from 'react';
import { PERMISSION } from '@hello-app/shared';
import { RequirePermission, useApp } from '@vectoragents/vs-apps/react';
import { fetchHello } from './token';

export function HelloPage() {
  const { claims, permissions } = useApp();
  const [serverSaw, setServerSaw] = useState<string>('waiting for the server');

  useEffect(() => {
    fetchHello()
      .then((hello) => setServerSaw(`space ${hello.spaceId}, user ${hello.sub ?? 'unknown'}`))
      .catch((error: Error) => setServerSaw(error.message));
  }, []);

  return (
    <RequirePermission permission={PERMISSION} fallback={<p>You do not hold {PERMISSION}.</p>}>
      <main>
        <h1>Hello from a Vector app</h1>
        <p>Verified in the browser: user {claims?.sub ?? 'unknown'} in space {claims?.spaceId}.</p>
        <p>Permissions: {Array.from(permissions).join(', ')}</p>
        <p>Verified on the server: {serverSaw}</p>
      </main>
    </RequirePermission>
  );
}
