import type { BoxelsElement, BoxlesChildren, Child } from '@dom/elements/types.ts';
import { simpleUniqueId } from './unique-id.ts';

export function createComment(name: string) {
	const comment = document.createComment(name);
	(comment as any).key = simpleUniqueId('comment');
	return comment;
}

export function createTextNode(name: string) {
	const text = document.createTextNode(name);
	(text as any).key = simpleUniqueId('text');
	return text;
}

export function isNormalizedChild(child: Child): child is BoxlesChildren {
	return (
		typeof child === 'object' &&
		child !== null &&
		'nodes' in child &&
		'onMount' in child &&
		'cleanup' in child
	);
}

export function isBoxelsElement(value: any): value is BoxelsElement {
	return (
		value != null &&
		typeof value === 'object' &&
		typeof value.mount === 'function' &&
		typeof value.destroy === 'function' &&
		value.__boxels === true &&
		typeof value.__mounted === 'boolean' &&
		typeof value.__destroyed === 'boolean'
	);
}
