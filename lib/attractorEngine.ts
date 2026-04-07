export interface Attractor {
  id: string;
  concept: string;
  pressure: number; // 0 to 100
  buildRate: number; // How fast pressure builds
  type: 'EPISTEMIC' | 'PRAGMATIC' | 'SOCIAL';
}

export interface CharacterSeed {
  identity: string;
  currentContext: string;
  voiceDescriptor: string;
  driveProfile: {
    boredomRate: number;
    obsessionCoefficient: number; // Low = high persistence (slow decay)
    socialEnergyCost: number;
    stimulationCeiling: number;
  };
}

export const DEFAULT_CHARACTER_SEED: CharacterSeed = {
  identity: "A blank slate cognitive entity.",
  currentContext: "A nicely decorated wooden waiting room. The only interesting objects are the toys on the central table.",
  voiceDescriptor: "Neutral, observant, calm, literal.",
  driveProfile: {
    boredomRate: 3.0,
    obsessionCoefficient: 0.5, // Balanced focus
    socialEnergyCost: 1.0,
    stimulationCeiling: 75
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
    // 1. Pressure build (driven by boredom and base build rate)
    const build = a.buildRate * dt * (1 + boredom / 100);
    
    // 2. Natural decay (driven by obsessionCoefficient)
    // Low obsessionCoefficient (e.g. 0.1) = slow decay = high persistence
    const baseDecay = 1.0; // Base units per second
    const decay = baseDecay * driveProfile.obsessionCoefficient * dt;
    
    return {
      ...a,
      pressure: Math.min(100, Math.max(0, a.pressure + build - decay))
    };
  });
}
