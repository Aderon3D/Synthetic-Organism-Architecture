export type LLMState = 'SLEEPING' | 'IDLE' | 'WAKING' | 'FORAGING' | 'CONSOLIDATING' | 'PLAYING_INIT' | 'PLAYING';

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
export const MAX_HISTORY = 50;
export const MAX_LOGS = 100;
export const MAX_THOUGHTS = 50;
export const MAX_WORLD_EVENTS = 50;

export const TICK_RATES = {
  PAUSED: 0,
  REALTIME: 1000,
  FAST: 200,
  TURBO: 50,
};

export const TOYS = ['blocks', 'spinner', 'chimes'] as const;
export type ToyType = typeof TOYS[number];

export const generateInitialLSM = () => Array.from({ length: LSM_SIZE }, () => 0.1);

export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

export function calculateNextLsmNodes(prevNodes: number[], noiseLevel: number): number[] {
  return prevNodes.map(val => {
    const decay = val * 0.9;
    const noise = (Math.random() - 0.5) * noiseLevel * 0.5;
    return clamp(decay + noise + (Math.random() * 0.05), 0, 1);
  });
}

export function calculateNextMetabolism(prevEnergy: number, llmState: LLMState): number {
  let nextEnergy = prevEnergy;
  if (llmState === 'SLEEPING') {
    nextEnergy += 3.0; // Faster recovery
  } else if (llmState === 'IDLE') {
    nextEnergy += 0.2; // Slight drift up
  } else {
    nextEnergy -= 0.8; // Reduced drain (was 1.5)
  }
  return clamp(nextEnergy, 0, 100);
}

export function calculateNextActiveInference(prevFreeEnergy: number, prevBoredom: number, llmState: LLMState): { freeEnergy: number, boredom: number } {
  let nextFreeEnergy = prevFreeEnergy;
  let nextBoredom = prevBoredom;
  
  if (llmState === 'IDLE') {
    nextFreeEnergy += 0.5; // Natural drift
    nextBoredom += 2.0; // Gets bored when doing nothing
  } else if (llmState === 'FORAGING' || llmState === 'WAKING' || llmState === 'CONSOLIDATING') {
    nextFreeEnergy -= 10.0; // Rapidly reduce uncertainty while thinking
    nextBoredom = 0;
  } else if (llmState === 'PLAYING' || llmState === 'PLAYING_INIT') {
    nextFreeEnergy += 1.0; // Stimulation increases entropy slightly
    nextBoredom -= 5.0;
  } else if (llmState === 'SLEEPING') {
    nextBoredom = 0;
  }
  
  return {
    freeEnergy: clamp(nextFreeEnergy, 0, 100),
    boredom: clamp(nextBoredom, 0, 100)
  };
}
