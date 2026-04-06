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
  const isMountedRef = useRef(true);
  const simStateRef = useRef(simState);

  useEffect(() => {
    simStateRef.current = simState;
  }, [simState]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
        dispatch({ type: 'SET_WAKING_REASON', payload: 'HIGH_UNCERTAINTY' });
        dispatch({ type: 'SET_LLM_STATE', payload: 'WAKING' });
        addLog('High Free Energy detected. Waking Prefrontal Cortex.', 'system');
        addThought('Uncertainty high. Need input.', 'thought');
      } else if (simState.boredom > 80 && simState.energy > 40) {
        dispatch({ type: 'SET_WAKING_REASON', payload: 'HIGH_BOREDOM' });
        dispatch({ type: 'SET_LLM_STATE', payload: 'PLAYING_INIT' });
      }
    } else if (simState.llmState === 'PLAYING' && simState.boredom < 10) {
      dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
      dispatch({ type: 'SET_ACTIVE_TOY', payload: null });
      addLog('Stimulation sufficient. Returning to IDLE.', 'info');
      addThought('Curiosity satisfied for now.', 'thought');
    }
  }, [simState.energy, simState.freeEnergy, simState.boredom, simState.llmState, dispatch, addLog, addThought, setBrowserState]);

  // Stable WAKING transition
  useEffect(() => {
    if (simState.llmState === 'WAKING') {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          addLog('Prefrontal Cortex active. Initiating search.', 'system');
          dispatch({ type: 'SET_LLM_STATE', payload: 'FORAGING' });
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [simState.llmState, dispatch, addLog]);

  // Async LLM operations
  useEffect(() => {
    const runAsyncThought = async () => {
      if (isProcessingRef.current) return;
      
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Missing Gemini API Key");
        return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      // Summarize LSM state for prompt
      const state = simStateRef.current;
      const lsmSummary = state.lsmNodes.reduce((acc, val) => acc + val, 0) / state.lsmNodes.length;
      const lsmContext = `Sensory reservoir activity level: ${(lsmSummary * 100).toFixed(1)}% (LSM resonance is ${lsmSummary > 0.4 ? 'HIGH' : 'NORMAL'}).`;
      const persona = getPersonaInstruction(state);
      
      // Dual Memory Context
      const workingMemory = notepad.slice(-5).join(' | ') || 'Empty';
      const episodicMemory = state.episodicMemory.map(m => `T=${m.time}: [Stimulus: ${m.stimulus}] -> [Outcome: ${m.outcome}]`).join('\n') || 'No significant experiences recorded.';
      const wakingContext = state.wakingReason ? `Waking Reason: ${state.wakingReason}` : 'Reason: Spontaneous activation.';
      const lastPrediction = state.prediction ? `Previous Prediction: "${state.prediction}"` : 'No previous prediction.';

      const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
        let lastError;
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn();
          } catch (e) {
            lastError = e;
            const isNetworkError = e instanceof Error && (e.message.includes('fetch') || e.message.includes('Rpc failed') || e.message.includes('xhr'));
            if (isNetworkError && i < maxRetries - 1) {
              const delay = Math.pow(2, i) * 2000;
              addLog(`API connection issue. Retrying in ${delay/1000}s... (Attempt ${i+1}/${maxRetries})`, 'system');
              await new Promise(resolve => setTimeout(resolve, delay));
            } else {
              throw e;
            }
          }
        }
        throw lastError;
      };

      if (state.llmState === 'FORAGING') {
        isProcessingRef.current = true;
        addLog('LLM Active: Initiating Epistemic Foraging.', 'action');
        setBrowserState({ active: true, query: 'Thinking...', result: null });
        
        try {
          const prompt = `${persona}
          Current state: Energy ${state.energy.toFixed(1)}%, Uncertainty ${state.freeEnergy.toFixed(1)}%, Boredom ${state.boredom.toFixed(1)}%.
          ${lsmContext}
          ${wakingContext}
          ${lastPrediction}
          
          [DUAL MEMORY SYSTEM]
          1. Working Memory (Recent Facts): ${workingMemory}
          2. Episodic Memory (Past Experiences): 
          ${episodicMemory}

          Last external stimulus: "${lastStimulus || 'None'}".
          
          Task: You are uncertain and must search the web to understand your environment or the last stimulus.
          Provide your internal thought process, and the exact search query you want to type into your browser.
          Also, provide a "prediction" of what you expect to find.`;
          
          const response = await callWithRetry(() => ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  query: { type: Type.STRING },
                  prediction: { type: Type.STRING, description: "What you expect the search to reveal." }
                },
                required: ["thought", "query", "prediction"]
              }
            }
          }));
          
          const res = JSON.parse(response.text || '{}');
          
          if (isMountedRef.current && res.query) {
            setBrowserState({ active: true, query: res.query, result: "Searching..." });
            addThought(res.thought, 'thought');
            addThought(`[Browser] Search: "${res.query}"`, 'action');
            dispatch({ type: 'SET_PREDICTION', payload: res.prediction });
            
            setTimeout(() => {
              if (isMountedRef.current) {
                isProcessingRef.current = false;
                dispatch({ type: 'SET_LLM_STATE', payload: 'CONSOLIDATING' });
              }
            }, 2000);
          } else {
             isProcessingRef.current = false;
             if (isMountedRef.current) dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } catch (e) {
          console.error(e);
          addLog(`Search error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'alert');
          isProcessingRef.current = false;
          if (isMountedRef.current) {
            dispatch({ type: 'RESET_FREE_ENERGY' }); // Prevent loop
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        }
      }
      else if (state.llmState === 'CONSOLIDATING') {
        isProcessingRef.current = true;
        addLog('Uncertainty reduced. Consolidating new priors.', 'info');
        try {
          // STEP 1: Perform search (Grounding)
          const searchPrompt = `Search for information about: "${browserState.query}".`;
          const searchResponse = await callWithRetry(() => ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: searchPrompt,
            config: {
              tools: [{ googleSearch: {} }],
              toolConfig: { includeServerSideToolInvocations: true },
            }
          }));

          // Extract search result from grounding metadata
          let searchResult = "No concrete result found.";
          const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks && chunks.length > 0) {
             searchResult = chunks.map((c: any) => c.web?.title).filter(Boolean).join(", ");
             addLog(`Search successful: ${chunks.length} results found.`, 'info');
          } else {
             addLog(`Search returned no grounding metadata.`, 'alert');
          }

          // STEP 2: Process results into JSON
          const processPrompt = `${persona}
          Task: You recently searched for: "${browserState.query}".
          Search Results: ${searchResult}
          
          [DUAL MEMORY SYSTEM]
          1. Working Memory (Recent Facts): ${workingMemory}
          2. Episodic Memory (Past Experiences): 
          ${episodicMemory}
          
          Your Previous Prediction: "${state.prediction}"

          Based on the search results, provide your internal thought process.
          How much did the results surprise you compared to your prediction?
          Write a short, concise note (max 10 words) to your notepad (Working Memory).
          Rewrite your entire "Base Linguistic Style" to incorporate this new knowledge. Keep it under 15 words.
          Finally, summarize this entire event as a new "Episodic Memory" (Outcome).`;
          
          const processResponse = await callWithRetry(() => ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: processPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  note: { type: Type.STRING },
                  styleEvolution: { type: Type.STRING, description: "Your complete, updated Base Linguistic Style (max 15 words)." },
                  outcomeSummary: { type: Type.STRING, description: "A one-sentence summary of what you learned." },
                  predictionError: { type: Type.NUMBER, description: "A value from 0 to 100 representing how much the result differed from your prediction." }
                },
                required: ["thought", "note", "styleEvolution", "outcomeSummary", "predictionError"]
              }
            }
          }));

          const res = JSON.parse(processResponse.text || '{}');
          if (isMountedRef.current && res.note) {
            setNotepad(prev => [...prev, res.note]);
            setBrowserState(prev => ({ ...prev, result: searchResult }));
            
            // Update style
            if (res.styleEvolution) {
              dispatch({ type: 'SET_LINGUISTIC_STYLE', payload: res.styleEvolution });
              addLog(`Linguistic style evolved: ${res.styleEvolution}`, 'system');
            }

            // Update Free Energy based on prediction error
            if (res.predictionError !== undefined) {
              dispatch({ type: 'INJECT_SURPRISE', payload: res.predictionError - 50 }); // Adjust existing FE
            }

            // Add Episodic Memory
            dispatch({ 
              type: 'ADD_EPISODIC_MEMORY', 
              payload: {
                time: state.time,
                stimulus: lastStimulus || browserState.query,
                thought: res.thought,
                outcome: res.outcomeSummary
              }
            });

            addThought(res.thought, 'thought');
            addThought(`[Notepad] Write: "${res.note}"`, 'action');
            setBrowserState({ active: false, query: '', result: null });
            isProcessingRef.current = false;
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
            dispatch({ type: 'SET_WAKING_REASON', payload: null });
          }
        } catch (e) {
          console.error(e);
          if (isMountedRef.current) {
            dispatch({ type: 'RESET_FREE_ENERGY' }); // Prevent loop
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } finally {
          isProcessingRef.current = false;
        }
      }
      else if (state.llmState === 'PLAYING_INIT') {
        isProcessingRef.current = true;
        try {
          const prompt = `${persona}
          Task: You are extremely bored. Available toys: blocks, spinner, chimes.
          Provide your internal thought process on why you want to play, and choose a toy.`;
          
          const response = await callWithRetry(() => ai.models.generateContent({
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
          }));
          
          const res = JSON.parse(response.text || '{}');
          if (isMountedRef.current && res.toy) {
            addLog(`Boredom threshold reached. Engaging with toy: ${res.toy}`, 'info');
            addThought(res.thought, 'thought');
            addThought(`[Toy] Interact with ${res.toy}.`, 'action');
            isProcessingRef.current = false;
            dispatch({ type: 'SET_ACTIVE_TOY', payload: res.toy as ToyType });
            dispatch({ type: 'SET_LLM_STATE', payload: 'PLAYING' });
          } else if (isMountedRef.current) {
             isProcessingRef.current = false;
             dispatch({ type: 'RESET_BOREDOM' });
             dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } catch (e) {
          console.error(e);
          if (isMountedRef.current) {
            dispatch({ type: 'RESET_BOREDOM' }); // Prevent rapid-fire retry
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } finally {
          isProcessingRef.current = false;
        }
      }
      else if (state.llmState === 'PLAYING') {
        isProcessingRef.current = true;
        try {
          const toy = state.toyState.type;
          const toyData = JSON.stringify(state.toyState.data);
          const lastAction = state.toyState.lastAction || "None";
          const lastResult = state.toyState.lastResult || "Just started playing.";

          let availableActions: string[] = [];
          if (toy === 'blocks') availableActions = ['stack', 'balance', 'topple'];
          if (toy === 'spinner') availableActions = ['flick', 'steady', 'stop'];
          if (toy === 'chimes') availableActions = ['strike', 'dampen', 'listen'];

          const prompt = `${persona}
          Task: You are playing with your ${toy}.
          Current toy state: ${toyData}
          Last action: "${lastAction}"
          Last interaction result: "${lastResult}"
          ${lastPrediction}
          
          Available actions: ${availableActions.join(', ')}.
          
          Provide your internal thought process on what to do next, and choose an action.
          Also, provide a "prediction" of what you expect the result of this action to be.`;
          
          const response = await callWithRetry(() => ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  action: { type: Type.STRING, enum: availableActions },
                  prediction: { type: Type.STRING, description: "What you expect to happen after this action." }
                },
                required: ["thought", "action", "prediction"]
              }
            }
          }));
          
          const res = JSON.parse(response.text || '{}');
          if (isMountedRef.current && res.action) {
            dispatch({ type: 'TOY_ACTION', payload: { action: res.action } });
            dispatch({ type: 'SET_PREDICTION', payload: res.prediction });
            addThought(res.thought, 'thought');
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
      else if (state.llmState === 'SPONTANEOUS_THOUGHT') {
        isProcessingRef.current = true;
        try {
          const prompt = `${persona}
          Current state: Energy ${state.energy.toFixed(1)}%, Uncertainty ${state.freeEnergy.toFixed(1)}%, Boredom ${state.boredom.toFixed(1)}%.
          ${lsmContext}
          
          Task: You are experiencing a spontaneous burst of cognitive activity (LSM resonance). 
          You are not reacting to an external stimulus, but to your own internal state.
          Provide your internal thought process. What are you thinking about? 
          Choose a sub-goal: either search the web for something you're curious about, or decide to play with a toy.`;
          
          const response = await callWithRetry(() => ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  thought: { type: Type.STRING },
                  decision: { type: Type.STRING, enum: ["FORAGE", "PLAY"] },
                  query: { type: Type.STRING, description: "If decision is FORAGE, what is the query?" },
                  toy: { type: Type.STRING, enum: ["blocks", "spinner", "chimes"], description: "If decision is PLAY, which toy?" }
                },
                required: ["thought", "decision"]
              }
            }
          }));
          
          const res = JSON.parse(response.text || '{}');
          if (isMountedRef.current) {
            addThought(res.thought, 'thought');
            addLog(`Spontaneous thought: ${res.thought.slice(0, 50)}...`, 'info');
            
            if (res.decision === 'FORAGE' && res.query) {
              setBrowserState({ active: true, query: res.query, result: null });
              dispatch({ type: 'SET_LLM_STATE', payload: 'FORAGING' });
            } else if (res.decision === 'PLAY' && res.toy) {
              dispatch({ type: 'SET_ACTIVE_TOY', payload: res.toy as ToyType });
              dispatch({ type: 'SET_LLM_STATE', payload: 'PLAYING' });
            } else {
              dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
            }
          }
        } catch (e) {
          console.error(e);
          if (isMountedRef.current) {
            dispatch({ type: 'RESET_FREE_ENERGY' });
            dispatch({ type: 'SET_LLM_STATE', payload: 'IDLE' });
          }
        } finally {
          isProcessingRef.current = false;
        }
      }
    };

    runAsyncThought();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simState.llmState, addLog, addThought, dispatch, setBrowserState, setNotepad]);

}
