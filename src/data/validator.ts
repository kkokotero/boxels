/**
 * Validator — sistema de validación compilado, tipado, con soporte para i18n (internacionalización),
 * fast-fail (terminar al primer error) o gather-all (recolectar todos los errores),
 * y errores con rutas (path) para estructuras anidadas.
 *
 * Principios:
 * - Cada fábrica (Validator.string(), Validator.number(), ...) devuelve una función de validación compilada.
 * - Cada método de validación (min, max, regex, ...) añade reglas a esa función, generando una nueva versión inmutable.
 * - Los validadores pueden devolver errores como simples strings (string[]) o de forma detallada (ErrorItem[]).
 * - Validator.shape(...) infiere el tipo final de salida validada.
 */

// Representa un error estructurado con la ruta del dato y el mensaje
export type ErrorItem = { path: string; message: string };

// Lista simple de mensajes de error
export type ValidationResult = string[];

// Lista estructurada de errores con path
export type ValidationDetailed = ErrorItem[];

// Opciones que se pueden pasar a los validadores
export type ValidatorOptions = {
	fastFail?: boolean; // Si se detiene en el primer error
	locale?: string; // Idioma para mensajes
	messages?: Record<string, string>; // Mensajes personalizados por clave
};

// Mensajes por defecto en español
const DEFAULT_MESSAGES_ES: Record<string, string> = {
	'type:string': 'Se esperaba una cadena, pero se recibió $recived',
	'type:number': 'Se esperaba un número, pero se recibió $recived',
	'type:boolean': 'Se esperaba un valor booleano, pero se recibió $recived',
	'type:array': 'Se esperaba un arreglo, pero se recibió $recived',
	'type:object': 'Se esperaba un objeto, pero se recibió $recived',
	min: 'Se esperaba un mínimo de $expected, pero se recibió $recived',
	max: 'Se esperaba un máximo de $expected, pero se recibió $recived',
	length: 'Se esperaba una longitud de $expected, pero se recibió $recived',
	regex: 'El valor no cumple con el patrón requerido',
	email: 'Formato de correo electrónico no válido',
	url: 'Formato de URL no válido',
	uuid: 'UUID no válido',
	isoDate: 'Fecha ISO no válida',
	creditCard: 'Número de tarjeta de crédito no válido',
	phone: 'Número de teléfono no válido',
	required: 'Este campo es obligatorio',
	oneOf: 'El valor debe ser uno de: $expected',
	integer: 'Se esperaba un número entero',
	positive: 'Se esperaba un número positivo',
	negative: 'Se esperaba un número negativo',
	multipleOf: 'Se esperaba un múltiplo de $expected',
	between: 'Se esperaba un número entre $expected y $recived',
	items: 'Uno o más elementos del arreglo no son válidos',
	minItems:
		'Se esperaba un mínimo de $expected elementos, pero se recibieron $recived',
	maxItems:
		'Se esperaba un máximo de $expected elementos, pero se recibieron $recived',
	shape: 'La validación de la estructura del objeto falló',
	nonEmpty: 'El valor no debe estar vacío',
	trimmed: 'El valor no debe contener espacios al inicio o al final',
	alpha: 'El valor solo debe contener letras',
	alphanum: 'El valor solo debe contener letras y números',
	numeric: 'El valor solo debe contener dígitos',
	startsWith: 'El valor debe comenzar con $expected',
	endsWith: 'El valor debe terminar con $expected',
	contains: 'El valor debe contener $expected',
	minValue: 'El valor debe ser mayor o igual a $expected',
	maxValue: 'El valor debe ser menor o igual a $expected',
	precision: 'El número debe tener como máximo $expected decimales',
	uniqueItems: 'Los elementos deben ser únicos',
	containsItem: 'El arreglo debe contener el valor $expected',
	exactShape: 'El objeto tiene propiedades no permitidas',
};

// Configuración global del sistema de validación
export const ValidatorConfig = {
	locale: 'es', // Idioma por defecto
	messages: { ...DEFAULT_MESSAGES_ES }, // Mensajes por defecto (se pueden sobrescribir)
	defaultOptions: { fastFail: true, locale: 'es' } as ValidatorOptions, // Opciones por defecto
};

// Función utilitaria para interpolar valores en un mensaje de error
function formatMessage(
	template: string,
	ctx: Record<string, any> = {},
): string {
	return template
		.replace(/\$expected/g, String(ctx.expected ?? ''))
		.replace(/\$recived/g, String(ctx.recived ?? ''));
}

