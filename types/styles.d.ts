type CssModule = { readonly [key: string]: string | CssModule };

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
