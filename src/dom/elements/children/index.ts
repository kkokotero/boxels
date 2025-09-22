import { debug } from '@testing/debugger';
import type { BoxlesChildren, Child } from '../types';
import { ensureChangeStyles } from './overlay';
import { createTextNode, isBoxelsElement, isNormalizedChild } from '@dom/utils';
import { handleBoxelsElement } from './types/boxels-element';
import type { handlerChild } from './type';
import { handleNormalizedChild } from './types/normalized-child';
import { isSignal } from '@core/reactive';
import { handleReactiveZone } from './types/reactive-zone';
import { handlePromiseElement } from './types/promise-element';
import { handleFunctionElement } from './types/function-element';
import { handleDocumentFragment } from './types/fragment-element';
import { handleNormalNode } from './types/node-element';
import { handleListElement } from './types/list-element';
import { BoxelsFragmentElement } from '../fragment';

export function normalizeChildren(input: Child): BoxlesChildren {
	if (debug.isShowChanges()) ensureChangeStyles();

	const nodes: Node[] = [];
	const cleanUps: (() => void)[] = [];
	const onMounts: (() => void)[] = [];

	const handleResult = (result: handlerChild<Node>) => {
		nodes.push(...result.child);
		onMounts.push(result.mount);
		cleanUps.push(result.destroy);
	};

	const children: Child[] = Array.isArray(input) ? [...input] : [input];

	while (children.length) {
		const child = children.shift();

		if (isBoxelsElement(child)) {
			handleResult(handleBoxelsElement(child));
			continue;
		}

		if (isNormalizedChild(child)) {
			handleResult(handleNormalizedChild(child));
			continue;
		}

		if (isSignal(child)) {
			handleResult(handleReactiveZone(child));
			continue;
		}

		if (child instanceof Promise) {
			handleResult(handlePromiseElement(child));
			continue;
		}

		if (typeof child === 'function') {
			handleResult(handleFunctionElement(child));
			continue;
		}

		if (child instanceof DocumentFragment) {
			handleResult(handleDocumentFragment(child));
			continue;
		}

		if (child instanceof Node) {
			handleResult(handleNormalNode(child));
			continue;
		}

		if (Array.isArray(child)) {
			handleResult(handleListElement(child));
			continue;
		}

		if (typeof child === 'object') {
			nodes.push(createTextNode(JSON.stringify(child, null, 2)));
			continue;
		}

		nodes.push(createTextNode(String(child)));
	}

	return {
		nodes,
		onMount: () => {
			for (const fn of onMounts) fn();
		},
		cleanup: () => {
			for (const fn of cleanUps) fn();
		},
	};
}
