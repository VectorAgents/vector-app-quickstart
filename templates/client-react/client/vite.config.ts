import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: Number(process.env.CLIENT_PORT),
    strictPort: true,
    proxy: { '/api': `http://localhost:${process.env.SERVER_PORT}` },
  },
});
