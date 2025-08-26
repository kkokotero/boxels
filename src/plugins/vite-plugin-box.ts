/** biome-ignore-all lint/suspicious/noAssignInExpressions: <explanation> */
/** biome-ignore-all lint/suspicious/noImplicitAnyLet: <explanation> */
import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import crypto from 'node:crypto';
import { transform } from 'esbuild';
import { existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

interface ParsedBox {
	template: string;
	scripts: string[];
	styles: string[];
	propsDirective: string;
	stylesDirective: string;
}

interface BoxPluginOptions {
	extensions?: string[];
	jsxImport?: string;
	classNameStrategy?: (className: string, hash: string) => string;
}

const VIRTUAL_PREFIX = 'virtual:box:';
const INTERNAL_PREFIX = `\0${VIRTUAL_PREFIX}`;

function shortHash(input: string): string {
	return crypto.createHash('sha1').update(input).digest('hex').slice(0, 8);
}

function parseBoxContent(_content: string): ParsedBox {
	const result: ParsedBox = {
		template: '',
		scripts: [],
		styles: [],
		propsDirective: '{}',
		stylesDirective: '{}',
	};

	let content = _content;

	// Extraer directivas especiales @props y @styles
	const directiveRegex = /^\/\/\s*@(props|styles)\s*({[\s\S]*?})\s*$/gm;
	let match;

	while ((match = directiveRegex.exec(content)) !== null) {
		const [, type, value] = match;
		if (type === 'props') result.propsDirective = value;
		if (type === 'styles') result.stylesDirective = value;
	}

	// Eliminar directivas del contenido
	content = content.replace(directiveRegex, '');

	// Parsear scripts
	const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
	let scriptMatch;
	while ((scriptMatch = scriptRegex.exec(content)) !== null) {
		result.scripts.push(scriptMatch[2].trim());
	}

	// Parsear estilos
	const styleRegex = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
	let styleMatch;
	while ((styleMatch = styleRegex.exec(content)) !== null) {
		result.styles.push(styleMatch[2].trim());
	}

	// El resto es template
	result.template = content
		.replace(scriptRegex, '')
		.replace(styleRegex, '')
		.trim();

	result.template = `<>${result.template}</>`;

	return result;
}

function extractImports(scriptCode: string): {
	imports: string;
	logic: string;
} {
	const importRegex = /^\s*import[\s\S]*?;$/gm;
	const imports: string[] = [];
	let cleanedCode = scriptCode;

	let match;
	while ((match = importRegex.exec(scriptCode)) !== null) {
		imports.push(match[0].trim());
	}
	cleanedCode = cleanedCode.replace(importRegex, '').trim();

	return {
		imports: imports.join('\n'),
		logic: cleanedCode,
	};
}

// ✅ Nuevo: PostCSS para scoping
async function generateScopedStyles(
	styles: string[],
	filePath: string,
	classNameStrategy: (className: string, hash: string) => string,
): Promise<{
	css: string;
	classMap: Record<string, string>;
}> {
	const hash = shortHash(filePath);
	const classMap: Record<string, string> = {};

	const processor = postcss([
		(root: { walkRules: (arg0: (rule: { selector: any; }) => void) => void; }) => {
			root.walkRules((rule: { selector: any; }) => {
				const transformed = selectorParser((selectors: { walkClasses: (arg0: (node: any) => void) => void; }) => {
					selectors.walkClasses((node) => {
						const original = node.value;
						const scopedName = classNameStrategy(original, hash);
						classMap[original] = scopedName;
						node.value = scopedName;
					});
				}).processSync(rule.selector);
				rule.selector = transformed;
			});
		},
	]);

	const result = await processor.process(styles.join('\n'), {
		from: undefined,
	});
	return { css: result.css, classMap };
}

function convertTypeScriptPropsToJS(propsDirective: string): string {
	try {
		return propsDirective
			.replace(/\s*:\s*\w+/g, '')
			.replace(/\?/g, '')
			.replace(/(\w+),/g, '"$1",')
			.replace(/(\w+)\s*}/, '"$1"}');
	} catch {
		console.warn('Error converting TypeScript props to JS');
		return '{}';
	}
}

