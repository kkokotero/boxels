import { createComment, isBoxelsElement } from '@dom/utils/element';
import type { handlerChild } from '../type';
import type { ReactiveUnsubscribe, Signal } from '@core/reactive';
import { debug } from '@testing/debugger';
import type { BoxlesChildren, Child } from '@dom/elements/types';
import { normalizeChildren } from '..';
import { createChangeOverlay } from '../overlay';
import { deepEqual } from 'fast-equals';

/**
 * Reconciliación eficiente entre anchors validando directamente en el DOM
 */
function reconcileChildrenBetweenAnchors(
	parent: Node,
	newNodes: Node[],
	start: Node,
	end: Node,
): Node[] {
	const finalNodes: Node[] = [];
	const usedKeys = new Map<any, Node[]>();
	let current = start.nextSibling;

	// Indexar nodos existentes por key
	for (
		let node = start.nextSibling;
		node && node !== end;
		node = node.nextSibling
	) {
		const key = (node as any).key;
		if (key !== undefined) {
			if (!usedKeys.has(key)) usedKeys.set(key, []);
			usedKeys.get(key)!.push(node);
		}
	}

	const findMatch = (newNode: Node): Node | null => {
		const key = (newNode as any).key;
		if (key !== undefined && usedKeys.has(key)) {
			const nodes = usedKeys.get(key)!;
			for (let i = 0; i < nodes.length; i++) {
				const candidate = nodes[i];
				if (candidate.parentNode === parent) {
					nodes.splice(i, 1); // Marcar como usado
					return candidate;
				}
			}
		}
		return null;
	};

	for (const newNode of newNodes) {
		const matched = findMatch(newNode);

		if (matched) {
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

	// Eliminar nodos sobrantes directamente, evitando includes
	for (let node = start.nextSibling; node && node !== end; ) {
		const next = node.nextSibling;
		if (!finalNodes.some((n) => n === node)) {
			if (isBoxelsElement(node)) node.destroy();
			else node.remove();
		}
		node = next;
	}

	return finalNodes;
}

/**
 * Maneja una zona reactiva entre comentarios
 */
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

		const reconciled = reconcileChildrenBetweenAnchors(
			parent,
			normalized.nodes,
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
					for (const n of localCurrent.nodes) {
						if (isBoxelsElement(n)) n.destroy();
						else (n as ChildNode).remove();
					}
				}

				unsub();

				// Limpieza final entre anchors
				for (let node = start.nextSibling; node && node !== end; ) {
					const next = node.nextSibling;
					node.remove();
					node = next;
				}

				start.remove();
				end.remove();
			};
		},
		destroy,
	};
}
