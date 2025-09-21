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

declare module '*.png' {
	const src: string;
	export default src;
}

declare module '*.jpg' {
	const src: string;
	export default src;
}

declare module '*.jpeg' {
	const src: string;
	export default src;
}

declare module '*.gif' {
	const src: string;
	export default src;
}

declare module '*.svg' {
	const src: string;
	export default src;
}

declare module '*.woff' {
	const src: string;
	export default src;
}

declare module '*.woff2' {
	const src: string;
	export default src;
}

declare module '*.ttf' {
	const src: string;
	export default src;
}

declare module '*.eot' {
	const src: string;
	export default src;
}

declare module '*.json' {
	const value: any;
	export default value;
}

declare module '*.yaml' {
	const value: any;
	export default value;
}

declare module '*.yml' {
	const value: any;
	export default value;
}

declare module '*.toml' {
	const value: any;
	export default value;
}

declare module '*.html' {
	const html: string;
	export default html;
}

declare module '*.md' {
	const content: string;
	export default content;
}

declare module '*.mp4' {
	const src: string;
	export default src;
}

declare module '*.webm' {
	const src: string;
	export default src;
}

declare module '*.mp3' {
	const src: string;
	export default src;
}

declare module '*.wav' {
	const src: string;
	export default src;
}
