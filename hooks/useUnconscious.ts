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
          Character Identity: ${simState.characterSeed.identity}
          Current Context: ${simState.characterSeed.currentContext}
          
          Recent Memories: ${simState.episodicMemory.slice(-3).map(m => m.content).join(' | ')}
          Current Attractors: ${JSON.stringify(simState.attractors)}
          
          State: Energy ${simState.energy.toFixed(1)}, Surprise ${simState.freeEnergy.toFixed(1)}, Boredom ${simState.boredom.toFixed(1)}.
          
          Task: You are the Unconscious mind. Based on the current state and memories, generate 1-2 new semantic attractors (goals, thoughts, or observations) that the character's conscious mind should focus on.
          Output JSON only.
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
                        decayRate: { type: Type.NUMBER, description: "Rate of pressure build 0.1-5.0" },
                        type: { type: Type.STRING, enum: ["EPISTEMIC", "PRAGMATIC", "SOCIAL"] }
                      },
                      required: ["id", "concept", "pressure", "decayRate", "type"]
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
