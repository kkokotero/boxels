import type { handlerChild } from '../type';
import { handleNormalizedChild } from './normalized-child';
import { normalizeChildren } from '..';

export function handleFunctionElement(
	child: () => any | Promise<any>,
): handlerChild<Node> {
	return handleNormalizedChild(normalizeChildren(child()));
}
