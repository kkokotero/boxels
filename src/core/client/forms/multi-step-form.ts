import type {
	CompiledValidator,
	ValidationDetailed,
	ValidatorOptions,
	InferValidator,
} from '@data/validator';
import { Form } from './form'; // Importa la clase Form refactorizada

/** --- Tipos auxiliares -------------------------------------------------- */

/**
 * StepSchemas:
 * Tipo que representa un conjunto de esquemas (shapes) por cada paso del formulario.
 * Cada paso es un objeto donde las claves son nombres de campos y los valores son validadores compilados.
 * Ejemplo:
 * {
 *   personal: { name: Validator.string(), age: Validator.number() },
 *   terms: { accepted: Validator.boolean() }
 * }
 */
export type StepSchemas<
	S extends Record<string, Record<string, CompiledValidator<any>>>,
> = S;

/**
 * StepFormsMap:
 * Dado un conjunto de esquemas por paso, genera un mapa con una instancia de Form por cada paso,
 * usando el tipo inferido del validador.
 */
export type StepFormsMap<
	S extends Record<string, Record<string, CompiledValidator<any>>>,
> = {
	[K in keyof S]: Form<S[K]>;
};

/**
 * InitialValuesByStep:
 * Estructura que permite definir valores iniciales (opcionales) por cada paso y campo.
 * Útil para precargar el formulario con datos.
 */
export type InitialValuesByStep<
	S extends Record<string, Record<string, CompiledValidator<any>>>,
> = {
	[K in keyof S]?: Partial<{ [F in keyof S[K]]: InferValidator<S[K][F]> }>;
};

/**
 * MultiStepFormOptions:
 * Opciones de configuración para la instancia de MultiStepForm.
 */
export interface MultiStepFormOptions<S extends Record<string, any>> {
	/** Orden explícito de los pasos. Si no se indica, se usa Object.keys(schemas) */
	order?: (keyof S)[];
	/** Si es true, impide avanzar al siguiente paso si el paso actual no es válido (default: true) */
	strictNavigation?: boolean;
	/** Hook que se llama cuando cambia el paso activo */
	onStepChange?: (from: keyof S, to: keyof S) => void;
}

/** --- Clase principal -------------------------------------------------- */

/**
 * MultiStepForm:
 * Clase principal que gestiona un formulario dividido en múltiples pasos, cada uno con su propia validación y estado.
 */
export class MultiStepForm<
	S extends Record<string, Record<string, CompiledValidator<any>>>,
