export function uniqueId(name = 'unique'): string {
    // número aleatorio en base36 de 4 caracteres
    const rand = Math.random().toString(36).slice(2, 10);
    // timestamp en base36 para acortar
    const time = Date.now().toString(36);
    return `${name}-${rand}-${time}`;
}

let counter = 0;

export function simpleUniqueId(prefix = 'unique'): string {
  return `${prefix}-${counter++}`;
}
