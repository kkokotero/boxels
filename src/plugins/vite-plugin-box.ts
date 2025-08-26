/** biome-ignore-all lint/suspicious/noAssignInExpressions: <explanation> */
/** biome-ignore-all lint/suspicious/noImplicitAnyLet: <explanation> */
import type { Plugin, ViteDevServer } from 'vite';
import path from 'node:path';
import crypto from 'node:crypto';
import { transform } from 'esbuild';
import { existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';

interface ParsedBox {
	template: string;
	scripts: string[];
	styles: string[];
	propsDirective: string;
	stylesDirective: string;
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

	// Eliminar directivas del contenido para no interferir con el parsing
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

	// El resto es template (eliminando las secciones script/style)
	result.template = content
		.replace(scriptRegex, '')
		.replace(styleRegex, '')
		.trim();

	result.template = `<>${result.template}</>`;

	return result;
}

function extractImports(scriptCode: string): { imports: string; logic: string } {
    // Regex mejorado:
    // - Captura líneas que empiezan con "import"
    // - Soporta espacios, saltos de línea, type imports y side-effect imports
    const importRegex = /^\s*import[\s\S]*?;$/gm;

    const imports: string[] = [];
    let cleanedCode = scriptCode;

    let match;
    while ((match = importRegex.exec(scriptCode)) !== null) {
        imports.push(match[0].trim());
    }

    // Elimina los imports del código original
    cleanedCode = cleanedCode.replace(importRegex, '').trim();

    return {
        imports: imports.join('\n'),
        logic: cleanedCode
    };
}

function generateScopedStyles(
	styles: string[],
	filePath: string,
): {
	css: string;
	classMap: Record<string, string>;
} {
	const hash = shortHash(filePath);
	const classMap: Record<string, string> = {};
	let processedCSS = '';

	for (const style of styles) {
		// Procesar cada clase CSS para agregar un hash único
		const scopedCSS = style.replace(
			/\.([a-zA-Z0-9_-]+)/g,
			(match, className) => {
				const scopedName = `${className}-${hash}`;
				classMap[className] = scopedName;
				return `.${scopedName}`;
			},
		);
		processedCSS += `${scopedCSS}\n`;
	}

	return { css: processedCSS, classMap };
}

// Función para convertir TypeScript props a JavaScript válido
function convertTypeScriptPropsToJS(propsDirective: string): string {
	try {
		// Remover tipos TypeScript y mantener solo los nombres de las props
		return propsDirective
			.replace(/\s*:\s*\w+/g, '')
			.replace(/\?/g, '')
			.replace(/(\w+),/g, '"$1",')
			.replace(/(\w+)\s*}/, '"$1"}');
	} catch (e) {
		console.warn('Error converting TypeScript props to JS, using empty object');
		return '{}';
	}
}

