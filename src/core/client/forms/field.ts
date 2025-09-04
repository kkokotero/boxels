import type {
	CompiledValidator,
	ValidationDetailed,
	ValidatorOptions,
} from '@data/validator';
import {
	signal,
	effect,
	persistentSignal,
	type ReactiveSignal,
	computed,
	type ReactiveUnsubscribe,
	type Widen,
	type Signal,
} from '@core/reactive';

/**
 * Opciones específicas que se pueden aplicar a un campo (`Field`)
 */
export type FieldOptions = {
	/** 
	 * Si se debe utilizar validación en modo fastFail por defecto (detenerse en el primer error). 
	 * Depende de si el validador lo soporta.
	 */
	fastFail?: boolean;

	/** 
	 * Tiempo en milisegundos para aplicar un "debounce" a la validación reactiva.
	 * Es decir, cuánto esperar antes de validar al cambiar el valor. 
	 * 0 significa sin debounce (validar de inmediato).
	 */
	debounceMs?: number;

	/**
	 * Clave para persistencia del valor del campo.
	 * Si se proporciona, el valor del campo se almacenará localmente (ej: localStorage) y se mantendrá entre recargas.
	 */
	persistentKey?: string;
};

/**
 * Clase que representa un campo (`Field`) con valor reactivo, validación, errores, estado de interacción ("tocado") y persistencia opcional.
 * Permite validar automáticamente al cambiar su valor, con debounce, fastFail y otras configuraciones.
 */
export class Field<T> {
	// Señal reactiva para el valor del campo
	public readonly value: ReactiveSignal<T>;

	// Señal reactiva que contiene los errores actuales
	public readonly errors: ReactiveSignal<ValidationDetailed>;

	// Señal reactiva que indica si hay errores (true si hay al menos uno)
	public readonly hasErrors: ReactiveSignal<boolean>;

	// Señal reactiva que indica si el campo fue "tocado" (el usuario interactuó con él)
	public readonly touched: ReactiveSignal<boolean>;

	// Valor inicial guardado para poder hacer reset
	private initialValue: Widen<T>;

	// Lista de funciones para cancelar efectos reactivos al destruir el campo
	private cleanUps: ReactiveUnsubscribe[] = [];

	// Timer para aplicar debounce a la validación
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Opciones del campo, completadas con valores por defecto
	private opts: Required<FieldOptions>;

	/**
	 * Constructor de la clase Field.
	 *
	 * @param name - Nombre identificador del campo (útil para errores, logs, etc.)
	 * @param initialValue - Valor inicial del campo
	 * @param validateFn - Función validadora compilada (externa, validación sincrónica)
	 * @param options - Opciones adicionales como debounce, persistencia o fastFail
	 */
	constructor(
		public readonly name: string,
		initialValue: Widen<T>,
		private validateFn: CompiledValidator<T>,
		options: FieldOptions = {},
	) {
		this.initialValue = initialValue;
		this.opts = {
			fastFail: options.fastFail ?? true,
			debounceMs: options.debounceMs ?? 0,
			persistentKey: options.persistentKey ?? '',
		};

		// Crear señal reactiva del valor, persistente si se indica una clave
		this.value = this.opts.persistentKey
			? (persistentSignal<T>(
					this.opts.persistentKey,
					initialValue,
				) as Signal<T>)
			: signal(initialValue) as any;

		// Validar inmediatamente el valor inicial y guardar errores
		const initialErrors = this.validateFn.validateDetailed(initialValue, {
			fastFail: this.opts.fastFail,
		});
		this.errors = signal(initialErrors);

		// Computado reactivo que indica si hay errores
		this.hasErrors = computed([this.errors], () => this.errors().length > 0);

		// Señal para saber si el campo ha sido tocado
		this.touched = signal(false);

		// Efecto reactivo que escucha cambios en el valor y dispara validación (con debounce si aplica)
		this.cleanUps.push(
			effect([this.value], () => {
				const newVal = this.value();

				// Si hay debounce, esperar antes de validar
				if (this.opts.debounceMs > 0) {
					if (this.debounceTimer) clearTimeout(this.debounceTimer);
					this.debounceTimer = setTimeout(() => {
						this.doValidate(newVal, { fastFail: this.opts.fastFail });
						this.debounceTimer = null;
					}, this.opts.debounceMs);
				} else {
					// Validar inmediatamente
					this.doValidate(newVal, { fastFail: this.opts.fastFail });
				}
			}),
		);
	}

	/* ---------------------------
	 * Getters convenientes
	 * --------------------------- */

	/** 
	 * Devuelve true si el campo es válido (sin errores) 
	 */
	get isValid(): boolean {
		return !this.hasErrors();
	}