// Tipo de función de validación interna por regla
type RuleCheck = (value: any, opts: ValidatorOptions) => ValidationDetailed;

// Estructura de una regla de validación
type Rule = { id: string; check: RuleCheck; msgKey?: string };

// Crea una regla de validación con su identificador, función de chequeo y clave de mensaje
function mkRule(id: string, check: RuleCheck, msgKey?: string): Rule {
	return { id, check, msgKey };
}

/**
 * Tipo principal de validador compilado.
 * Es una función que valida un valor, y contiene métodos encadenables para extender la validación.
 */
export type CompiledValidator<T = any> = ((value: any) => ValidationResult) & {
	// Métodos encadenables para añadir reglas generales
	min: (n: number, msg?: string) => CompiledValidator<T>;
	max: (n: number, msg?: string) => CompiledValidator<T>;
	length: (n: number, msg?: string) => CompiledValidator<T>;
	regex: (r: RegExp, msg?: string) => CompiledValidator<T>;
	required: (msg?: string) => CompiledValidator<T>;
	optional: () => CompiledValidator<T | null | undefined>;
	nullable: () => CompiledValidator<T | null>;
	default: (value: T) => CompiledValidator<T>;
	custom: (
		fn: (v: any) => boolean,
		msg?: string,
		id?: string,
	) => CompiledValidator<T>;
	id: (identifier: string) => CompiledValidator<T>;
	describe: () => string;

	// Números
	integer: (msg?: string) => CompiledValidator<T>;
	positive: (msg?: string) => CompiledValidator<T>;
	negative: (msg?: string) => CompiledValidator<T>;
	between: (a: number, b: number, msg?: string) => CompiledValidator<T>;
	multipleOf: (n: number, msg?: string) => CompiledValidator<T>;
	minValue: (n: number, msg?: string) => CompiledValidator<T>;
	maxValue: (n: number, msg?: string) => CompiledValidator<T>;
	precision: (decimals: number, msg?: string) => CompiledValidator<T>;

	// Arrays
	items: <U>(
		itemV: CompiledValidator<U>,
		msg?: string,
	) => CompiledValidator<U[]>;
	minItems: (n: number, msg?: string) => CompiledValidator<T>;
	maxItems: (n: number, msg?: string) => CompiledValidator<T>;
	uniqueItems: (msg?: string) => CompiledValidator<T>;
	contains: (val: any, msg?: string) => CompiledValidator<T>;

	// Objetos
	shape: <O extends Record<string, CompiledValidator<any>>>(
		shapeObj: O,
		msg?: string,
	) => CompiledValidator<{ [K in keyof O]: InferValidator<O[K]> }>;

	// Strings
	nonEmpty: (msg?: string) => CompiledValidator<T>;
	trimmed: (msg?: string) => CompiledValidator<T>;
	alpha: (msg?: string) => CompiledValidator<T>;
	alphanum: (msg?: string) => CompiledValidator<T>;
	numeric: (msg?: string) => CompiledValidator<T>;
	startsWith: (prefix: string, msg?: string) => CompiledValidator<T>;
	endsWith: (suffix: string, msg?: string) => CompiledValidator<T>;

	// Conjuntos
	oneOf: (vals: readonly any[], msg?: string) => CompiledValidator<T>;

	// Ejecución detallada (devuelve errores con path)
	validateDetailed: (
		value: any,
		options?: ValidatorOptions,
	) => ValidationDetailed;

	type: () => string;
};

// Utilidades para inferir tipos a partir de validadores
export type InferValidator<V> = V extends CompiledValidator<infer T> ? T : any;
export type InferShape<S extends Record<string, any>> = {
	[K in keyof S]: InferValidator<S[K]>;
};