> {
	/** Mapa con una instancia de Form por cada paso */
	public readonly stepForms: StepFormsMap<S>;

	/** Orden de las claves de los pasos */
	public readonly stepKeys: (keyof S)[];

	/** Índice actual del paso activo */
	private currentIndex = 0;

	/** Opciones procesadas con valores por defecto */
	private readonly options: Required<
		Pick<MultiStepFormOptions<S>, 'strictNavigation' | 'onStepChange'>
	> & { order?: (keyof S)[] };

	/**
	 * Constructor de la clase
	 * @param schemas - Estructura con los validadores por paso
	 * @param initialValues - Valores iniciales opcionales por paso
	 * @param opts - Opciones adicionales
	 */
	constructor(
		private readonly schemas: S,
		initialValues?: InitialValuesByStep<S>,
		opts?: MultiStepFormOptions<S>,
	) {
		// Determina el orden de los pasos
		this.stepKeys = (opts?.order ??
			(Object.keys(schemas) as (keyof S)[])) as (keyof S)[];

		// Aplica opciones con valores por defecto
		this.options = {
			strictNavigation: opts?.strictNavigation ?? true,
			onStepChange: opts?.onStepChange ?? (() => undefined),
			order: opts?.order,
		};

		// Crea una instancia de Form para cada paso
		this.stepForms = {} as StepFormsMap<S>;
		for (const key of this.stepKeys) {
			const shape = schemas[key];
			const iv = initialValues?.[key];
			this.stepForms[key] = new Form(
				shape,
				iv as any,
			) as StepFormsMap<S>[typeof key];
		}
	}

	/* -------------------------
	 * Lectura de estado
	 * ------------------------- */

	/** Retorna el índice del paso actual */
	public get index(): number {
		return this.currentIndex;
	}

	/** Retorna la clave del paso activo */
	public get activeStep(): keyof S {
		return this.stepKeys[this.currentIndex];
	}

	/** Retorna el número total de pasos */
	public get totalSteps(): number {
		return this.stepKeys.length;
	}

	/* -------------------------
	 * Navegación segura
	 * ------------------------- */

	/**
	 * Avanza al siguiente paso si es posible.
	 * Si `strictNavigation` está activado, valida el paso actual antes de continuar.
	 * @returns true si se cambió de paso, false si no se pudo avanzar.
	 */
	public next(options?: ValidatorOptions): boolean {
		const currentKey = this.activeStep;

		if (this.options.strictNavigation) {
			const errors = this.stepForms[currentKey].validate(options);
			if (errors.length > 0) return false;
		}

		if (this.currentIndex < this.stepKeys.length - 1) {
			const from = this.activeStep;
			this.currentIndex++;
			const to = this.activeStep;
			this.options.onStepChange(from, to);
			return true;
		}
		return false; // Ya en el último paso
	}

	/**
	 * Retrocede al paso anterior si es posible.
	 * Siempre permite retroceder, sin validación.
	 */
	public prev(): boolean {
		if (this.currentIndex > 0) {
			const from = this.activeStep;
			this.currentIndex--;
			const to = this.activeStep;
			this.options.onStepChange(from, to);
			return true;
		}
		return false;
	}

	/**
	 * Cambia al paso indicado por su clave.
	 * Puede validar el paso actual o todos los pasos intermedios si se indica.
	 * @param stepKey - Clave del paso al que se desea ir
	 * @param args - Configuraciones de validación adicionales
	 * @returns true si el cambio fue exitoso, false si fue bloqueado por errores
	 */
	public go(
		stepKey: keyof S,
		args?: {
			requireIntermediateValid?: boolean;
			skipCurrentValidation?: boolean;
		},
		options?: ValidatorOptions,
	): boolean {
		const idx = this.stepKeys.indexOf(stepKey);
		if (idx < 0) return false;

		const fromIdx = this.currentIndex;
		const toIdx = idx;

		// Validación si se navega hacia adelante y strictNavigation está activado
		if (toIdx > fromIdx && this.options.strictNavigation) {
			if (!args?.skipCurrentValidation) {
				const currentKey = this.activeStep;
				const curErr = this.stepForms[currentKey].validate(options);
				if (curErr.length > 0) return false;
			}

			if (args?.requireIntermediateValid) {
				for (let i = fromIdx; i < toIdx; i++) {
					const k = this.stepKeys[i];
					const res = this.stepForms[k].validate(options);
					if (res.length > 0) return false;
				}
			}
		}

		const from = this.activeStep;
		this.currentIndex = idx;
		const to = this.activeStep;
		this.options.onStepChange(from, to);
		return true;
	}

	/* -------------------------
	 * Validación
	 * ------------------------- */

	/**
	 * Valida un paso específico y actualiza sus errores.
	 * @returns Lista de errores encontrados
	 */
	public validateStep(
		stepKey: keyof S,
		options?: ValidatorOptions,
	): ValidationDetailed {
		const form = this.stepForms[stepKey];
		if (!form) return [];
		return form.validate(options);
	}

	/**
	 * Valida todos los pasos del formulario.
	 * Retorna errores con el path prefijado con el nombre del paso.
	 */
	public validateAll(options?: ValidatorOptions): ValidationDetailed {
		let acc: ValidationDetailed = [];
		for (const k of this.stepKeys) {
			const res = this.stepForms[k].validate(options);
			acc.push(
				...res.map((e) => ({
					path: `${String(k)}.${e.path ?? ''}`.replace(/\.$/, ''),
					message: e.message,
				})),
			);
		}
		return acc;
	}

	/* -------------------------
	 * Chequeos rápidos
	 * ------------------------- */

	/** Retorna true si el paso es válido */
	public isStepValid(stepKey: keyof S): boolean {
		const form = this.stepForms[stepKey];
		return !!form && form.isValid();
	}

	/** Retorna true si el paso es inválido */
	public isStepInvalid(stepKey: keyof S): boolean {
		return !this.isStepValid(stepKey);
	}

	/** Retorna true si todos los pasos son válidos */
	public isAllValid(): boolean {
		for (const k of this.stepKeys) {
			if (!this.stepForms[k].isValid()) return false;
		}
		return true;
	}

	/* -------------------------
	 * Valores y utilidades
	 * ------------------------- */

	/**
	 * Obtiene los valores del paso indicado
	 */
	public valuesOf(stepKey: keyof S): {
		[F in keyof S[typeof stepKey]]?: InferValidator<S[typeof stepKey][F]>;
	} {
		return this.stepForms[stepKey].values as any;
	}

	/**
	 * Retorna todos los valores combinados en un único objeto plano.
	 * En caso de conflicto de claves, gana el paso posterior.
	 */
	public allValues(): Record<string, any> {
		return this.stepKeys.reduce(
			(acc, k) => Object.assign(acc, this.stepForms[k].values),
			{} as Record<string, any>,
		);
	}

	/**
	 * Reinicia un paso a sus valores iniciales (opcionalmente nuevos)
	 */
	public resetStep(
		stepKey: keyof S,
		newInitial?: Partial<{
			[F in keyof S[typeof stepKey]]: InferValidator<S[typeof stepKey][F]>;
		}>,
	): void {
		this.stepForms[stepKey].reset(newInitial as any);
	}

	/**
	 * Reinicia todos los pasos (opcionalmente con nuevos valores iniciales)
	 */
	public resetAll(newInitials?: InitialValuesByStep<S>): void {
		for (const k of this.stepKeys) {
			this.stepForms[k].reset(newInitials?.[k] as any);
		}
	}

	/* -------------------------
	 * Ciclo de vida
	 * ------------------------- */

	/**
	 * Limpieza: destruye todas las instancias de Form asociadas a cada paso.
	 */
	public destroy(): void {
		for (const k of this.stepKeys) this.stepForms[k].destroy();
	}
}

/**
 * createMultiStepForm:
 * Función auxiliar para crear una instancia de MultiStepForm con inferencia de tipos.
 */
export function createMultiStepForm<
	S extends Record<string, Record<string, CompiledValidator<any>>>,
>(
	schemas: StepSchemas<S>,
	initialValues?: InitialValuesByStep<S>,
	options?: MultiStepFormOptions<S>,
): MultiStepForm<S> {
	return new MultiStepForm(schemas, initialValues, options);
}
