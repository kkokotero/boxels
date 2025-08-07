import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/**/*.ts'],
	format: ['esm'],
	splitting: true,
	minify: true,
	dts: true,
	clean: true,
	target: 'esnext',
	outDir: 'dist/src',
	platform: 'browser',
	shims: true,
	bundle: true,
	treeshake: true,
	external: [],
	tsconfig: './tsconfig.json',
	onSuccess: 'node scripts/copy-types.mjs',
});
