import { cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const src = join(__dirname, '../', 'types');
const dest = join(__dirname, '../dist', 'types');

if (existsSync(src)) {
	try {
		cpSync(src, dest, { recursive: true });
		console.log(`✅ Copied: ${src} → ${dest}`);
	} catch (err) {
		console.error(`❌ Failed to copy types: ${err.message}`);
		process.exit(1);
	}
} else {
	console.warn(`⚠️ Source folder not found: ${src}`);
}