export default function boxPlugin(
	opts: { extensions?: string[]; jsxImport?: string } = {},
): Plugin {
	const extensions = opts.extensions || ['.box'];
	const jsxImport = opts.jsxImport || 'react';
	const resolvedIds = new Map<string, string>();
	const virtualToRealMap = new Map<string, string>(); // Nuevo mapa para mapeo inverso
	let server: ViteDevServer | undefined;

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
				optimizeDeps: {
					esbuildOptions: {
						jsx: 'automatic',
					},
				},
			};
		},

		async resolveId(id, importer) {
			if (id.startsWith(VIRTUAL_PREFIX)) {
				return INTERNAL_PREFIX + id.slice(VIRTUAL_PREFIX.length);
			}

			const cleanId = id.split('?')[0].split('#')[0];
			if (!extensions.some((ext) => cleanId.endsWith(ext))) return null;

			// Obtener ruta real del importador si es virtual
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
				virtualToRealMap.set(resolved, absPath); // Guardar mapeo inverso
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
				// Módulo principal (.box)
				if (type === 'main') {
					this.addWatchFile(filePath);
					const source = await readFile(filePath, 'utf-8');
					const { template, scripts, styles, propsDirective, stylesDirective } =
						parseBoxContent(source);

					// Generar hash para el archivo
					const hash = shortHash(filePath);

					// Procesar template a JSX
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

					if (jsxCode.endsWith(';')) {
						jsxCode = jsxCode.slice(0, -1);
					}

					// Combinar todos los scripts
					const combinedScript = scripts.join('\n');
					const { imports, logic } = extractImports(combinedScript);

					// Procesar estilos con scoping
					let styleImport = '';
					let styleObject = '{}';

					if (styles.length > 0) {
						const { css, classMap } = generateScopedStyles(styles, filePath);
						const styleId = `${VIRTUAL_PREFIX}style:${hash}:${filePath}`;

						// Crear objeto de estilos con nombres mapeados
						styleObject = JSON.stringify(classMap).replace(/"/g, "'");

						// Importar el módulo de estilo
						styleImport = `import '${styleId}';\n`;

						// Guardar el CSS procesado para el módulo de estilo
						this.emitFile({
							type: 'asset',
							fileName: `${path.basename(filePath, path.extname(filePath))}_${hash}.css`,
							source: css,
						});
					}

					// Convertir TypeScript props a JavaScript válido
					const processedPropsDirective =
						convertTypeScriptPropsToJS(propsDirective);

					const code = `
import { jsx, jsxs, Fragment } from '${jsxImport}';
${imports}
${styleImport}

// Directivas especiales
const __props = ${processedPropsDirective};
const __styles = ${styleObject};

export default function BoxComponent(____props = {}) {
  // Combinar props recibidas con las definidas en @props
  const props = {
    ...Object.fromEntries(
      Object.keys(__props).map(key => [key, props[key] !== undefined ? props[key] : undefined])
    ),
    ...____props
  };
  
  // Hacer disponibles los estilos definidos
  const styles = __styles;
  
  ${logic}
  
  return ${jsxCode};
}

// Soporte HMR mejorado
if (import.meta.hot) {
  import.meta.hot.accept(async (newModule) => {
    if (newModule) {
      // Recarga completa de la página
      window.location.reload();
    }
  });
  
  import.meta.hot.dispose(() => {
    // Cleanup si es necesario
  });
}
`.trim();

					return { code, map: null };
				}

				// Módulo de estilo
				if (type === 'style') {
					this.addWatchFile(filePath);
					const source = await readFile(filePath, 'utf-8');
					const { styles } = parseBoxContent(source);

					if (styles.length === 0) return { code: '', map: null };

					// Procesar estilos con scoping
					const { css } = generateScopedStyles(styles, filePath);

					const code = `
(function() {
  const css = \`${css.replace(/`/g, '\\`')}\`;
  const styleId = 'box-style-${shortHash(filePath)}';
  
  // Eliminar estilo anterior si existe
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.parentNode.removeChild(existingStyle);
  }
  
  // Crear y agregar nuevo estilo
  const styleEl = document.createElement('style');
  styleEl.id = styleId;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // HMR para estilos
  if (import.meta.hot) {
    import.meta.hot.accept(() => {
      // El estilo ya se actualizó automáticamente
    });

    import.meta.hot.dispose(() => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    });
  }
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
			// Invalidar caché cuando los archivos cambian
			const modules = [];
			const resolvedId = resolvedIds.get(ctx.file);

			if (resolvedId && server) {
				const module = server.moduleGraph.getModuleById(resolvedId);
				if (module) {
					modules.push(module);
				}

				// También buscar y actualizar módulos de estilo relacionados
				const styleId = resolvedId.replace('main:', 'style:');
				const styleModule = server.moduleGraph.getModuleById(styleId);
				if (styleModule) {
					modules.push(styleModule);
				}
			}

			// Limpiar mapeos para archivos eliminados
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