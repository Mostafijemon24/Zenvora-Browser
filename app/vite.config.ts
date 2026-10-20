/// <reference types="vitest" />
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict Content-Security-Policy for the built UI (dev server needs inline scripts).
const csp: Plugin = {
  name: 'zenvora-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:11434",
      "object-src 'none'",
      "base-uri 'none'",
    ].join('; ');
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
};

export default defineConfig({
  // Relative asset paths so the build also loads from file:// in the desktop app.
  base: './',
  plugins: [react(), csp],
  test: {
    environment: 'jsdom',
  },
});
