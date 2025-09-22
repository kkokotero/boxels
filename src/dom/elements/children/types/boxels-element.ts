import type { BoxelsElement } from '@dom/elements/types';
import type { handlerChild } from '../type';

export function handleBoxelsElement(
	child: BoxelsElement,
): handlerChild<BoxelsElement> {
	let cleanUp: (() => void) = () => {};

	return {
		child: [child],
		mount: () => {
			const cleanup = child.mountEffect();
			if (typeof cleanup === 'function') cleanUp = cleanup;
		},
		destroy: cleanUp
	};
}
