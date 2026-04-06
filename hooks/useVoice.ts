import { useEffect, useRef } from 'react';
import { SimulationState } from '../lib/simulationEngine';
import { SimulationAction } from '../hooks/useSimulationLoop';
import { generateContentWithFallback } from '../lib/gemini';

export function useVoice(
  simState: SimulationState,
  dispatch: React.Dispatch<SimulationAction>,
  addLog: (msg: string, type: any) => void,
  addThought: (msg: string, type: any) => void
) {
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (simState.voiceProcessing && !isProcessingRef.current) {
      isProcessingRef.current = true;
      
      const runVoice = async () => {
        try {
          addLog('Voice rendering triggered...', 'system');
          
          // Find dominant attractor
          const dominantAttractor = [...simState.attractors].sort((a, b) => b.pressure - a.pressure)[0];
          
          const prompt = `
          Character Identity: ${simState.characterSeed.identity}
          Context: ${simState.characterSeed.currentContext}
          Voice: ${simState.characterSeed.voiceDescriptor}
          
          State: Energy ${simState.energy.toFixed(1)}, Surprise ${simState.freeEnergy.toFixed(1)}, Boredom ${simState.boredom.toFixed(1)}.
          Dominant Attractor: "${dominantAttractor ? dominantAttractor.concept : 'None'}"
          Trigger: ${simState.wakingReason}
          
          Task: Express this state in a short, in-character stream of consciousness or action. Do not break character. Do not explain. Just output the thought or dialogue.
          `;
          
          const response = await generateContentWithFallback({
            contents: prompt,
          });
          
          const text = response.text?.trim();
          if (text) {
            addThought(text, 'thought');
            
            // Discharge the attractor
            if (dominantAttractor) {
              dispatch({ type: 'DISCHARGE_ATTRACTOR', payload: { id: dominantAttractor.id, amount: 50 } });
            }
          }
        } catch (e) {
          console.error("Voice error:", e);
        } finally {
          dispatch({ type: 'SET_VOICE_PROCESSING', payload: false });
          // Reset waking reason if it was user stimulus so it doesn't loop
          if (simState.wakingReason === 'USER_STIMULUS') {
            dispatch({ type: 'SET_WAKING_REASON', payload: null });
          }
          isProcessingRef.current = false;
        }
      };
      
      runVoice();
    }
  }, [simState.voiceProcessing, simState, dispatch, addLog, addThought]);
}
