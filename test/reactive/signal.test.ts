import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '../../src/core/reactive/signal';
import { captureSignal } from '../../src/testing/signal-test';
import type { ReactiveSignal } from '../../src/core/reactive/types';
import { flushNow } from '../../src/testing/scheduler-test';

describe('Signal', () => {
  describe('Creación y valor inicial', () => {
    it('debería crear una señal con un valor inicial', () => {
      const count = signal(0);
      expect(count()).toBe(0);
    });

    it('debería permitir valores undefined', () => {
      const nullableSignal = signal<number | undefined>(undefined);
      expect(nullableSignal()).toBeUndefined();
    });
  });

  describe('Actualizaciones y suscripciones', () => {
    let countSignal: ReactiveSignal<number>;
    let captured: ReturnType<typeof captureSignal<number>>;

    beforeEach(() => {
      countSignal = signal(0);
      captured = captureSignal(countSignal);
    });

    it('debería actualizar el valor correctamente', () => {
      countSignal.update(() => 1);
      expect(countSignal()).toBe(1);
    });

    it('debería notificar a los suscriptores cuando el valor cambia', () => {
      countSignal.update(() => 1);
      countSignal.update(() => 2);
      countSignal.update(() => 3);
      flushNow();
      
      expect(captured.values).toEqual([0, 3, 3, 3]);
    });

    it('no debería notificar cuando se establece el mismo valor', () => {
      countSignal.update(() => 1);
      countSignal.update(() => 1);
      flushNow();
      
      expect(captured.values).toEqual([0, 1]);
    });
  });

  describe('Limpieza', () => {
    it('debería permitir detener la suscripción', () => {
      const count = signal(0);
      const captured = captureSignal(count);
      
      count.update(() => 1);
      flushNow();
      captured.stop();
      count.update(() => 2);
      
      expect(captured.values).toEqual([1, 1]);
    });
  });
});
