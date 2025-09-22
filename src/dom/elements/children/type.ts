export type handlerChild<T> = {
    child: T[],
    mount: () => void,
    destroy: () => void
}