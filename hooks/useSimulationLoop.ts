import { useReducer, useEffect, useCallback, useState } from 'react';
import { 
  SimulationState, 
  LLMState, 
  generateInitialLSM, 
  calculateNextLsmNodes, 
  calculateNextMetabolism, 
  calculateNextActiveInference,
  TICK_RATES,
  clamp,
  TOYS,
  ToyType,
  EpisodicMemory,
  BlocksData,
  SpinnerData,
  ChimesData
} from '../lib/simulationEngine';

type SimulationAction = 
  | { type: 'TICK'; payload: { timestamp: number } }
  | { type: 'SET_LLM_STATE', payload: LLMState }
  | { type: 'SET_WAKING_REASON', payload: string | null }
  | { type: 'SET_PREDICTION', payload: string | null }
  | { type: 'INJECT_SURPRISE', payload: number }
  | { type: 'INJECT_SENSORY', payload: { row: number; value: number } }
  | { type: 'DRAIN_ENERGY', payload: number }
  | { type: 'RESET_BOREDOM' }
  | { type: 'RESET_FREE_ENERGY' }
  | { type: 'SET_ACTIVE_TOY', payload: ToyType | null }
  | { type: 'TOY_ACTION', payload: { action: string } }
  | { type: 'SET_LINGUISTIC_STYLE', payload: string }
  | { type: 'ADD_EPISODIC_MEMORY', payload: Omit<EpisodicMemory, 'id'> }
  | { type: 'SET_EPISODIC_MEMORY', payload: EpisodicMemory[] };

interface SimulationState {
  time: number;
  lastTickTime: number;
  energy: number;
  freeEnergy: number;
  boredom: number;
  llmState: LLMState;
  lsmNodes: number[];
  activeToy: ToyType | null;
  toyState: {
    type: ToyType | null;
    data: any;
    lastAction: string | null;
    lastResult: string | null;
  };
  episodicMemory: EpisodicMemory[];
  wakingReason: string | null;
  prediction: string | null;
  linguisticStyle: string;
}

