import type { handlerChild } from '../type';
import { createComment } from '@dom/utils/element';
import { debug } from '@testing/debugger';
import { normalizeChildren } from '..';

export function handlePromiseElement(
	child: Promise<any>,
): handlerChild<Comment> {
	const placeholder = createComment(
		debug.isShowCommentNames() ? 'promise:placeholder' : '',
	);

	let cleanUp = () => {};

	let cancelled = false;

	return {
		child: [placeholder],
		mount: () => {
			child.then((resolved) => {
				if (cancelled) return;
				const normalized = normalizeChildren(resolved);
				placeholder.replaceWith(...normalized.nodes);

				normalized.onMount();

				cleanUp = normalized.cleanup;
			});
		},
		destroy: () => {
			cancelled = true;
			cleanUp();
		},
	};
}
