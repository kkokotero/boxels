import type { handlerChild } from '../type';
import { handleNormalizedChild } from './normalized-child';
import { normalizeChildren } from '..';

export function handleDocumentFragment(
	child: DocumentFragment,
): handlerChild<Node> {
	return handleNormalizedChild(
		normalizeChildren(Array.from(child.cloneNode(true).childNodes)),
	);
}
