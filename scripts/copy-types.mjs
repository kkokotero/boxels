#!/usr/bin/env node
import { cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
	const tsc = spawn(
		/^win/.test(process.platform) ? 'npx.cmd' : 'npx',
		['tsc', '-p', 'tsconfig.types.json'],
		{
			stdio: 'inherit',
			shell: true,
			env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
		},
	);

	tsc.on('exit', (code) => {
		if (code !== 0) {
			console.error(`tsc exited with code ${code}`);
			process.exit(code || 1);
		} else {
			copyTypes();
		}
	});
}

function copyTypes() {
	const src = join(__dirname, '../types');
	const dest = join(__dirname, '../dist/types');

	if (existsSync(src)) {
		try {
			cpSync(src, dest, { recursive: true });
			console.log(`Copied: ${src} → ${dest}`);
		} catch (err) {
			console.error(`Failed to copy types: ${err.message}`);
			process.exit(1);
		}
	} else {
		console.warn(`Source folder not found: ${src}`);
	}
}

run();
