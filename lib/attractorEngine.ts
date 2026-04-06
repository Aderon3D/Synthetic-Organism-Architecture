export interface Attractor {
  id: string;
  concept: string;
  pressure: number; // 0 to 100
  decayRate: number; // How fast pressure builds/decays
  type: 'EPISTEMIC' | 'PRAGMATIC' | 'SOCIAL';
}

export interface CharacterSeed {
  identity: string;
  currentContext: string;
  voiceDescriptor: string;
  driveProfile: {
    boredomRate: number;
    obsessionCoefficient: number;
    socialEnergyCost: number;
    stimulationCeiling: number;
  };
}

export const DEFAULT_CHARACTER_SEED: CharacterSeed = {
  identity: "Sherlock Holmes, London 1895",
  currentContext: "A study in Baker Street. A client has just left a strange pipe on the table.",
  voiceDescriptor: "Analytical, cold, precise, slightly impatient.",
  driveProfile: {
    boredomRate: 5.0,
    obsessionCoefficient: 0.1,
    socialEnergyCost: 2.0,
    stimulationCeiling: 85
  }
};

// Physics for attractors
export function calculateNextAttractors(
  currentAttractors: Attractor[],
  dt: number,
  boredom: number,
  driveProfile: CharacterSeed['driveProfile']
): Attractor[] {
  return currentAttractors.map(a => {
    // Pressure builds based on base decay rate and boredom
    // If obsessed, pressure builds faster or stays high
    let pressureDelta = a.decayRate * dt * (1 + boredom / 100);
    
    return {
      ...a,
      pressure: Math.min(100, Math.max(0, a.pressure + pressureDelta))
    };
  });
}
