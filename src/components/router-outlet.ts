import { signal } from '@core/reactive';
import {
	router,
	setGlobalRouter,
	interceptLinks,
	attachBrowserEvents,
	type RouterConfig,
	type FindResult,
} from '@core/routing';
import { $ } from '@dom/index';
import { Fragment } from './fragment';

export const RouterOutlet = async ({ config }: { config: RouterConfig }) => {
	setGlobalRouter(config);

	interceptLinks();
	attachBrowserEvents();

	const view = signal($('div', {}));

	await router.ready;
	const update = async (node: FindResult) => {
		if (node.redirect) {
			router.navigate(node.redirect);
		}

		if (!node.handler && !node.message) {
			view.set($('pre', {}, '404 - Ruta no encontrada: ', router.url!()));
			return;
		}

		if (node.message) {
			view.set(
				$('pre', {}, '403 - Prohibido: ', router.url!(), '\n', node.message),
			);
			return;
		}

		if (!node.handler?.component) {
			view.set(
				$(
					'pre',
					{},
					'Error: ',
					router.url!(),
					'\nNo hay un componente en esta ruta',
				),
			);
			return;
		}

		const component =
			typeof node.handler?.component === 'function'
				? await node.handler?.component()
				: node.handler?.component;

		view.set(component);
	};

	const unsubscribe = router.actualRoute.subscribe(update);

	return Fragment({
		'$lifecycle:destroy': () => {
			view.destroy();
			unsubscribe();
		},
		children: view,
	});
}
