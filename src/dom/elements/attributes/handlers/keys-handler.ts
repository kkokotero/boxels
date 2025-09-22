import { type ComboKey, page } from '@core/page';
import { addGlobalHandler } from './global-handlers';

const ElementKeyMap: Map<string, ComboKey[][]> = new Map();
const comboAttrName = 'combo-keys-name';

/**
 * Registra combinaciones en un elemento
 * Ej: $combo-keys={["ctrl","s"]}
 *     $combo-keys={[["ctrl","s"],["ctrl","p"]]}
 */
addGlobalHandler('$combo-keys', (el, handler: ComboKey[] | ComboKey[][]) => {
	if (!el.hasAttribute(comboAttrName)) {
		el.setAttribute(comboAttrName, `combo-${crypto.randomUUID()}`);
	}

	const name = el.getAttribute(comboAttrName)!;

	// Normalizamos: siempre será ComboKey[][]
	const combos = Array.isArray(handler[0])
		? (handler as ComboKey[][])
		: [handler as ComboKey[]];

	ElementKeyMap.set(name, combos);

	return () => {
		ElementKeyMap.delete(name);
	};
});

/**
 * Escucha las combinaciones registradas en un elemento
 */
addGlobalHandler('$on:combo-key', (el, handler: (keys: ComboKey[]) => void) => {
	if (!el.hasAttribute(comboAttrName)) {
		el.setAttribute(comboAttrName, `combo-${crypto.randomUUID()}`);
	}

	const name = el.getAttribute(comboAttrName)!;
	const combos = ElementKeyMap.get(name);

	if (!combos) {
		console.warn('No existe un registro de $combo-keys para este elemento');
		return () => {};
	}

	// Registrar listeners para cada combo
	const disposers = combos.map((combo) =>
		page.onKeyCombo(el, combo, (ev) => {
			handler(combo); // 👈 ahora pasamos el ComboKey[] exacto
		}),
	);

	// Cleanup
	return () => disposers.forEach((dispose) => dispose());
});
