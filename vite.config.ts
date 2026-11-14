import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  // Listen on IPv4 and IPv6 so both http://localhost:5199 and http://127.0.0.1:5199 work.
  server: { host: true, port: 5199, strictPort: true },
  test: { environment: 'node' },
} as never);