export default function boxPlugin(opts: BoxPluginOptions = {}): Plugin {
	const extensions = opts.extensions || ['.box'];
	const jsxImport = opts.jsxImport || 'boxels/jsx-runtime';
	const resolvedIds = new Map<string, string>();
	const virtualToRealMap = new Map<string, string>();
	let server: ViteDevServer | undefined;

	const classNameStrategy =
		opts.classNameStrategy ||
		((className: string, hash: string) => `${className}-${hash}`);

	return {
		name: 'vite-plugin-box',
		enforce: 'pre',

		configureServer(viteServer) {
			server = viteServer;
		},

		config() {
			return {
				esbuild: {
					jsx: 'automatic',
					include: /\.(tsx|jsx|ts|js|box)$/,
				},
			};
		},

		async resolveId(id, importer) {
			if (id.startsWith(VIRTUAL_PREFIX)) {
				return INTERNAL_PREFIX + id.slice(VIRTUAL_PREFIX.length);
			}

			const cleanId = id.split('?')[0].split('#')[0];
			if (!extensions.some((ext) => cleanId.endsWith(ext))) return null;

			let realImporter = importer;
			if (importer && importer.startsWith(INTERNAL_PREFIX)) {
				const parts = importer.slice(INTERNAL_PREFIX.length).split(':');
				realImporter = parts.slice(2).join(':');
			}

			const absPath = path.isAbsolute(cleanId)
				? cleanId
				: path.resolve(path.dirname(realImporter || process.cwd()), cleanId);

			try {
				await access(absPath);
				const hash = shortHash(absPath);
				const resolved = `${INTERNAL_PREFIX}main:${hash}:${absPath}`;
				resolvedIds.set(absPath, resolved);
				virtualToRealMap.set(resolved, absPath);
				return resolved;
			} catch {
				return null;
			}
		},

		async load(id) {
			if (!id.startsWith(INTERNAL_PREFIX)) return null;

			const parts = id.slice(INTERNAL_PREFIX.length).split(':');
			const type = parts[0];
			const filePath = parts.slice(2).join(':');

			if (!filePath) return { code: '', map: null };

			try {
				if (type === 'main') {
					this.addWatchFile(filePath);
					const source = await readFile(filePath, 'utf-8');
					const { template, scripts, styles, propsDirective } =
						parseBoxContent(source);

					const hash = shortHash(filePath);

					const jsxResult = await transform(template, {
						loader: 'tsx',
						target: 'esnext',
						jsxImportSource: jsxImport,
						jsx: 'automatic',
					});

					let jsxCode = jsxResult.code
						.replace(/^import\s.*?;$/gm, '')
						.replace(/^export\s.*?;$/gm, '')
						.trim();
					if (jsxCode.endsWith(';')) jsxCode = jsxCode.slice(0, -1);

					const combinedScript = scripts.join('\n');
					const { imports, logic } = extractImports(combinedScript);

					let styleImport = '';
					let styleObject = '{}';

					if (styles.length > 0) {
						const { css, classMap } = await generateScopedStyles(
							styles,
							filePath,
							classNameStrategy,
						);
						const styleId = `${VIRTUAL_PREFIX}style:${hash}:${filePath}`;
						styleObject = JSON.stringify(classMap).replace(/"/g, "'");
						styleImport = `import '${styleId}';\n`;

						this.emitFile({
							type: 'asset',
							fileName: `${path.basename(filePath, path.extname(filePath))}_${hash}.css`,
							source: css,
						});
					}

					const processedPropsDirective =
						convertTypeScriptPropsToJS(propsDirective);

					const code = `
import { jsx, jsxs, Fragment } from '${jsxImport}';
${imports}
${styleImport}

const __props = ${processedPropsDirective};
const __styles = ${styleObject};

export default function BoxComponent(____props = {}) {
  const props = { ...Object.fromEntries(Object.keys(__props).map(key => [key, props[key]])), ...____props };
  const styles = __styles;
  ${logic}
  return ${jsxCode};
}

if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
`.trim();

					return { code, map: null };
				}

				if (type === 'style') {
					this.addWatchFile(filePath);
					const source = await readFile(filePath, 'utf-8');
					const { styles } = parseBoxContent(source);

					if (styles.length === 0) return { code: '', map: null };

					const { css } = await generateScopedStyles(
						styles,
						filePath,
						classNameStrategy,
					);

					const code = `
(function() {
  const css = \`${css.replace(/`/g, '\\`')}\`;
  const styleId = 'box-style-${shortHash(filePath)}';
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) existingStyle.remove();
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
})();
`.trim();

					return { code, map: null };
				}
			} catch (error) {
				console.error(`Error processing ${filePath}:`, error);
				return null;
			}

			return null;
		},

		handleHotUpdate(ctx) {
			const modules = [];
			const resolvedId = resolvedIds.get(ctx.file);

			if (resolvedId && server) {
				const module = server.moduleGraph.getModuleById(resolvedId);
				if (module) modules.push(module);

				const styleId = resolvedId.replace('main:', 'style:');
				const styleModule = server.moduleGraph.getModuleById(styleId);
				if (styleModule) modules.push(styleModule);
			}

			if (!existsSync(ctx.file)) {
				resolvedIds.delete(ctx.file);
				virtualToRealMap.forEach((value, key) => {
					if (value === ctx.file) virtualToRealMap.delete(key);
				});
			}

			return modules;
		},
	};
}
