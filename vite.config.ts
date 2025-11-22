import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // On Vercel, process.env contains the system variables (Production/Preview/Development keys).
  // We prioritize process.env.API_KEY to ensure the dashboard setting takes precedence.
  const apiKey = process.env.API_KEY || env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
  };
});