import { describe, it, expect } from 'vitest';
import { signal } from '../../src/core/reactive/signal';
import { computed } from '../../src/core/reactive/computed';
import { captureSignal } from '../../src/testing/signal-test';
import { flushNow } from '../../src/testing/scheduler-test';

describe('Computed', () => {
  describe('Cálculo inicial', () => {
    it('debería calcular el valor inicial correctamente', () => {
      const first = signal('John');
      const last = signal('Doe');
      const fullName = computed([first, last], () => `${first()} ${last()}`);
      
      expect(fullName()).toBe('John Doe');
    });
  });

  describe('Actualizaciones reactivas', () => {
    it('debería actualizarse cuando las dependencias cambien', () => {
      const first = signal('John');
      const last = signal('Doe');
      const fullName = computed([first, last], () => `${first()} ${last()}`);
      
      flushNow();
      const captured = captureSignal(fullName);

      
      first.update(() => 'Jane');
      last.update(() => 'Smith');
      
      flushNow();
      expect(captured.values).toEqual(['John Doe', 'Jane Smith']);
    });

    it('debería manejar múltiples dependencias', () => {
      const a = signal(1);
      const b = signal(2);
      const c = signal(3);
      const sum = computed([a, b, c], () => a() + b() + c());
      flushNow();
      const captured = captureSignal(sum);
      
      a.update(() => 10);
      b.update(() => 20);
      c.update(() => 30);
      flushNow();

      expect(captured.values).toEqual([6, 60]);
    });

    it('no debería actualizarse si el valor computado es el mismo', () => {
      const count = signal(0);
      const isEven = computed([count], () => count() % 2 === 0);
      const captured = captureSignal(isEven);

      count.update(() => 2); // sigue siendo par
      count.update(() => 4); // sigue siendo par

      expect(captured.values).toEqual([]);
    });
  });

  describe('Limpieza', () => {
    it('debería dejar de actualizarse cuando se detiene la suscripción', () => {
      const value = signal(0);
      const doubled = computed([value], () => value() * 2);
      const captured = captureSignal(doubled);

      value.update(() => 1);
      captured.stop();
      flushNow();
      value.update(() => 2);

      expect(captured.values).toEqual([2]);
    });
  });
});