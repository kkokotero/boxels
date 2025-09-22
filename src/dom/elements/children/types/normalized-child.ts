import type { BoxlesChildren } from '@dom/elements/types';
import type { handlerChild } from '../type';

export function handleNormalizedChild(
	child: BoxlesChildren,
): handlerChild<Node> {
	return {
		child: child.nodes,
		mount: child.onMount,
		destroy: child.cleanup,
	};
}
