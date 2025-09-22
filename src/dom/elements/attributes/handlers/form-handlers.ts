// Importa los handlers personalizados registrados globalmente
import { addCustomHandlers } from './global-handlers';
// Importa los tipos para el formulario y campos del formulario
import type { Form, Field } from '@core/client/forms';

// Extiende la interfaz global de atributos de elementos personalizados para Boxels
declare global {
	interface BoxelsElementExtendedAttributes {
		form: {
			// Permite usar $form:group en formularios para asociarlos a un objeto Form
			'$form:group'?: Form<any>;
		};
		input: {
			// Permite usar $form:input en inputs para asociarlos a un campo del formulario
			'$form:input'?: Field<any>;
		};
		select: {
			// Lo mismo para select
			'$form:input'?: Field<any>;
		};
		textarea: {
			// Lo mismo para textarea
			'$form:input'?: Field<any>;
		};
	}
}

// Handler personalizado para el atributo $form:group en formularios
addCustomHandlers('form', {
	'$form:group': (element: HTMLFormElement, form: Form<any>) => {
		// Función que se ejecuta al enviar el formulario
		const onSubmit = (event: SubmitEvent) => {
			event.preventDefault(); // Previene la recarga de página
			form.touchAll(); // Marca todos los campos como tocados
			const isValid = form.validate(); // Ejecuta la validación del formulario

			if (isValid) {
				// Si el formulario es válido, dispara un evento personalizado con los valores
				element.dispatchEvent(
					new CustomEvent('form:submit', {
						detail: {
							values: form.values, // Valores actuales del formulario
							form, // Referencia al formulario
						},
					}),
				);
			} else {
				// Si es inválido, dispara un evento con los errores
				element.dispatchEvent(
					new CustomEvent('form:invalid', {
						detail: {
							errors: form.errors, // Errores actuales del formulario
							form,
						},
					}),
				);
			}
		};

		// Función que se ejecuta al hacer reset del formulario
		const onReset = (event: Event) => {
			event.preventDefault(); // Previene el comportamiento por defecto
			form.reset(); // Reinicia el formulario
			element.dispatchEvent(new CustomEvent('form:reset', { detail: form }));
		};

		// Asigna los listeners al elemento form
		element.addEventListener('submit', onSubmit);
		element.addEventListener('reset', onReset);

		// Si el formulario es válido inicialmente, se emite el evento
		if (form.isValid()) {
			element.dispatchEvent(new CustomEvent('form:valid', { detail: form }));
		}

		// Devuelve una función de limpieza para remover los listeners
		return () => {
			element.removeEventListener('submit', onSubmit);
			element.removeEventListener('reset', onReset);
		};
	},
});

/**
 * Función que enlaza un campo del formulario (FormField) con un elemento HTML.
 * Sincroniza los valores, estado de validación y eventos de interacción.
 */
function bindFormField(
	element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
	field: Field<any>,
) {
	// Identifica si el input es checkbox
	const isCheckbox =
		element instanceof HTMLInputElement && element.type === 'checkbox';
	// Identifica si el input es radio
	const isRadio =
		element instanceof HTMLInputElement && element.type === 'radio';
	// Identifica si es un select
	const isSelect = element instanceof HTMLSelectElement;

	// Establece atributos comunes del input
	element.setAttribute('name', field.name);
	element.setAttribute('autocomplete', 'off');

	// Actualiza el valor del campo a partir del valor del input
	const updateFieldValue = () => {
		if (isCheckbox) {
			// Checkbox se basa en el estado checked
			field.set((element as HTMLInputElement).checked);
		} else if (isRadio) {
			// Radio solo cambia el valor si está checked
			if ((element as HTMLInputElement).checked) {
				field.set(element.value);
			}
		} else {
			field.set(element.value);
		}
	};

	// Actualiza el input a partir del valor del campo
	const updateElement = (value: any) => {
		if (isCheckbox) {
			(element as HTMLInputElement).checked = !!value;
		} else if (isRadio) {
			(element as HTMLInputElement).checked = element.value === value;
		} else if (isSelect) {
			if ((element as HTMLSelectElement).multiple) {
				// Soporte para select múltiple
				const options = (element as HTMLSelectElement).options;
				const values = Array.isArray(value) ? value : [value];
				for (let i = 0; i < options.length; i++) {
					options[i].selected = values.includes(options[i].value);
				}
			} else {
				element.value = value ?? '';
			}
		} else {
			element.value = value ?? '';
		}
	};

	// Evento input: actualiza valor y valida si ya ha sido tocado
	const onInput = () => {
		updateFieldValue();
		if (field.touched()) {
			field.validate();
		}
	};

	// Evento change: marca como tocado y valida
	const onChange = () => {
		field.touch();
		field.validate();
	};

	// Evento blur: marca como tocado si no lo estaba y valida
	const onBlur = () => {
		if (!field.touched()) {
			field.touch();
		}
		field.validate();
	};

	// Suscribe a cambios del campo para mantener el input actualizado
	const unsubscribe = field.value.subscribe(updateElement);

	// Agrega listeners de eventos al elemento
	if (isRadio) {
		element.addEventListener('change', onInput);
	} else {
		element.addEventListener('input', onInput);
	}
	element.addEventListener('change', onChange);
	element.addEventListener('blur', onBlur);

	// Sincroniza valor inicial
	updateElement(field.value);

	// Devuelve función para limpiar todos los listeners
	return () => {
		unsubscribe();
		if (isRadio) {
			element.removeEventListener('change', onInput);
		} else {
			element.removeEventListener('input', onInput);
		}
		element.removeEventListener('change', onChange);
		element.removeEventListener('blur', onBlur);
	};
}

// Handler genérico para input, select y textarea que enlaza campos del formulario
const fieldHandler = (
	element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
	field: Field<any>,
) => bindFormField(element, field);

// Registra el handler para los elementos input, select y textarea
addCustomHandlers('input', { '$form:input': fieldHandler });
addCustomHandlers('select', { '$form:input': fieldHandler });
addCustomHandlers('textarea', { '$form:input': fieldHandler });
