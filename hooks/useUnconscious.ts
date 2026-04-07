import { useEffect, useRef } from 'react';
import { SimulationAction } from '../hooks/useSimulationLoop';
import { SimulationState } from '../lib/simulationEngine';
import { Type } from '@google/genai';
import { generateContentWithFallback } from '../lib/gemini';

export function useUnconscious(
  simState: SimulationState,
  dispatch: React.Dispatch<SimulationAction>,
  addLog: (msg: string, type: any) => void
) {
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (simState.unconsciousProcessing && !isProcessingRef.current) {
      isProcessingRef.current = true;
      
      const runUnconscious = async () => {
        try {
          addLog('Unconscious processing triggered...', 'system');
          
          const prompt = `
          Task: You are the Unconscious mind of a cognitive simulation.
          
          Character Identity: ${simState.characterSeed.identity}
          Current Context: ${simState.characterSeed.currentContext}
          
          Recent Memories: ${simState.episodicMemory.length > 0 ? simState.episodicMemory.slice(-3).map(m => `${m.stimulus} → ${m.outcome}`).join(' | ') : 'None'}
          Current Attractors: ${JSON.stringify(simState.attractors)}
          
          State: Energy ${simState.energy.toFixed(1)}, Surprise ${simState.freeEnergy.toFixed(1)}, Boredom ${simState.boredom.toFixed(1)}.
          
          Instructions:
          1. Generate 1-2 new semantic attractors (goals, thoughts, or observations).
          2. STRICT: Only generate attractors that are DIRECTLY derived from the current context or recent memories.
          3. STRICT: Do NOT fall back on generic character tropes (e.g. if the character is a detective, do not invent a crime unless there is evidence in the context).
          4. If the context is empty or neutral, generate simple, literal observations about the immediate environment.
          5. Output JSON only.
          `;
          
          const response = await generateContentWithFallback({
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  newAttractors: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        concept: { type: Type.STRING },
                        pressure: { type: Type.NUMBER, description: "Initial pressure 0-50" },
                        buildRate: { type: Type.NUMBER, description: "Rate of pressure build 0.1-5.0" },
                        type: { type: Type.STRING, enum: ["EPISTEMIC", "PRAGMATIC", "SOCIAL"] }
                      },
                      required: ["id", "concept", "pressure", "buildRate", "type"]
                    }
                  }
                },
                required: ["newAttractors"]
              }
            }
          });
          
          const res = JSON.parse(response.text || '{}');
          if (res.newAttractors && res.newAttractors.length > 0) {
            dispatch({ type: 'INJECT_ATTRACTORS', payload: res.newAttractors });
            addLog(`Unconscious generated ${res.newAttractors.length} new attractors.`, 'info');
          }
        } catch (e) {
          console.error("Unconscious error:", e);
        } finally {
          dispatch({ type: 'SET_UNCONSCIOUS_PROCESSING', payload: false });
          isProcessingRef.current = false;
        }
      };
      
      runUnconscious();
    }
  }, [simState.unconsciousProcessing, simState, dispatch, addLog]);
}