	/** 
	 * Devuelve true si el campo tiene errores 
	 */
	get isInvalid(): boolean {
		return this.hasErrors();
	}

	/* ---------------------------
	 * Operaciones públicas
	 * --------------------------- */

	/**
	 * Establece un nuevo valor para el campo.
	 * Puede marcar el campo como tocado y/o disparar validación inmediata.
	 *
	 * @param value - Nuevo valor a asignar
	 * @param opts - Opciones para marcar como tocado (`touch`) y validar (`validate`)
	 */
	public set(
		value: T,
		opts: { touch?: boolean; validate?: boolean } = {
			touch: true,
			validate: true,
		},
	): void {
		const prev = this.value();
		// Si el valor no cambia, se evita trabajo innecesario
		if (Object.is(prev, value)) {
			if (opts.touch) this.touched.set(true);
			if (opts.validate)
				this.doValidate(value, { fastFail: this.opts.fastFail });
			return;
		}

		this.value.set(value);

		if (opts.touch) this.touched.set(true);

		if (opts.validate && this.opts.debounceMs === 0) {
			this.doValidate(value, { fastFail: this.opts.fastFail });
		}
	}

	/**
	 * Establece un valor nuevo sin marcar como tocado ni validar.
	 * Útil para inicializaciones internas.
	 *
	 * @param value - Valor a asignar
	 */
	public setSilent(value: T): void {
		this.value.set(value);
	}

	/**
	 * Ejecuta la validación y actualiza los errores.
	 *
	 * @param options - Opciones para la validación (ej: fastFail)
	 * @returns Lista de errores detallados
	 */
	public validate(
		options: ValidatorOptions = { fastFail: this.opts.fastFail },
	): ValidationDetailed {
		const res = this.validateFn.validateDetailed(this.value(), options);
		this.errors.set(res);
		return res;
	}

	/**
	 * Método interno que realiza la validación sobre un valor dado.
	 * Se utiliza dentro de efectos o debounce.
	 *
	 * @param value - Valor a validar
	 * @param options - Opciones del validador
	 * @returns Lista de errores detallados
	 */
	private doValidate(
		value: T,
		options: ValidatorOptions = { fastFail: this.opts.fastFail },
	): ValidationDetailed {
		const res = this.validateFn.validateDetailed(value, options);
		this.errors.set(res);
		return res;
	}

	/**
	 * Alias de `validate` para forzar validación inmediata del valor actual.
	 */
	public verify(): void {
		this.validate({ fastFail: this.opts.fastFail });
	}

	/**
	 * Elimina los errores actuales sin volver a validar.
	 */
	public clearErrors(): void {
		this.errors.set([]);
	}

	/**
	 * Restaura el campo a su estado inicial (o a un nuevo valor opcional).
	 * Limpia errores y el estado de "tocado", y ejecuta validación inmediata.
	 *
	 * @param newInitial - Nuevo valor inicial opcional para reemplazar el anterior
	 */
	public reset(newInitial?: Widen<T>): void {
		if (typeof newInitial !== 'undefined') {
			this.initialValue = newInitial;
			this.value.set(newInitial);
		} else {
			this.value.set(this.initialValue);
		}
		this.touched.set(false);
		this.clearErrors();
		this.doValidate(this.value(), { fastFail: this.opts.fastFail });
	}

	/**
	 * Marca el campo como "tocado".
	 */
	public touch(): void {
		this.touched.set(true);
	}

	/**
	 * Limpia todos los efectos reactivos y señales asociadas al campo.
	 * Debe llamarse cuando el campo ya no se va a usar (limpieza de memoria).
	 */
	public destroy(): void {
		// Limpiar temporizador de debounce
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}

		// Cancelar efectos reactivos
		for (const fn of this.cleanUps) {
			try {
				fn();
			} catch {
				/* ignorar errores */
			}
		}
		this.cleanUps = [];

		// Destruir señales (si el sistema lo requiere)
		try {
			this.errors.destroy?.();
		} catch {}
		try {
			this.value.destroy?.();
		} catch {}
		try {
			this.touched.destroy?.();
		} catch {}
		try {
			this.hasErrors.destroy?.();
		} catch {}
	}
}

/**
 * Función de ayuda para crear una instancia de `Field` con tipado completo.
 *
 * @param name - Nombre identificador del campo
 * @param initialValue - Valor inicial
 * @param validator - Validador compilado a usar
 * @param options - Opciones adicionales como debounce, persistencia, fastFail
 * @returns Instancia de `Field<T>`
 */
export function createField<T>(
	name: string,
	initialValue: Widen<T>,
	validator: CompiledValidator<T>,
	options?: FieldOptions,
): Field<T> {
	return new Field<T>(name, initialValue, validator, options);
}
