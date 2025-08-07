import {
	Validator,
	type ValidationDetailed,
	type CompiledValidator,
	type ValidatorOptions,
	type InferValidator,
} from '@data/validator';
import { Field } from './field';
import { effect, type ReactiveUnsubscribe } from '@core/reactive';

/**
 * Shape<S>: Representa un objeto cuya estructura define los validadores por clave.
 * Cada clave representa un campo que será validado.
 */
export type Shape<S extends Record<string, CompiledValidator<any>>> = S;

/**
 * FieldsMap<S>: Dado un objeto de validadores (Shape),
 * genera un nuevo objeto con la misma estructura pero cuyos valores son instancias de `Field`,
 * con el tipo de dato inferido desde el validador.
 */
export type FieldsMap<S extends Record<string, CompiledValidator<any>>> = {
	[K in keyof S]: Field<InferValidator<S[K]>>;
};

/**
 * Clase `Form`: representa un formulario con múltiples campos (`Field`)
 * gestionados de forma reactiva y validación centralizada.
 */
export class Form<S extends Record<string, CompiledValidator<any>>> {
	/** Mapa de campos fuertemente tipados según la definición de `shape`. */
	public readonly fields: FieldsMap<S>;

	/**
	 * Lista combinada de errores de validación de todos los campos.
	 * Se mantiene sincronizada automáticamente a través de un efecto reactivo.
	 */
	public errors: ValidationDetailed = [];

	/** Lista de funciones para cancelar efectos reactivos creados. */
	private unsubscribes: ReactiveUnsubscribe[] = [];

	constructor(
		private readonly shape: S,
		initialValues?: Partial<{ [K in keyof S]: InferValidator<S[K]> }>,
	) {
		this.fields = {} as FieldsMap<S>;

		// Inicializar cada campo usando el validador correspondiente.
		for (const k in shape) {
			const key = k as keyof S;
			const validator = shape[key];
			const initial = (initialValues as any)?.[key];

			// Se crea una instancia de Field con nombre, valor inicial, validador y opciones (si se requieren).
			this.fields[key] = new Field<InferValidator<S[typeof key]>>(
				String(key),
				typeof initial === 'undefined' ? (undefined as any) : initial,
				validator,
				// Aquí podrían pasarse opciones como `persistentKey`, `debounce`, etc., si están soportadas por Field.
			) as FieldsMap<S>[typeof key];
		}

		// Crear un efecto reactivo para mantener sincronizados los errores globales.
		this.unsubscribes.push(
			effect(
				// Escuchar los errores de todos los campos.
				Object.values(this.fields).map((f) => f.errors),
				() => {
					// Recalcular la lista combinada de errores.
					this.recomputeErrors();
				},
			),
		);

		// Validación inicial del formulario (sincrónica).
		this.recomputeErrors();
	}

	/**
	 * Método privado para recalcular `this.errors`, combinando los errores de cada campo
	 * y ajustando sus rutas (`path`) para que estén correctamente referenciadas.
	 */
	private recomputeErrors(): void {
		const acc: ValidationDetailed = [];
		for (const key in this.fields) {
			const field = this.fields[key];
			const errs = field.errors(); // Obtener errores actuales (reactivo).

			for (const e of errs) {
				// Si el error tiene un path anidado, se antepone el nombre del campo.
				acc.push({
					path: e.path ? `${key}.${e.path}` : String(key),
					message: e.message,
				});
			}
		}
		this.errors = acc;
	}

	/**
	 * Ejecuta la validación sincrónica sobre todos los campos.
	 * Retorna la lista total de errores.
	 * 
	 * @param options - Opciones de validación como `fastFail`, etc.
	 */
	public validate(options?: ValidatorOptions): ValidationDetailed {
		const acc: ValidationDetailed = [];
		for (const key in this.fields) {
			const f = this.fields[key];
			const res = f.validate(options);
			for (const e of res) {
				acc.push({
					path: e.path ? `${key}.${e.path}` : String(key),
					message: e.message,
				});
			}
		}
		this.errors = acc;
		return acc;
	}