function simulationReducer(state: SimulationState, action: SimulationAction): SimulationState {
  switch (action.type) {
    case 'TICK': {
      const lastTime = state.lastTickTime === 0 ? action.payload.timestamp - 100 : state.lastTickTime;
      const dt = (action.payload.timestamp - lastTime) / 1000;
      if (dt <= 0) return state;

      const nextTime = state.time + 1;
      
      // 1. Update LSM
      const noiseLevel = state.freeEnergy / 100;
      const nextLsmNodes = calculateNextLsmNodes(state.lsmNodes, noiseLevel, state.llmState, dt);
      
      // Calculate LSM activity
      const lsmActivity = nextLsmNodes.reduce((a, b) => a + b, 0) / nextLsmNodes.length;

      // 2. Update Metabolism
      const nextEnergy = calculateNextMetabolism(state.energy, state.llmState, dt);

      // 3. Update Active Inference
      const { freeEnergy: nextFreeEnergy, boredom: nextBoredom } = calculateNextActiveInference(state.freeEnergy, state.boredom, state.llmState, dt);

      // 4. Spontaneity Check: High LSM activity + IDLE state can trigger spontaneous thought
      let nextLlmState = state.llmState;
      let nextWakingReason = state.wakingReason;
      
      if (state.llmState === 'IDLE' && lsmActivity > 0.4 && Math.random() < 0.05) {
        nextLlmState = 'SPONTANEOUS_THOUGHT';
        nextWakingReason = 'LSM_RESONANCE';
      }

      // 5. Update Toy State (Natural Decay)
      let nextToyState = { ...state.toyState };
      if (nextToyState.type === 'spinner' && nextToyState.data) {
        const d = { ...nextToyState.data } as SpinnerData;
        d.rpm = Math.max(0, d.rpm - (10 * dt * 10)); // Scaled decay
        nextToyState.data = d;
      } else if (nextToyState.type === 'chimes' && nextToyState.data) {
        const d = { ...nextToyState.data } as ChimesData;
        d.resonance = Math.max(0, d.resonance - (5 * dt * 10));
        nextToyState.data = d;
      }

      return {
        ...state,
        time: nextTime,
        lastTickTime: action.payload.timestamp,
        energy: nextEnergy,
        freeEnergy: nextFreeEnergy,
        boredom: nextBoredom,
        llmState: nextLlmState,
        wakingReason: nextWakingReason,
        lsmNodes: nextLsmNodes,
        toyState: nextToyState
      };
    }
    case 'INJECT_SENSORY': {
      const dt = 0.1; 
      const nextLsmNodes = calculateNextLsmNodes(
        state.lsmNodes,
        0.1,
        state.llmState,
        dt,
        action.payload
      );
      return { ...state, lsmNodes: nextLsmNodes };
    }
    case 'SET_LLM_STATE':
      return { ...state, llmState: action.payload };
    case 'SET_WAKING_REASON':
      return { ...state, wakingReason: action.payload };
    case 'SET_PREDICTION':
      return { ...state, prediction: action.payload };
    case 'INJECT_SURPRISE':
      return { ...state, freeEnergy: clamp(state.freeEnergy + action.payload, 0, 100) };
    case 'DRAIN_ENERGY':
      return { ...state, energy: clamp(state.energy - action.payload, 0, 100) };
    case 'RESET_BOREDOM':
      return { ...state, boredom: 0 };
    case 'RESET_FREE_ENERGY':
      return { ...state, freeEnergy: 0 };
    case 'SET_ACTIVE_TOY': {
      let initialData = null;
      if (action.payload === 'blocks') initialData = { height: 0, stability: 100 };
      if (action.payload === 'spinner') initialData = { rpm: 0, momentum: 0 };
      if (action.payload === 'chimes') initialData = { sequence: [], resonance: 0 };
      
      return { 
        ...state, 
        toyState: {
          type: action.payload,
          data: initialData,
          lastAction: null,
          lastResult: null
        }
      };
    }
    case 'TOY_ACTION': {
      if (!state.toyState.type) return state;
      
      let nextData: any = state.toyState.data ? { ...state.toyState.data } : null;
      let result = "";
      let freeEnergyDelta = 0;
      let boredomDelta = -5;

      if (state.toyState.type === 'blocks' && nextData) {
        const d = nextData as BlocksData;
        if (action.payload.action === 'stack') {
          d.height += 1;
          d.stability -= 15;
          result = `Stacked to height ${d.height}. Stability decreasing.`;
        } else if (action.payload.action === 'balance') {
          d.stability = clamp(d.stability + 25, 0, 100);
          result = `Balanced the tower. Stability is now ${d.stability}%.`;
        } else if (action.payload.action === 'topple') {
          d.height = 0;
          d.stability = 100;
          result = "The tower fell! Chaos and noise.";
          freeEnergyDelta = 20;
        }
        
        if (d.stability <= 0 && d.height > 0) {
          d.height = 0;
          d.stability = 100;
          result = "The tower collapsed under its own weight!";
          freeEnergyDelta = 25;
        }
      } else if (state.toyState.type === 'spinner') {
        const d = nextData as SpinnerData;
        if (action.payload.action === 'flick') {
          d.rpm += 150;
          d.momentum += 20;
          result = `Flicked! Speed is now ${d.rpm} RPM.`;
        } else if (action.payload.action === 'steady') {
          d.momentum = clamp(d.momentum + 30, 0, 100);
          result = "Steadied the rotation. It feels smooth.";
        } else if (action.payload.action === 'stop') {
          d.rpm = 0;
          d.momentum = 0;
          result = "Abrupt stop. The world is still.";
        }
      } else if (state.toyState.type === 'chimes') {
        const d = nextData as ChimesData;
        if (action.payload.action === 'strike') {
          const notes = ['C', 'E', 'G', 'B'];
          const note = notes[Math.floor(Math.random() * notes.length)];
          d.sequence = [...d.sequence, note].slice(-4);
          d.resonance += 20;
          result = `Struck the ${note} chime. Resonance building.`;
        } else if (action.payload.action === 'dampen') {
          d.resonance = 0;
          result = "Silenced the chimes.";
        } else if (action.payload.action === 'listen') {
          boredomDelta = -15;
          result = "Listening to the fading echoes...";
        }
      }

      return {
        ...state,
        boredom: clamp(state.boredom + boredomDelta, 0, 100),
        freeEnergy: clamp(state.freeEnergy + freeEnergyDelta, 0, 100),
        toyState: {
          ...state.toyState,
          data: nextData,
          lastAction: action.payload.action,
          lastResult: result
        }
      };
    }
    case 'SET_LINGUISTIC_STYLE':
      return { ...state, linguisticStyle: action.payload };
    case 'ADD_EPISODIC_MEMORY':
      return { 
        ...state, 
        episodicMemory: [
          ...state.episodicMemory, 
          { ...action.payload, id: Date.now() }
        ].slice(-10) // Keep only last 10 experiences
      };
    case 'SET_EPISODIC_MEMORY':
      return {
        ...state,
        episodicMemory: action.payload
      };
    default:
      return state;
  }
}

export function useSimulationLoop(initialTickRate: number = TICK_RATES.REALTIME) {
  const [tickRate, setTickRate] = useState<number>(initialTickRate);
  const [isPaused, setIsPaused] = useState(false);

  const [simState, dispatch] = useReducer(simulationReducer, {
    time: 0,
    lastTickTime: 0, // Initialized to 0 to avoid impurity
    energy: 80,
    freeEnergy: 10,
    boredom: 0,
    llmState: 'IDLE',
    wakingReason: null,
    prediction: null,
    lsmNodes: generateInitialLSM(),
    linguisticStyle: 'Literal, computational, naive',
    episodicMemory: [],
    toyState: {
      type: null,
      data: null,
      lastAction: null,
      lastResult: null
    }
  });

  const tick = useCallback(() => {
    dispatch({ type: 'TICK', payload: { timestamp: Date.now() } });
  }, []);

  useEffect(() => {
    if (isPaused || tickRate === TICK_RATES.PAUSED) return;
    const interval = setInterval(tick, tickRate);
    return () => clearInterval(interval);
  }, [tick, tickRate, isPaused]);

  return {
    simState,
    dispatch,
    tickRate,
    setTickRate,
    isPaused,
    setIsPaused,
    tick
  };
}
