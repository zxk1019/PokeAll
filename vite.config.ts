import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para que funcione en cualquier carpeta (GitHub Pages, Netlify, abrir dist/ en un servidor...)
export default defineConfig({
  base: './',
  plugins: [react()],
});
