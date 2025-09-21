import { defineConfig } from 'tsup';

export default defineConfig([
	// Bundle para la app principal (todo menos plugins)
	{
		entry: ['src/**/*.ts'],
		format: ['esm'],
		splitting: true,
		minify: true,
		clean: true,
		target: 'es2020',
		outDir: 'dist/src',
		platform: 'browser',
		shims: true,
		bundle: true,
		external: ['fs', 'os', 'path', 'child_process', 'crypto', 'tty', 'esbuild'],
		treeshake: true,
		tsconfig: './tsconfig.json',
		onSuccess: 'node scripts/copy-types.mjs',
	}
]);
