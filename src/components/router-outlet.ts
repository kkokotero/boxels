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

type RouterOutletProps = {
	config: RouterConfig;
	afterChange?: (url: string) => void;
	beforeChange?: (url: string) => void;
};

export const RouterOutlet = async ({
	config,
	afterChange,
	beforeChange,
}: RouterOutletProps) => {
	setGlobalRouter(config);

	interceptLinks();
	attachBrowserEvents();

	const view = signal<JSX.Element>($('div', {}));

	await router.ready;
	const update = async (node: FindResult) => {
		if (node.component) {
			view.set(await node.component());
		}

		if (node.redirect) {
			router.navigate(node.redirect);
			return;
		}

		if (!node.handler && !node.message) {
			if (router.routerConfig.onNotFound)
				view.set(await router.routerConfig.onNotFound());
			else view.set($('pre', {}, '404 - Ruta no encontrada: ', router.url!()));
			return;
		}

		if (node.message) {
			if (router.routerConfig.onError)
				view.set(await router.routerConfig.onError({ msg: node.message }));
			else
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

		beforeChange?.(router.url!());
		view.set(component);
		afterChange?.(router.url!());
	};

	const unsubscribe = router.actualRoute.subscribe(update);

	return Fragment({
		'$lifecycle:destroy': () => {
			view.destroy();
			unsubscribe();
		},
		children: view,
	});
};
