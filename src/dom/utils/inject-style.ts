type CSSProperties = Partial<
    Record<keyof CSSStyleDeclaration, string | number>
>;

export function injectStyle(
    css: string | Record<string, CSSProperties>,
    id?: string,
): HTMLStyleElement {
    let style: HTMLStyleElement | null = null;

    // Evitar duplicados por id
    if (id) {
        style = document.getElementById(id) as HTMLStyleElement | null;
    }

    if (!style) {
        style = document.createElement('style');
        if (id) style.id = id;
        document.head.appendChild(style);
    }

    // Si es un objeto, convertir a CSS string
    if (typeof css === 'object') {
        const lines: string[] = [];
        for (const selector in css) {
            const props = css[selector];
            const propLines = Object.entries(props)
                .map(([key, value]) => {
                    // convertir camelCase a kebab-case
                    const kebabKey = key.replace(
                        /[A-Z]/g,
                        (match) => '-' + match.toLowerCase(),
                    );
                    return `  ${kebabKey}: ${value};`;
                })
                .join('\n');
            lines.push(`${selector} {\n${propLines}\n}`);
        }
        style.textContent = lines.join('\n');
    } else {
        // si es string, usar tal cual
        style.textContent = css;
    }

    return style;
}