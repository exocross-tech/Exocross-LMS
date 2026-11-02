import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBase = env.VITE_API_BASE_URL || 'http://localhost:3310/';
  const target = rawBase.replace(/\/api\/?$/, "").replace(/\/+$/, "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/uploads': {
          target: target,
          changeOrigin: true,
          secure: false,
        },
        '/ckeditor-upload-images': {
          target: target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