function compile<T>(
	rules: Rule[],
	meta: { id?: string; optional?: boolean } = {},
): CompiledValidator<T> {
	const id = meta.id || 'anon';
	const optional = !!meta.optional;

	const validator = ((value: any): ValidationResult =>
		validator
			.validateDetailed(value, ValidatorConfig.defaultOptions)
			.map((e) => e.message)) as CompiledValidator<T>;

	validator.validateDetailed = (value, options = {}) => {
		const opts = { ...ValidatorConfig.defaultOptions, ...options };
		if (optional && (value == null || value === '')) return [];
		const errors: ValidationDetailed = [];
		for (const rule of rules) {
			const rs = rule.check(value, opts);
			if (rs.length) {
				rs.forEach((r) =>
					errors.push({ path: r.path || '', message: r.message }),
				);
				if (opts.fastFail) break;
			}
		}
		return errors;
	};

	const addRule = (r: Rule) => compile<T>([...rules, r], { id, optional });

	validator.type = () => {
		return id;
	};

	validator.alpha = (m) =>
		addRule(
			mkRule(
				'alpha',
				(v) =>
					typeof v === 'string' && !/^[A-Za-zÁÉÍÓÚáéíóúñÑ]+$/.test(v)
						? [{ path: '', message: m ?? ValidatorConfig.messages.alpha }]
						: [],
				'alpha',
			),
		);

	validator.alphanum = (m) =>
		addRule(
			mkRule(
				'alphanum',
				(v) =>
					typeof v === 'string' && !/^[A-Za-z0-9]+$/.test(v)
						? [{ path: '', message: m ?? ValidatorConfig.messages.alphanum }]
						: [],
				'alphanum',
			),
		);

	validator.numeric = (m) =>
		addRule(
			mkRule(
				'numeric',
				(v) =>
					typeof v === 'string' && !/^\d+$/.test(v)
						? [{ path: '', message: m ?? ValidatorConfig.messages.numeric }]
						: [],
				'numeric',
			),
		);

	validator.startsWith = (prefix: string, m?: string) =>
		addRule(
			mkRule(
				`startsWith:${prefix}`,
				(v) =>
					typeof v !== 'string' || !v.startsWith(prefix)
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.startsWith, {
											expected: prefix,
										}),
								},
							]
						: [],
				'startsWith',
			),
		);

	validator.endsWith = (suffix: string, m?: string) =>
		addRule(
			mkRule(
				`endsWith:${suffix}`,
				(v) =>
					typeof v !== 'string' || !v.endsWith(suffix)
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.endsWith, {
											expected: suffix,
										}),
								},
							]
						: [],
				'endsWith',
			),
		);

	validator.minValue = (n: number, m?: string) =>
		addRule(
			mkRule(
				`minValue:${n}`,
				(v) =>
					typeof v !== 'number' || v < n
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.minValue, {
											expected: n,
										}),
								},
							]
						: [],
				'minValue',
			),
		);

	validator.maxValue = (n: number, m?: string) =>
		addRule(
			mkRule(
				`maxValue:${n}`,
				(v) =>
					typeof v !== 'number' || v > n
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.maxValue, {
											expected: n,
										}),
								},
							]
						: [],
				'maxValue',
			),
		);

	validator.uniqueItems = (m?: string) =>
		addRule(
			mkRule(
				'uniqueItems',
				(v) =>
					!Array.isArray(v) || new Set(v).size !== v.length
						? [{ path: '', message: m ?? ValidatorConfig.messages.uniqueItems }]
						: [],
				'uniqueItems',
			),
		);

	// Métodos base
	validator.min = (n, m) =>
		addRule(
			mkRule(
				`min:${n}`,
				(v, o) => {
					const len =
						typeof v === 'string' || Array.isArray(v) ? (v as any).length : v;
					return len < n
						? [
								{
									path: '',
									message: formatMessage(m ?? ValidatorConfig.messages.min, {
										expected: n,
										recived: len,
									}),
								},
							]
						: [];
				},
				'min',
			),
		);

	validator.max = (n, m) =>
		addRule(
			mkRule(
				`max:${n}`,
				(v, o) => {
					const len =
						typeof v === 'string' || Array.isArray(v) ? (v as any).length : v;
					return len > n
						? [
								{
									path: '',
									message: formatMessage(m ?? ValidatorConfig.messages.max, {
										expected: n,
										recived: len,
									}),
								},
							]
						: [];
				},
				'max',
			),
		);

	// Redefinir length de manera segura
	Object.defineProperty(validator, 'length', {
		configurable: true,
		enumerable: true,
		value: (n: number, m?: string) =>
			addRule(
				mkRule(
					`length:${n}`,
					(v) => {
						const len =
							typeof v === 'string' || Array.isArray(v)
								? (v as any).length
								: undefined;
						return len !== n
							? [
									{
										path: '',
										message: formatMessage(
											m ?? ValidatorConfig.messages.length,
											{ expected: n, recived: len },
										),
									},
								]
							: [];
					},
					'length',
				),
			),
	});

	validator.regex = (r, m) =>
		addRule(
			mkRule(
				`regex:${r}`,
				(v) =>
					typeof v !== 'string' || !r.test(v)
						? [{ path: '', message: m ?? ValidatorConfig.messages.regex }]
						: [],
				'regex',
			),
		);

	validator.required = (m) =>
		addRule(
			mkRule(
				'required',
				(v) =>
					v == null || v === ''
						? [{ path: '', message: m ?? ValidatorConfig.messages.required }]
						: [],
				'required',
			),
		);
	validator.optional = () =>
		compile<T | null | undefined>(rules, { id, optional: true });
	validator.custom = (fn, m, myId) =>
		addRule(
			mkRule(
				myId || 'custom',
				(v) =>
					fn(v) ? [] : [{ path: '', message: m || 'Custom validation failed' }],
				myId,
			),
		);

	// Específicos para números
	validator.integer = (m) =>
		addRule(
			mkRule(
				'integer',
				(v) =>
					typeof v !== 'number' || !Number.isInteger(v)
						? [{ path: '', message: m ?? ValidatorConfig.messages.integer }]
						: [],
				'integer',
			),
		);
	validator.positive = (m) =>
		addRule(
			mkRule(
				'positive',
				(v) =>
					typeof v !== 'number' || v <= 0
						? [{ path: '', message: m ?? ValidatorConfig.messages.positive }]
						: [],
				'positive',
			),
		);
	validator.negative = (m) =>
		addRule(
			mkRule(
				'negative',
				(v) =>
					typeof v !== 'number' || v >= 0
						? [{ path: '', message: m ?? ValidatorConfig.messages.negative }]
						: [],
				'negative',
			),
		);
	validator.between = (a, b, m) =>
		addRule(
			mkRule(
				`between:${a}:${b}`,
				(v) =>
					typeof v !== 'number' || v < a || v > b
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.between, {
											expected: a,
											recived: b,
										}),
								},
							]
						: [],
				'between',
			),
		);
	validator.multipleOf = (n, m) =>
		addRule(
			mkRule(
				`multipleOf:${n}`,
				(v) =>
					typeof v !== 'number' || v % n !== 0
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.multipleOf, {
											expected: n,
										}),
								},
							]
						: [],
				'multipleOf',
			),
		);

	// Array
	validator.items = <U>(itemV: CompiledValidator<U>, m?: any) =>
		addRule(
			mkRule(
				'items',
				(v, o) => {
					if (!Array.isArray(v))
						return [{ path: '', message: m ?? ValidatorConfig.messages.items }];
					const errs: ValidationDetailed = [];
					for (let i = 0; i < v.length; i++) {
						const ne = itemV.validateDetailed
							? itemV.validateDetailed(v[i], o)
							: itemV(v[i]).map((msg) => ({ path: '', message: msg }));
						ne.forEach((e) =>
							errs.push({
								path: `${i}${e.path ? '.' + e.path : ''}`,
								message: e.message,
							}),
						);
						if (o.fastFail && errs.length) break;
					}
					return errs;
				},
				'items',
			),
		) as any;

	validator.minItems = (n, m) =>
		addRule(
			mkRule(
				`minItems:${n}`,
				(v) =>
					!Array.isArray(v) || v.length < n
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.minItems, {
											expected: n,
											recived: Array.isArray(v) ? v.length : typeof v,
										}),
								},
							]
						: [],
				'minItems',
			),
		);
	validator.maxItems = (n, m) =>
		addRule(
			mkRule(
				`maxItems:${n}`,
				(v) =>
					!Array.isArray(v) || v.length > n
						? [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.maxItems, {
											expected: n,
											recived: Array.isArray(v) ? v.length : typeof v,
										}),
								},
							]
						: [],
				'maxItems',
			),
		);

	validator.oneOf = (vals, m) =>
		addRule(
			mkRule(
				'oneOf',
				(v) =>
					vals.includes(v)
						? []
						: [
								{
									path: '',
									message:
										m ??
										formatMessage(ValidatorConfig.messages.oneOf, {
											expected: vals.join(', '),
										}),
								},
							],
				'oneOf',
			),
		);
	validator.shape = <O extends Record<string, CompiledValidator<any>>>(
		shapeObj: O,
		m?: any,
	) =>
		addRule(
			mkRule(
				'shape',
				(v, o) => {
					if (typeof v !== 'object' || v == null || Array.isArray(v))
						return [{ path: '', message: m ?? ValidatorConfig.messages.shape }];
					const errs: ValidationDetailed = [];
					for (const k of Object.keys(shapeObj)) {
						const child = (shapeObj as any)[k] as CompiledValidator<any>;
						const ne = child.validateDetailed
							? child.validateDetailed(v[k], o)
							: child(v[k]).map((msg) => ({ path: '', message: msg }));
						ne.forEach((e) =>
							errs.push({
								path: `${k}${e.path ? '.' + e.path : ''}`,
								message: e.message,
							}),
						);
						if (o.fastFail && errs.length) break;
					}
					return errs;
				},
				'shape',
			),
		) as any;

	// Específicos para strings
	validator.nonEmpty = (m) =>
		addRule(
			mkRule(
				'nonEmpty',
				(v) =>
					typeof v === 'string' && v.length === 0
						? [{ path: '', message: m ?? ValidatorConfig.messages.nonEmpty }]
						: [],
				'nonEmpty',
			),
		);

	validator.trimmed = (m) =>
		addRule(
			mkRule(
				'trimmed',
				(v) =>
					typeof v === 'string' && v !== v.trim()
						? [{ path: '', message: m ?? ValidatorConfig.messages.trimmed }]
						: [],
				'trimmed',
			),
		);

	validator.id = (ident) => compile<T>(rules, { id: ident, optional });
	validator.describe = () =>
		`Validator(${id}) rules: ${rules.map((r) => r.id).join(', ')}`;
	return validator;
}

