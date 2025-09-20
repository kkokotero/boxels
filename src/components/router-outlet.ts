import {
	signal,
	type MaybeSignal,
	type ReactiveUnsubscribe,
} from '@core/reactive';
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
import { queue } from '@core/scheduler';

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

	let meta: Record<string, MaybeSignal<string>> = {};

	await router.ready;
	const update = async (node: FindResult) => {
		queue(async () => {
			for (const [attr, value] of Object.entries(meta)) {
				const metaTag = document.querySelector(`meta[${attr}]`);
				if (metaTag) metaTag.remove();
			}

			meta = node.meta || {};

			for (const [attr, value] of Object.entries(meta)) {
				const metaTag = document.createElement('meta');
				metaTag.setAttribute(attr, value);
				document.head.appendChild(metaTag);
			}
		});

		beforeChange?.(router.url!());

		if (node.component) {
			view.set(await node.component(), true);
			return;
		}

		if (node.message) {
			if (router.routerConfig.onError)
				view.set(await router.routerConfig.onError({ msg: node.message }));
			else
				view.set(
					$('pre', {}, '403 - Prohibido: ', router.url!(), '\n', node.message),
					true,
				);
			return;
		}

		if (node.redirect) {
			router.navigate(node.redirect);
			return;
		}

		if (!node.handler && !node.message) {
			if (router.routerConfig.onNotFound)
				view.set(await router.routerConfig.onNotFound());
			else
				view.set(
					$('pre', {}, '404 - Ruta no encontrada: ', router.url!()),
					true,
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
				true,
			);
			return;
		}

		const component =
			typeof node.handler?.component === 'function'
				? await node.handler?.component()
				: node.handler?.component;

		view.set(component, true);
		afterChange?.(router.url!());
	};

	router.actualRoute.subscribe(update);

	return $('fragment' as 'div', {}, view);
};
