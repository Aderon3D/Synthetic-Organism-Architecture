export type LLMState = 'SLEEPING' | 'IDLE' | 'WAKING' | 'FORAGING' | 'CONSOLIDATING' | 'PLAYING_INIT' | 'PLAYING' | 'SPONTANEOUS_THOUGHT';

export interface EpisodicMemory {
  id: number;
  time: number;
  stimulus: string;
  thought: string;
  outcome: string;
}

export interface BlocksData {
  height: number;
  stability: number;
}

export interface SpinnerData {
  rpm: number;
  momentum: number;
}

export interface ChimesData {
  sequence: string[];
  resonance: number;
}

export interface ToyState {
  type: ToyType | null;
  data: BlocksData | SpinnerData | ChimesData | null;
  lastAction: string | null;
  lastResult: string | null;
}

export interface SimulationState {
  time: number;
  energy: number;
  freeEnergy: number;
  boredom: number;
  llmState: LLMState;
  wakingReason: string | null;
  prediction: string | null;
  lsmNodes: number[];
  linguisticStyle: string;
  episodicMemory: EpisodicMemory[];
  toyState: ToyState;
}

export interface HistoryPoint {
  time: number;
  energy: number;
  freeEnergy: number;
  boredom: number;
}

export interface LogEntry {
  id: number;
  time: number;
  message: string;
  type: 'info' | 'alert' | 'action' | 'system';
}

export interface ThoughtEntry {
  id: number;
  time: number;
  text: string;
  type: 'thought' | 'action';
}

export interface WorldEvent {
  id: number;
  time: number;
  source: 'user' | 'organism';
  content: string;
}

export const LSM_SIZE = 64; // 8x8 grid
export const LSM_SIDE = 8;
export const MAX_HISTORY = 50;
export const MAX_LOGS = 100;
export const MAX_THOUGHTS = 50;
export const MAX_WORLD_EVENTS = 50;

// Fixed weight matrix for LSM recurrence (sparse neighborhood connections)
const LSM_WEIGHTS = Array.from({ length: LSM_SIZE }, (_, i) => {
  const row = Math.floor(i / LSM_SIDE);
  const col = i % LSM_SIDE;
  const neighbors: { idx: number; weight: number }[] = [];
  
  // Connect to 4 cardinal neighbors
  const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  directions.forEach(([dr, dc]) => {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr < LSM_SIDE && nc >= 0 && nc < LSM_SIDE) {
      neighbors.push({ idx: nr * LSM_SIDE + nc, weight: 0.15 });
    }
  });
  return neighbors;
});

export const TICK_RATES = {
  PAUSED: 0,
  REALTIME: 1000,
  FAST: 200,
  TURBO: 50,
};

export const TOYS = ['blocks', 'spinner', 'chimes'] as const;
export type ToyType = typeof TOYS[number];

export const generateInitialLSM = () => Array.from({ length: LSM_SIZE }, () => 0.05);

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

/**
 * LSM Recurrence: Nodes pass signals to neighbors creating ripples.
 * @param prevNodes Current node states
 * @param noiseLevel Entropy level
 * @param llmState Cognitive state influence
 * @param dt Time delta in seconds
 * @param injection Optional sensory injection (e.g. user input)
 */
export function calculateNextLsmNodes(
  prevNodes: number[], 
  noiseLevel: number, 
  llmState: LLMState, 
  dt: number,
  injection?: { row: number; value: number }
): number[] {
  const nextNodes = [...prevNodes];
  
  // 1. Recurrent propagation
  prevNodes.forEach((val, i) => {
    if (val < 0.01) return;
    const neighbors = LSM_WEIGHTS[i];
    neighbors.forEach(n => {
      // Transfer a fraction of energy based on dt
      const transfer = val * n.weight * dt * 2.0; 
      nextNodes[n.idx] = clamp(nextNodes[n.idx] + transfer, 0, 1);
      nextNodes[i] = clamp(nextNodes[i] - transfer * 0.5, 0, 1); // Source loses some energy
    });
  });

  // 2. Decay and Noise (Exponential)
  // Decay constant k: higher during sleep, lower during play
  const k = llmState === 'SLEEPING' ? 0.8 : 0.4;
  const decayFactor = Math.exp(-k * dt);
  
  return nextNodes.map((val, i) => {
    let nextVal = val * decayFactor;
    
    // Cognitive state boost
    const stateBoost = (llmState === 'FORAGING' || llmState === 'PLAYING') ? 0.05 * dt : 0.01 * dt;
    nextVal += stateBoost;
    
    // Sensory injection (ripples start here)
    if (injection && Math.floor(i / LSM_SIDE) === injection.row) {
      nextVal += injection.value * dt * 5.0;
    }
    
    const noise = (Math.random() - 0.5) * noiseLevel * dt * 2.0;
    return clamp(nextVal + noise, 0, 1);
  });
}

/**
 * Metabolism ODE: Exponential decay/recovery.
 * Energy_new = Energy_old * e^(-k * dt)
 */
export function calculateNextMetabolism(prevEnergy: number, llmState: LLMState, dt: number): number {
  if (llmState === 'SLEEPING') {
    // Recovery: Logistic growth towards 100
    const r = 0.15; // Recovery rate
    const K = 100; // Carrying capacity
    return clamp(prevEnergy + (r * prevEnergy * (1 - prevEnergy / K) * dt), 0, 100);
  }
  
  // Decay: k depends on cognitive load
  let k = 0.005; // Base metabolic rate
  if (llmState === 'FORAGING' || llmState === 'PLAYING') k = 0.02;
  if (llmState === 'CONSOLIDATING') k = 0.015;
  
  return clamp(prevEnergy * Math.exp(-k * dt), 0, 100);
}

/**
 * Active Inference ODE: Entropy drift and reduction.
 */
export function calculateNextActiveInference(
  prevFreeEnergy: number, 
  prevBoredom: number, 
  llmState: LLMState, 
  dt: number
): { freeEnergy: number, boredom: number } {
  let nextFreeEnergy = prevFreeEnergy;
  let nextBoredom = prevBoredom;
  
  if (llmState === 'IDLE') {
    // Uncertainty drift (Entropy increase)
    nextFreeEnergy += 0.8 * dt;
    // Boredom drift
    nextBoredom += 3.0 * dt;
  } else if (llmState === 'FORAGING' || llmState === 'WAKING' || llmState === 'CONSOLIDATING') {
    // Active reduction of uncertainty
    const k = 0.5;
    nextFreeEnergy = prevFreeEnergy * Math.exp(-k * dt);
    nextBoredom = prevBoredom * Math.exp(-2.0 * dt);
  } else if (llmState === 'PLAYING' || llmState === 'PLAYING_INIT') {
    nextFreeEnergy += 1.5 * dt; // Entropy increase from stimulation
    const k = 0.4;
    nextBoredom = prevBoredom * Math.exp(-k * dt);
  } else if (llmState === 'SLEEPING') {
    // Synaptic scaling / pruning
    nextFreeEnergy = prevFreeEnergy * Math.exp(-0.1 * dt);
    nextBoredom = 0;
  }
  
  return {
    freeEnergy: clamp(nextFreeEnergy, 0, 100),
    boredom: clamp(nextBoredom, 0, 100)
  };
}
