import { 
  clamp, 
  calculateNextMetabolism, 
  calculateNextActiveInference, 
  calculateNextLsmNodes 
} from './simulationEngine';

describe('simulationEngine', () => {
  describe('clamp', () => {
    it('clamps values correctly', () => {
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(110, 0, 100)).toBe(100);
    });
  });

  describe('calculateNextMetabolism', () => {
    it('increases energy when sleeping', () => {
      expect(calculateNextMetabolism(50, 'SLEEPING')).toBe(52);
    });
    it('increases energy slightly when idle', () => {
      expect(calculateNextMetabolism(50, 'IDLE')).toBe(50.5);
    });
    it('decreases energy when active', () => {
      expect(calculateNextMetabolism(50, 'FORAGING')).toBe(48.5);
    });
    it('clamps energy between 0 and 100', () => {
      expect(calculateNextMetabolism(99, 'SLEEPING')).toBe(100);
      expect(calculateNextMetabolism(1, 'FORAGING')).toBe(0);
    });
  });

  describe('calculateNextActiveInference', () => {
    it('drifts free energy and increases boredom when idle', () => {
      const result = calculateNextActiveInference(50, 50, 'IDLE');
      expect(result.freeEnergy).toBe(50.5);
      expect(result.boredom).toBe(52);
    });
    it('reduces free energy and resets boredom when foraging', () => {
      const result = calculateNextActiveInference(50, 50, 'FORAGING');
      expect(result.freeEnergy).toBe(40);
      expect(result.boredom).toBe(0);
    });
    it('increases free energy slightly and reduces boredom when playing', () => {
      const result = calculateNextActiveInference(50, 50, 'PLAYING');
      expect(result.freeEnergy).toBe(51);
      expect(result.boredom).toBe(45);
    });
    it('resets boredom when sleeping', () => {
      const result = calculateNextActiveInference(50, 50, 'SLEEPING');
      expect(result.freeEnergy).toBe(50);
      expect(result.boredom).toBe(0);
    });
  });

  describe('calculateNextLsmNodes', () => {
    it('returns array of same length with values between 0 and 1', () => {
      const prev = Array(64).fill(0.5);
      const next = calculateNextLsmNodes(prev, 0.5);
      expect(next.length).toBe(64);
      next.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
    });
  });
});
