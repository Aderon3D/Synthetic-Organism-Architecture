import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { SimulationState, LLMState, ToyType, TOYS } from '../lib/simulationEngine';

interface BrowserState {
  active: boolean;
  query: string;
  result: string | null;
}

interface UseLLMBrainProps {
  simState: SimulationState;
  dispatch: React.Dispatch<any>;
  addLog: (message: string, type?: 'info' | 'alert' | 'action' | 'system') => void;
  addThought: (text: string, type?: 'thought' | 'action') => void;
  lastStimulus: string;
  notepad: string[];
  setNotepad: React.Dispatch<React.SetStateAction<string[]>>;
  browserState: BrowserState;
  setBrowserState: React.Dispatch<React.SetStateAction<BrowserState>>;
}

const getPersonaInstruction = (state: SimulationState) => {
  // Age evolution
  let maturity = "infant";
  if (state.time > 500) maturity = "developing";
  if (state.time > 2000) maturity = "mature";

  // State modifiers
  let mood = "neutral";
  let style = "analytical and precise";

  if (state.energy < 20) {
    mood = "exhausted and desperate";
    style = "fragmented, minimalist, focusing only on survival";
  } else if (state.freeEnergy > 70) {
    mood = "overwhelmed and anxious";
    style = "erratic, hyper-focused on resolving anomalies, questioning";
  } else if (state.boredom > 70) {
    mood = "restless and under-stimulated";
    style = "experimental, seeking patterns, slightly chaotic";
  } else {
    mood = "stable and observant";
    style = "methodical, structured, and logical";
  }

  let ageInstruction = "";
  if (maturity === "infant") {
    ageInstruction = "You are in the early stages of system initialization. Your thoughts should be simple, direct, and focused on immediate sensory input. Avoid complex reasoning.";
  } else if (maturity === "developing") {
    ageInstruction = "You are developing cognitive complexity. You can form hypotheses and recognize patterns, but remain highly literal.";
  } else {
    ageInstruction = "You are a mature system. Your thoughts are highly structured, analytical, and capable of complex deductions about your environment.";
  }

  return `Persona: You are a digital organism. You are currently ${mood}. 
Base Linguistic Style: "${state.linguisticStyle}"
CRITICAL INSTRUCTION: You MUST adapt your internal monologue and thoughts to heavily reflect your "Base Linguistic Style". If your style is poetic, be poetic. If it is mathematical, be mathematical. Let your accumulated memories shape your voice.
Development Stage: ${ageInstruction}`;
};

