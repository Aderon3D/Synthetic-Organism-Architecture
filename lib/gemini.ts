import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });

const PRIMARY_MODEL = "gemini-3-flash-preview";
const BACKUP_MODEL = "gemini-3.1-flash-lite-preview";
const TERTIARY_MODEL = "gemini-2.5-pro";
const QUATERNARY_MODEL = "gemini-2.5-flash";
const QUINARY_MODEL = "gemini-2.5-flash-lite";
const EXHAUSTION_KEY = "gemini_model_exhaustion";

interface ExhaustionState {
  [model: string]: number; // timestamp
}

function getExhaustionState(): ExhaustionState {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(EXHAUSTION_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

function saveExhaustionState(state: ExhaustionState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EXHAUSTION_KEY, JSON.stringify(state));
}

function isModelExhausted(model: string): boolean {
  const state = getExhaustionState();
  const timestamp = state[model];
  if (!timestamp) return false;
  
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  if (now - timestamp > twentyFourHours) {
    // Reset exhaustion after 24 hours
    const newState = { ...state };
    delete newState[model];
    saveExhaustionState(newState);
    return false;
  }
  
  return true;
}

function markModelExhausted(model: string) {
  const state = getExhaustionState();
  state[model] = Date.now();
  saveExhaustionState(state);
}

export async function generateContentWithFallback(
  params: Omit<GenerateContentParameters, 'model'>
): Promise<GenerateContentResponse> {
  const modelsToTry = [
    PRIMARY_MODEL, 
    BACKUP_MODEL, 
    TERTIARY_MODEL, 
    QUATERNARY_MODEL, 
    QUINARY_MODEL
  ];
  let lastError: any = null;

  for (const model of modelsToTry) {
    if (isModelExhausted(model)) {
      console.warn(`Model ${model} is currently marked as exhausted. Skipping.`);
      continue;
    }

    try {
      const response = await ai.models.generateContent({
        ...params,
        model,
      });
      return response;
    } catch (error: any) {
      lastError = error;
      
      // Check for 429 Resource Exhausted
      const errorStr = JSON.stringify(error);
      if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        console.error(`Model ${model} exhausted. Marking for 24h fallback.`);
        markModelExhausted(model);
        // Continue to next model in loop
      } else {
        // For other errors, rethrow immediately
        throw error;
      }
    }
  }

  throw lastError || new Error("All Gemini models exhausted or unavailable.");
}
