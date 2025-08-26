import { defineConfig } from 'tsup';

export default defineConfig([
	// Bundle para la app principal (todo menos plugins)
	{
		entry: ['src/**/*.ts', '!src/plugins/**'],
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
		external: ['fs', 'os', 'path', 'child_process', 'crypto', 'tty', 'esbuild'],
		tsconfig: './tsconfig.json',
		onSuccess: 'node scripts/copy-types.mjs',
	},

	// Compilación para plugins (sin bundle, tal cual TS → JS)
	{
		entry: ['src/plugins/**/*.ts'],
		format: ['cjs', 'esm'],
		shims: true,
		bundle: true,
		treeshake: true,
		splitting: true,
		minify: true,
		dts: true,
		clean: true,
		external: ['esbuild'],
		outDir: 'dist/plugins',
		platform: 'node',
		tsconfig: './tsconfig.json',
	},
]);
