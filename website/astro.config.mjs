import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pastecraft.com',
  output: 'static',
  build: {
    format: 'file',
  },
});