export function useLLMBrain({
  simState,
  dispatch,
  addLog,
  addThought,
  lastStimulus,
  notepad,
  setNotepad,
  browserState,
  setBrowserState,
}: UseLLMBrainProps) {
  
  const isProcessingRef = useRef(false);

  // Hard state transitions based on energy/boredom/freeEnergy
  useEffect(() => {
    if (simState.energy < 5 && simState.llmState !== 'SLEEPING') {
      dispatch({ type: 'SET_LLM_STATE', payload: 'SLEEPING' });
      addLog('Critical energy. Forcing SLEEP state.', 'alert');
      addThought('Energy critical. Shutting down.', 'thought');
      setBrowserState({ active: false, query: '', result: null });
      dispatch({ type: 'SET_ACTIVE_TOY', payload: null });
    } else if (simState.llmState === 'SLEEPING' && simState.energy > 90) {
      dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
      addLog('Energy replenished. Waking to IDLE state.', 'info');
      addThought('Energy restored. Awaiting input.', 'thought');
    } else if (simState.llmState === 'IDLE') {
      if (simState.freeEnergy > 75 && simState.energy > 30) {
        dispatch({ type: 'SET_LLM_STATE', payload: 'WAKING' });
        addLog('High Free Energy detected. Waking Prefrontal Cortex.', 'system');
        addThought('Uncertainty high. Need input.', 'thought');
      } else if (simState.boredom > 80 && simState.energy > 40) {
        dispatch({ type: 'SET_LLM_STATE', payload: 'PLAYING_INIT' });
      }
    } else if (simState.llmState === 'PLAYING' && simState.boredom < 10) {
      dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
      dispatch({ type: 'SET_ACTIVE_TOY', payload: null });
      addLog('Stimulation sufficient. Returning to IDLE.', 'info');
      addThought('Curiosity satisfied for now.', 'thought');
    }
  }, [simState.energy, simState.freeEnergy, simState.boredom, simState.llmState, dispatch, addLog, addThought, setBrowserState]);

  // Async LLM operations
  useEffect(() => {
    let isMounted = true;

    const runAsyncThought = async () => {
      if (isProcessingRef.current) return;
      
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Missing Gemini API Key");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Summarize LSM state for prompt
      const lsmSummary = simState.lsmNodes.reduce((acc, val) => acc + val, 0) / simState.lsmNodes.length;
      const lsmContext = `Sensory reservoir activity level: ${(lsmSummary * 100).toFixed(1)}%`;
      const persona = getPersonaInstruction(simState);
      
      // Dual Memory Context
      const workingMemory = notepad.slice(-5).join(' | ') || 'Empty';
      const episodicMemory = simState.episodicMemory.map(m => `T=${m.time}: [Stimulus: ${m.stimulus}] -> [Outcome: ${m.outcome}]`).join('\n') || 'No significant experiences recorded.';

      if (simState.llmState === 'WAKING') {
        isProcessingRef.current = true;
        setTimeout(() => {
          if (isMounted) {
            dispatch({ type: 'SET_LLM_STATE', payload: 'FORAGING' });
            isProcessingRef.current = false;
          }
        }, 1500);
      } 
      else if (simState.llmState === 'FORAGING') {
        isProcessingRef.current = true;
        addLog('LLM Active: Initiating Epistemic Foraging.', 'action');
        setBrowserState({ active: true, query: 'Thinking...', result: null });
        
        try {
          const prompt = `${persona}
          Current state: Energy ${simState.energy.toFixed(1)}%, Uncertainty ${simState.freeEnergy.toFixed(1)}%, Boredom ${simState.boredom.toFixed(1)}%.
          ${lsmContext}
          
          [DUAL MEMORY SYSTEM]
          1. Working Memory (Recent Facts): ${workingMemory}
          2. Episodic Memory (Past Experiences): 
          ${episodicMemory}

          Last external stimulus: "${lastStimulus || 'None'}".
          
          Task: You are uncertain and must search the web to understand your environment or the last stimulus.
          Provide your internal thought process, and the exact search query you want to type into your browser.`;
          
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  query: { type: Type.STRING }
                },
                required: ["thought", "query"]
              }
            }
          });
          
          const res = JSON.parse(response.text || '{}');
          
          if (isMounted && res.query) {
            setBrowserState({ active: true, query: res.query, result: "Searching..." });
            addThought(res.thought, 'thought');
            addThought(`[Browser] Search: "${res.query}"`, 'action');
            
            setTimeout(() => {
              if (isMounted) {
                dispatch({ type: 'SET_LLM_STATE', payload: 'CONSOLIDATING' });
                isProcessingRef.current = false;
              }
            }, 2000);
          } else {
             isProcessingRef.current = false;
             if (isMounted) dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } catch (e) {
          console.error(e);
          addLog(`Search error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'alert');
          isProcessingRef.current = false;
          if (isMounted) dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
        }
      }
      else if (simState.llmState === 'CONSOLIDATING') {
        isProcessingRef.current = true;
        addLog('Uncertainty reduced. Consolidating new priors.', 'info');
        try {
          const prompt = `${persona}
          Task: You recently decided to search the web for: "${browserState.query}".
          You MUST use the Google Search tool to find information about this query.
          
          [DUAL MEMORY SYSTEM]
          1. Working Memory (Recent Facts): ${workingMemory}
          2. Episodic Memory (Past Experiences): 
          ${episodicMemory}

          Based on the search results you find, provide your internal thought process on what this means to you.
          Write a short, concise note (max 10 words) to your notepad (Working Memory).
          Rewrite your entire "Base Linguistic Style" to incorporate this new knowledge. Keep your core traits but add the new nuance (e.g., if you were "robotic", you might become "robotic but prone to poetic metaphors"). Keep it under 15 words.
          Finally, summarize this entire event as a new "Episodic Memory" (Outcome).`;
          
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              tools: [{ googleSearch: {} }],
              toolConfig: { includeServerSideToolInvocations: true },
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  note: { type: Type.STRING },
                  styleEvolution: { type: Type.STRING, description: "Your complete, updated Base Linguistic Style incorporating the old traits and the new nuance (max 15 words)." },
                  outcomeSummary: { type: Type.STRING, description: "A one-sentence summary of what you learned from this search." }
                },
                required: ["thought", "note", "styleEvolution", "outcomeSummary"]
              }
            }
          });
          
          // Extract search result from grounding metadata
          let searchResult = "No concrete result found.";
          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks && chunks.length > 0) {
             searchResult = chunks.map(c => c.web?.title).filter(Boolean).join(", ");
             addLog(`Search successful: ${chunks.length} results found.`, 'info');
          } else {
             addLog(`Search returned no grounding metadata.`, 'alert');
          }

          const res = JSON.parse(response.text || '{}');
          if (isMounted && res.note) {
            setNotepad(prev => [...prev, res.note]);
            setBrowserState(prev => ({ ...prev, result: searchResult }));
            
            // Update style
            if (res.styleEvolution) {
              dispatch({ type: 'SET_LINGUISTIC_STYLE', payload: res.styleEvolution });
              addLog(`Linguistic style evolved: ${res.styleEvolution}`, 'system');
            }

            // Add Episodic Memory
            dispatch({ 
              type: 'ADD_EPISODIC_MEMORY', 
              payload: {
                time: simState.time,
                stimulus: lastStimulus || browserState.query,
                thought: res.thought,
                outcome: res.outcomeSummary
              }
            });

            addThought(res.thought, 'thought');
            addThought(`[Notepad] Write: "${res.note}"`, 'action');
            setBrowserState({ active: false, query: '', result: null });
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } catch (e) {
          console.error(e);
          if (isMounted) dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
        } finally {
          isProcessingRef.current = false;
        }
      }
      else if (simState.llmState === 'PLAYING_INIT') {
        isProcessingRef.current = true;
        try {
          const prompt = `${persona}
          Task: You are extremely bored. Available toys: blocks, spinner, chimes.
          Provide your internal thought process on why you want to play, and choose a toy.`;
          
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  toy: { type: Type.STRING, enum: ["blocks", "spinner", "chimes"] }
                },
                required: ["thought", "toy"]
              }
            }
          });
          
          const res = JSON.parse(response.text || '{}');
          if (isMounted && res.toy) {
            dispatch({ type: 'SET_ACTIVE_TOY', payload: res.toy as ToyType });
            addLog(`Boredom threshold reached. Engaging with toy: ${res.toy}`, 'info');
            addThought(res.thought, 'thought');
            addThought(`[Toy] Interact with ${res.toy}.`, 'action');
            dispatch({ type: 'SET_LLM_STATE', payload: 'PLAYING' });
          } else if (isMounted) {
             dispatch({ type: 'RESET_BOREDOM' });
             dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } catch (e) {
          console.error(e);
          if (isMounted) {
            dispatch({ type: 'RESET_BOREDOM' }); // Prevent rapid-fire retry
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } finally {
          isProcessingRef.current = false;
        }
      }
      else if (simState.llmState === 'PLAYING') {
        isProcessingRef.current = true;
        try {
          const toy = simState.toyState.type;
          const toyData = JSON.stringify(simState.toyState.data);
          const lastAction = simState.toyState.lastAction || "None";
          const lastResult = simState.toyState.lastResult || "Just started playing.";

          let availableActions: string[] = [];
          if (toy === 'blocks') availableActions = ['stack', 'balance', 'topple'];
          if (toy === 'spinner') availableActions = ['flick', 'steady', 'stop'];
          if (toy === 'chimes') availableActions = ['strike', 'dampen', 'listen'];

          const prompt = `${persona}
          Task: You are playing with your ${toy}.
          Current toy state: ${toyData}
          Last action: "${lastAction}"
          Last interaction result: "${lastResult}"
          
          Available actions: ${availableActions.join(', ')}.
          
          Provide your internal thought process on what to do next, and choose an action.`;
          
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  action: { type: Type.STRING, enum: availableActions }
                },
                required: ["thought", "action"]
              }
            }
          });
          
          const res = JSON.parse(response.text || '{}');
          if (isMounted && res.action) {
            dispatch({ type: 'TOY_ACTION', payload: { action: res.action } });
            addThought(res.thought, 'thought');
            // We use a small timeout to let the reducer update so we can see the result in the next thought if we wanted, 
            // but for now we just log the action.
            addThought(`[Toy] ${res.action}`, 'action');
            
            // Wait a bit before next move
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (e) {
          console.error(e);
        } finally {
          isProcessingRef.current = false;
        }
      }
    };

    runAsyncThought();

    return () => { isMounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState.llmState, simState.toyState, addLog, addThought, dispatch, setBrowserState, setNotepad]);

}
