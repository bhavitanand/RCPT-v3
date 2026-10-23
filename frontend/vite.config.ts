import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to the backend so no CORS setup is needed.
// For production builds set VITE_API_URL to the deployed API origin.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:5000' } },
  optimizeDeps: { exclude: ['lucide-react'] },
});
