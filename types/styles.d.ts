type CssModule = Record<string, any>;

declare module '*.scss' {
	const classes: CssModule;
	export default classes;
}

declare module '*.sass' {
	const classes: CssModule;
	export default classes;
}

declare module '*.css' {
	const classes: CssModule;
	export default classes;
}
