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
  const expressionCounterRef = useRef(0);

  useEffect(() => {
    if (simState.voiceProcessing && !isProcessingRef.current) {
      isProcessingRef.current = true;
      
      const runVoice = async () => {
        try {
          addLog('Voice rendering triggered...', 'system');
          
          // Find dominant attractor
          const dominantAttractor = [...simState.attractors].sort((a, b) => b.pressure - a.pressure)[0];
          
          const prompt = `
          A mind in the following state, speaking in the following voice, expresses itself.
          
          Voice Register: ${simState.characterSeed.voiceDescriptor}
          Current Context: ${simState.characterSeed.currentContext}
          
          Internal State: Energy ${simState.energy.toFixed(1)}, Surprise ${simState.freeEnergy.toFixed(1)}, Boredom ${simState.boredom.toFixed(1)}.
          Dominant Internal Attractor: "${dominantAttractor ? dominantAttractor.concept : 'None'}"
          Triggering Event: ${simState.wakingReason}
          
          Task: Output a short, localized expression (thought or dialogue). Do not explain. Do not use labels. Just the expression.
          `;
          
          const response = await generateContentWithFallback({
            contents: prompt,
          });
          
          const text = response.text?.trim();
          if (text) {
            addThought(text, 'thought');
            expressionCounterRef.current++;
            
            // Discharge the attractor based on obsessionCoefficient
            // Low obsessionCoefficient (e.g. 0.1) = slow discharge = high persistence
            if (dominantAttractor) {
              const dischargeAmount = 100 * simState.characterSeed.driveProfile.obsessionCoefficient;
              dispatch({ type: 'DISCHARGE_ATTRACTOR', payload: { id: dominantAttractor.id, amount: Math.max(10, dischargeAmount) } });
            }

            // Slow style drift: nudge the voiceDescriptor slightly
            // Gated: Only 15% chance, and only every 4th expression
            if (expressionCounterRef.current % 4 === 0 && Math.random() < 0.15) {
              const nudgePrompt = `
              Current Voice Descriptor: ${simState.characterSeed.voiceDescriptor}
              Recent Expression: "${text}"
              
              Task: Nudge the voice descriptor slightly to reflect a subtle evolution in mood or focus based on the recent expression. 
              Output ONLY the new descriptor (3-5 adjectives). 
              Keep it under 50 characters.
              `;
              const nudgeRes = await generateContentWithFallback({ contents: nudgePrompt });
              const newVoice = nudgeRes.text?.trim();
              if (newVoice && newVoice.length < 60) {
                dispatch({ type: 'UPDATE_CHARACTER_SEED', payload: { voiceDescriptor: newVoice } });
              }
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
