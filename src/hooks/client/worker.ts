/**
 * Tipo genérico que representa cualquier función.
 * Acepta cualquier número de argumentos y retorna cualquier valor.
 */
type AnyFunction = (...args: any[]) => any;

/**
 * Interfaz que define una función que ha sido convertida en un Worker.
 * Permite llamarla como una función normal, pero devuelve una promesa con el resultado.
 * Además, expone el objeto Worker y un método para destruirlo.
 */
export interface CallableWorker<F extends AnyFunction> {
	(...args: Parameters<F>): Promise<Awaited<ReturnType<F>>>;
	worker: Worker;
	destroy: () => void;
}

/**
 * Convierte una función en su representación serializada en forma de string.
 * Esto es necesario para poder inyectar la función dentro del cuerpo del Worker.
 * 
 * @param fn Función a serializar.
 * @returns String que representa la función como código fuente.
 */
function serializeFunction(fn: AnyFunction): string {
	return `(${fn.toString()})`;
}

/**
 * Convierte un objeto de variables globales a una cadena de código JavaScript.
 * Esto permite que las variables sean accesibles dentro del Worker.
 * Soporta funciones, objetos y valores primitivos.
 * 
 * @param globals Objeto con claves y valores que se inyectarán en el Worker.
 * @returns Código JavaScript como string para definir las variables dentro del Worker.
 */
function serializeGlobals(globals: Record<string, any>): string {
	return Object.entries(globals)
		.map(([key, value]) => {
			if (typeof value === 'function') {
				return `const ${key} = ${serializeFunction(value)};`;
			}
			if (typeof value === 'object') {
				return `const ${key} = ${JSON.stringify(value)};`;
			}
			return `const ${key} = ${JSON.stringify(value)};`;
		})
		.join('\n');
}

/**
 * Clase que encapsula la creación y gestión de un Web Worker
 * que ejecuta una función pasada desde el hilo principal.
 * 
 * @template F Tipo de la función que se ejecutará en el Worker.
 */
class WrappedWorker<F extends AnyFunction> {
	/**
	 * Cola de callbacks para resolver o rechazar las promesas asociadas a cada ejecución del Worker.
	 */
	private callbacks: {
		resolve: (value: any) => void;
		reject: (reason?: any) => void;
	}[] = [];

	/** Instancia real del Worker creada con un Blob */
	public readonly worker: Worker;

	/**
	 * Crea un nuevo Worker envolviendo la función dada.
	 * 
	 * @param fn Función que se ejecutará dentro del Worker.
	 * @param globals Variables globales que se deben inyectar en el contexto del Worker.
	 */
	constructor(
		public readonly fn: F,
		globals: Record<string, any> = {},
	) {
		// Serializamos la función y las variables globales
		const fnSerialized = serializeFunction(fn);
		const globalsSerialized = serializeGlobals(globals);

		// Creamos el código fuente del Worker como un string
		const blob = new Blob(
			[
				`
					${globalsSerialized}
					const userFn = ${fnSerialized};
					onmessage = async (e) => {
						const { args } = e.data;
						try {
							const result = await userFn(...args);
							postMessage({ success: true, result });
						} catch (err) {
							postMessage({
								success: false,
								error: err?.message || err?.toString?.() || 'Error desconocido'
							});
						}
					};
				`,
			],
			{ type: 'application/javascript' },
		);

		// Creamos un objeto URL a partir del Blob y lo usamos para crear el Worker
		const url = URL.createObjectURL(blob);
		this.worker = new Worker(url);

		// Asignamos el manejador de mensajes del Worker para manejar los resultados o errores
		this.worker.onmessage = (e) => {
			const cb = this.callbacks.shift();
			if (cb) {
				if (e.data.success) cb.resolve(e.data.result);
				else cb.reject(e.data.error);
			}
		};
	}

	/**
	 * Ejecuta la función dentro del Worker con los argumentos proporcionados.
	 * 
	 * @param args Argumentos a pasar a la función.
	 * @param transfer Objetos transferibles opcionales para mejorar el rendimiento.
	 * @returns Promesa con el resultado de la ejecución.
	 */
	run(args: unknown[], transfer?: Transferable[]): Promise<any> {
		return new Promise((resolve, reject) => {
			this.callbacks.push({ resolve, reject });
			this.worker.postMessage({ args }, transfer || []);
		});
	}

	/**
	 * Termina el Worker y libera los recursos asociados.
	 */
	destroy() {
		this.worker.terminate();
	}
}

/**
 * Función auxiliar que crea un Worker a partir de una función dada.
 * 
 * Retorna una función callable que actúa como la función original,
 * pero que se ejecuta de forma asincrónica en un hilo separado (Worker).
 * También expone el Worker original y un método para destruirlo.
 * 
 * @param fn Función a ejecutar en el Worker.
 * @param globals Variables globales accesibles dentro del Worker.
 * @returns Un objeto callable que actúa como la función original, con propiedades adicionales.
 */
export function createWorker<F extends AnyFunction>(
	fn: F,
	globals?: Record<string, any>,
): CallableWorker<F> {
	// Creamos una instancia de WrappedWorker
	const instance = new WrappedWorker(fn, globals);

	// Creamos una función asincrónica que ejecuta la lógica del Worker
	const callable = (async (...args: Parameters<F>) => {
		return await instance.run(args);
	}) as CallableWorker<F>;

	// Adjuntamos propiedades adicionales al callable
	callable.worker = instance.worker;
	callable.destroy = () => instance.destroy();

	return callable;
}
