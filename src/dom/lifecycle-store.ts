/* -------------------------
   Global Effects Store
   ------------------------- */

// Un objeto estable que siempre existe al cargar el módulo.
export const lifecycleStore = {
	globalMountEffects: [] as ((node: any) => void)[],
	globalDestroyEffects: [] as ((node: any) => void)[],
};