// Factories
// Regex comunes
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Acepta http/https, localhost, dominios e IPs
const URL_RE =
	/^(https?:\/\/)(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}|\[?[A-F0-9:]+\]?|([\w-]+\.)+[a-z]{2,})(:\d+)?(\/[^\s]*)?$/i;

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const CREDIT_CARD_RE =
	/^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/;

const PHONE_RE = /^[\d+\-().\s]{7,20}$/;

const IPV4_RE =
	/^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

const BASE64_RE =
	/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const POSTAL_CODE_RE = /^[A-Za-z0-9\s\-]{3,10}$/;

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const PASSWORD_STRONG_RE =
	/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>]).{8,}$/;

export const Validator = {
	string: () =>
		compile<string>(
			[
				mkRule(
					'type:string',
					(v) =>
						typeof v !== 'string'
							? [
									{
										path: '',
										message: formatMessage(
											ValidatorConfig.messages['type:string'],
											{ recived: typeof v },
										),
									},
								]
							: [],
					'type:string',
				),
			],
			{ id: 'type:string' },
		),
	number: () =>
		compile<number>(
			[
				mkRule(
					'type:number',
					(v) =>
						typeof v !== 'number' || !Number.isFinite(v)
							? [
									{
										path: '',
										message: formatMessage(
											ValidatorConfig.messages['type:number'],
											{
												recived: Number.isNaN(v) ? 'un valor vacio' : typeof v,
											},
										),
									},
								]
							: [],
					'type:number',
				),
			],
			{ id: 'type:number' },
		),
	boolean: () =>
		compile<boolean>(
			[
				mkRule(
					'type:boolean',
					(v) =>
						typeof v !== 'boolean'
							? [
									{
										path: '',
										message: formatMessage(
											ValidatorConfig.messages['type:boolean'],
											{ recived: typeof v },
										),
									},
								]
							: [],
					'type:boolean',
				),
			],
			{ id: 'type:boolean' },
		),
	array: <T>() =>
		compile<T[]>(
			[
				mkRule(
					'type:array',
					(v) =>
						!Array.isArray(v)
							? [
									{
										path: '',
										message: formatMessage(
											ValidatorConfig.messages['type:array'],
											{ recived: typeof v },
										),
									},
								]
							: [],
					'type:array',
				),
			],
			{ id: 'type:array' },
		),
	object: <O extends Record<string, any>>() =>
		compile<O>(
			[
				mkRule(
					'type:object',
					(v) =>
						typeof v !== 'object' || v == null || Array.isArray(v)
							? [
									{
										path: '',
										message: formatMessage(
											ValidatorConfig.messages['type:object'],
											{ recived: v === null ? 'null' : typeof v },
										),
									},
								]
							: [],
					'type:object',
				),
			],
			{ id: 'type:object' },
		),
	any: () => compile<any>([]),
	bigint: () =>
		compile<bigint>(
			[
				mkRule(
					'type:bigint',
					(v) =>
						typeof v !== 'bigint'
							? [
									{
										path: '',
										message: formatMessage(
											'Expected bigint but received $recived',
											{ recived: typeof v },
										),
									},
								]
							: [],
					'type:bigint',
				),
			],
			{ id: 'type:bigint' },
		),

	// Validadores específicos
	email: () =>
		Validator.string()
			.regex(EMAIL_RE, ValidatorConfig.messages.email)
			.id('email'),

	url: () =>
		Validator.string().regex(URL_RE, ValidatorConfig.messages.url).id('url'),

	uuid: () =>
		Validator.string().regex(UUID_RE, ValidatorConfig.messages.uuid).id('uuid'),

	isoDate: () =>
		Validator.string()
			.regex(ISO_DATE_RE, ValidatorConfig.messages.isoDate)
			.id('isoDate'),

	creditCard: () =>
		Validator.string()
			.regex(CREDIT_CARD_RE, ValidatorConfig.messages.creditCard)
			.id('creditCard'),

	phone: () =>
		Validator.string()
			.regex(PHONE_RE, ValidatorConfig.messages.phone)
			.id('phone'),

	ipv4: () =>
		Validator.string().regex(IPV4_RE, ValidatorConfig.messages.ipv4).id('ipv4'),

	ipv6: () =>
		Validator.string().regex(IPV6_RE, ValidatorConfig.messages.ipv6).id('ipv6'),

	hex: () =>
		Validator.string().regex(HEX_RE, ValidatorConfig.messages.hex).id('hex'),

	base64: () =>
		Validator.string()
			.regex(BASE64_RE, ValidatorConfig.messages.base64)
			.id('base64'),

	slug: () =>
		Validator.string().regex(SLUG_RE, ValidatorConfig.messages.slug).id('slug'),

	postalCode: () =>
		Validator.string()
			.regex(POSTAL_CODE_RE, ValidatorConfig.messages.postalCode)
			.id('postalCode'),

	username: () =>
		Validator.string()
			.regex(USERNAME_RE, ValidatorConfig.messages.username)
			.id('username'),

	passwordStrong: () =>
		Validator.string()
			.regex(PASSWORD_STRONG_RE, ValidatorConfig.messages.passwordStrong)
			.id('passwordStrong'),

	// Otros
	oneOf: <T>(vals: readonly T[]) =>
		compile<T>(
			[
				mkRule(
					'oneOf',
					(v) =>
						vals.includes(v)
							? []
							: [
									{
										path: '',
										message: formatMessage(ValidatorConfig.messages.oneOf, {
											expected: vals.join(', '),
										}),
									},
								],
					'oneOf',
				),
			],
			{ id: 'type:oneOf' },
		),
	shape: <S extends Record<string, CompiledValidator<any>>>(shapeObj: S) =>
		compile<InferShape<S>>(
			[
				mkRule('type:shape', (v, o) => {
					if (typeof v !== 'object' || v == null || Array.isArray(v))
						return [{ path: '', message: ValidatorConfig.messages.shape }];
					const errs: ValidationDetailed = [];
					for (const k in shapeObj) {
						const child = shapeObj[k];
						const ne = child.validateDetailed(v[k], o);
						ne.forEach((e) =>
							errs.push({
								path: `${k}${e.path ? '.' + e.path : ''}`,
								message: e.message,
							}),
						);
						if (o.fastFail && errs.length) break;
					}
					return errs;
				}),
			],
			{ id: 'type:shape' },
		),
	compose: <T>(...vs: CompiledValidator<T>[]) =>
		compile<T>(
			[
				mkRule(
					'type:compose',
					(v, o) => {
						const errs: ValidationDetailed = [];
						for (const c of vs) {
							const ne = c.validateDetailed(v, o);
							ne.forEach((e) => errs.push(e));
							if (o.fastFail && errs.length) break;
						}
						return errs;
					},
					'type:compose',
				),
			],
			{ id: 'type:compose' },
		),
	configure: (cfg: {
		locale?: string;
		messages?: Record<string, string>;
		defaultOptions?: ValidatorOptions;
	}) => {
		if (cfg.locale) ValidatorConfig.locale = cfg.locale;
		if (cfg.messages) Object.assign(ValidatorConfig.messages, cfg.messages);
		if (cfg.defaultOptions)
			Object.assign(ValidatorConfig.defaultOptions, cfg.defaultOptions);
	},
} as const;
