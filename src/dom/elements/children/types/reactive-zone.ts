import { createComment, isBoxelsElement } from '@dom/utils/element';
import type { handlerChild } from '../type';
import type { ReactiveUnsubscribe, Signal } from '@core/reactive';
import { debug } from '@testing/debugger';
import type { BoxlesChildren, Child } from '@dom/elements/types';
import { normalizeChildren } from '..';
import { createChangeOverlay } from '../overlay';
import { deepEqual } from 'fast-equals';
import { BoxelsFragmentElement } from '@dom/elements/fragment';

/**
 * Reconciliación de nodos entre anchors
 * - Soporta duplicados
 * - Overlay si el nodo se mueve o cambia (incluyendo TextNode)
 */
function flattenNode(node: Node): Node[] {
	if (node instanceof BoxelsFragmentElement) {
		// Expande los nodos del fragmento
		return node.fragmentChildren;
	}
	return [node];
}

function reconcileChildrenBetweenAnchors(
	parent: Node,
	oldNodes: Node[],
	newNodes: Node[],
	start: Node,
	end: Node,
): Node[] {
	const used = new Set<Node>();
	const finalNodes: Node[] = [];
	let current: Node | null = start.nextSibling;

	const findMatch = (newNode: Node): Node | null => {
		if (newNode.nodeType === Node.TEXT_NODE) {
			for (const old of oldNodes.flatMap(flattenNode)) {
				if (!used.has(old) && old.nodeType === Node.TEXT_NODE && old.nodeValue === newNode.nodeValue)
					return old;
			}
			return null;
		}
		if ((newNode as any).key) {
			for (const old of oldNodes.flatMap(flattenNode)) {
				if (!used.has(old) && (old as any).key === (newNode as any).key)
					return old;
			}
		}
		return null;
	};

	for (const newNode of newNodes.flatMap(flattenNode)) {
		const matched = findMatch(newNode);

		if (matched) {
			used.add(matched);
			if (matched !== current) {
				parent.insertBefore(matched, current);
				if (debug.isShowChanges()) createChangeOverlay(matched);
			}
			finalNodes.push(matched);
		} else {
			parent.insertBefore(newNode, current);
			finalNodes.push(newNode);
			if (debug.isShowChanges()) createChangeOverlay(newNode);
		}

		if (isBoxelsElement(newNode)) newNode.mountEffect();
		if (current === matched || current === newNode)
			current = current?.nextSibling || null;
	}

	// Eliminar nodos sobrantes entre anchors
	let node = start.nextSibling;
	while (node && node !== end) {
		const next = node.nextSibling;
		if (!finalNodes.includes(node)) {
			if (isBoxelsElement(node)) node.destroy();
			else node.remove();
		}
		node = next;
	}

	return finalNodes;
}


export function handleReactiveZone(child: Signal<any>): handlerChild<Comment> {
	const start = createComment(debug.isShowCommentNames() ? 'signal:start' : '');
	const end = createComment(debug.isShowCommentNames() ? 'signal:end' : '');
	let currentChild: BoxlesChildren | null = null;

	const handleValue = (val: Child) => {
		const normalized = normalizeChildren(val);
		if (deepEqual(currentChild, normalized)) return;

		currentChild?.cleanup();

		const parent = start.parentNode;
		if (!parent || !end.parentNode) return;

		const oldNodes = currentChild?.nodes ?? [];
		const newNodes = normalized.nodes;

		const reconciled = reconcileChildrenBetweenAnchors(
			parent,
			oldNodes,
			newNodes,
			start,
			end,
		);

		normalized.onMount();
		currentChild = { ...normalized, nodes: reconciled };
	};

	let destroy: () => void = () => {};

	return {
		child: [start, end],
		mount: () => {
			let localCurrent: BoxlesChildren | null = null;

			const localHandler = (v: Child) => {
				handleValue(v);
				localCurrent = currentChild;
			};

			const unsub: ReactiveUnsubscribe = child.subscribe(localHandler);

			destroy = () => {
				localCurrent?.cleanup();

				if (localCurrent?.nodes) {
					for (const n of currentChild!.nodes) {
						if (isBoxelsElement(n)) n.destroy();
						else (n as ChildNode).remove();
					}
				}

				unsub();

				if (!start.parentElement || !end.parentElement) {
					start.remove();
					end.remove();
					return;
				}

				// Limpieza final entre anchors
				let node = start.nextSibling;
				while (node && node !== end) {
					const next = node.nextSibling;
					node.remove();
					node = next;
				}
			};
		},
		destroy,
	};
}