	/**
	 * Devuelve un objeto con los valores actuales de todos los campos.
	 */
	public get values(): { [K in keyof S]: InferValidator<S[K]> } {
		const out: Partial<{ [K in keyof S]: InferValidator<S[K]> }> = {};
		for (const key in this.fields) {
			(out as any)[key] = this.fields[key].value();
		}
		return out as { [K in keyof S]: InferValidator<S[K]> };
	}

	/**
	 * Asigna valores a todos los campos.
	 * 
	 * @param values - Objeto parcial con los valores a setear.
	 * @param opts - Opciones: si validar después de setear (`validate`) y si marcar como tocado (`touch`).
	 */
	public setValues(
		values: Partial<{ [K in keyof S]: InferValidator<S[K]> }>,
		opts: { validate?: boolean; touch?: boolean } = {
			validate: true,
			touch: false,
		},
	) {
		for (const k in values) {
			if (k in this.fields) {
				this.fields[k].set((values as any)[k], {
					validate: opts.validate ?? true,
					touch: opts.touch ?? false,
				});
			}
		}
		if (opts.validate) this.recomputeErrors();
	}

	/**
	 * Parchea el formulario actualizando solo las claves presentes en el objeto `patch`.
	 * 
	 * @param patch - Objeto con claves y valores a actualizar parcialmente.
	 * @param opts - Opciones de validación y marcado como tocado.
	 */
	public patch(
		patch: Partial<{ [K in keyof S]: InferValidator<S[K]> }>,
		opts: { validate?: boolean; touch?: boolean } = {
			validate: true,
			touch: true,
		},
	) {
		this.setValues(patch, opts);
	}

	/**
	 * Devuelve un objeto con los errores actuales por campo.
	 */
	public getErrorsByField(): { [K in keyof S]?: ValidationDetailed } {
		const out: Partial<{ [K in keyof S]: ValidationDetailed }> = {};
		for (const k in this.fields) {
			out[k] = this.fields[k].errors();
		}
		return out as { [K in keyof S]?: ValidationDetailed };
	}

	/**
	 * Marca todos los campos como "tocados" (`touched`), útil para disparar validaciones visuales.
	 */
	public touchAll(): void {
		for (const k in this.fields) this.fields[k].touch();
	}

	/**
	 * Resetea todos los campos al valor inicial o a nuevos valores si se especifican.
	 * 
	 * @param newInitialValues - Nuevos valores iniciales por campo (opcional).
	 */
	public reset(
		newInitialValues?: Partial<{ [K in keyof S]: InferValidator<S[K]> }>,
	): void {
		for (const k in this.fields) {
			const f = this.fields[k];
			if (newInitialValues && k in newInitialValues) {
				f.reset((newInitialValues as any)[k]);
			} else {
				f.reset();
			}
		}
		this.recomputeErrors();
	}

	/**
	 * Verifica si el formulario es válido (sin errores).
	 */
	public isValid(): boolean {
		return this.errors.length === 0;
	}

	/**
	 * Verifica si el formulario es inválido (tiene al menos un error).
	 */
	public isInvalid(): boolean {
		return !this.isValid();
	}

	/**
	 * Devuelve un campo del formulario por su clave.
	 * 
	 * @param key - Clave del campo a obtener.
	 */
	public get<K extends keyof S>(key: K): Field<InferValidator<S[K]>> {
		return this.fields[key];
	}

	/**
	 * Destruye la instancia del formulario:
	 * - Cancela efectos reactivos creados.
	 * - Llama a `destroy()` en cada campo individual.
	 */
	public destroy(): void {
		for (const unsub of this.unsubscribes) {
			try {
				unsub();
			} catch {}
		}
		this.unsubscribes = [];

		for (const k in this.fields) {
			try {
				this.fields[k].destroy();
			} catch {}
		}
	}
}

/**
 * Helper para crear una instancia de `Form`.
 * 
 * @param shape - Objeto de validadores por campo.
 * @param initialValues - Valores iniciales opcionales para los campos.
 * @returns Instancia de `Form` tipada.
 */
export function createForm<S extends Record<string, CompiledValidator<any>>>(
	shape: Shape<S>,
	initialValues?: Partial<{ [K in keyof S]: InferValidator<S[K]> }>,
): Form<S> {
	return new Form(shape, initialValues);
}
