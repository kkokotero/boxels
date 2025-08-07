import { defineConfig } from 'vite';

import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	root: './examples',
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: '@runtime',
	},
	plugins: [tsconfigPaths()],
});
