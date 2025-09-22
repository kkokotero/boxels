import { normalizeChildren } from '..';
import type { handlerChild } from '../type';
import { handleNormalizedChild } from './normalized-child';

export function handleListElement(
    child: any[],
): handlerChild<Node> {
    return handleNormalizedChild(normalizeChildren(child));
}
