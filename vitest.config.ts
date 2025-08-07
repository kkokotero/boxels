import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['test/**/*', 'node_modules/**/*']
    },
    include: ['test/**/*.test.ts'],
    globals: true,
    alias: {
      '@core': resolve(__dirname, './src/core'),
      '@dom': resolve(__dirname, './src/dom'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@data': resolve(__dirname, './src/data'),
      '@testing': resolve(__dirname, './src/testing')
    }
  }
});
