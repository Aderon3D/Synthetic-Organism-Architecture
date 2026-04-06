// lib/activeInference.ts

// Math helpers
export function normalize(vec: number[]): number[] {
  const sum = vec.reduce((a, b) => a + b, 0);
  return sum === 0 ? vec.map(() => 1 / vec.length) : vec.map(v => v / sum);
}

export function entropy(vec: number[]): number {
  return -vec.reduce((sum, p) => sum + (p > 1e-12 ? p * Math.log(p) : 0), 0);
}

export function klDivergence(q: number[], p: number[]): number {
  return q.reduce((sum, q_i, i) => {
    const p_i = p[i];
    if (q_i > 1e-12 && p_i > 1e-12) {
      return sum + q_i * Math.log(q_i / p_i);
    }
    return sum;
  }, 0);
}

export function softmax(vec: number[], temperature: number = 1.0): number[] {
  const maxVal = Math.max(...vec);
  const exps = vec.map(v => Math.exp((v - maxVal) / temperature));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sumExps);
}

// POMDP Generative Model Definition
// States (S): 0 = Safe/Boring, 1 = Engaged/Playful, 2 = Volatile/Surprising
// Observations (O): 0 = Boring/Static, 1 = Expected/Playful, 2 = Surprising/Anomalous
// Actions (U): 0 = Rest (Idle), 1 = Explore (Forage), 2 = Exploit (Play)

// A Matrix: P(o|s) - Observation Model
export const A = [
  [0.8, 0.1, 0.1], // O=0 (Boring) is highly likely in S=0
  [0.1, 0.8, 0.1], // O=1 (Expected) is highly likely in S=1
  [0.1, 0.1, 0.8]  // O=2 (Surprising) is highly likely in S=2
];

// B Matrix: P(s_t|s_{t-1}, u) - Transition Model
export const B = [
  // U=0 (Rest) - Tends to drift towards Safe/Boring
  [
    [0.8, 0.4, 0.2], // S_t=0
    [0.1, 0.4, 0.2], // S_t=1
    [0.1, 0.2, 0.6]  // S_t=2
  ],
  // U=1 (Explore) - Drives state towards Volatile/Surprising
  [
    [0.2, 0.1, 0.1],
    [0.3, 0.3, 0.1],
    [0.5, 0.6, 0.8]
  ],
  // U=2 (Exploit) - Drives state towards Engaged/Playful
  [
    [0.1, 0.2, 0.1],
    [0.8, 0.7, 0.4],
    [0.1, 0.1, 0.5]
  ]
];

// C Matrix: P(o) - Prior Preferences
// This is now generated dynamically based on boredom
export function getCMatrix(boredom: number): number[] {
  // If boredom is high (e.g. 100), prefers Expected (1) > Boring (0)
  // If boredom is low (e.g. 0), prefers Boring (0) > Expected (1)
  const boredomFactor = boredom / 100; // 0 to 1
  
  const preferExpected = 0.1 + (0.7 * boredomFactor); // 0.1 to 0.8
  const preferBoring = 0.8 - (0.7 * boredomFactor);   // 0.8 to 0.1
  const preferSurprising = 0.1;                       // Constant 0.1
  
  return [preferBoring, preferExpected, preferSurprising];
}

export interface ActiveInferenceResult {
  posterior: number[];
  vfe: number;
  efe: number[];
  action: number;
  actionProbs: number[];
}

export function stepActiveInference(
  prior: number[], 
  observation: number, 
  lastAction: number,
  boredom: number
): ActiveInferenceResult {
  
  // 1. Perception (State Inference)
  // Empirical prior: P(s_t | s_{t-1}, u_{t-1}) = B[lastAction] * prior
  const empiricalPrior = [
    B[lastAction][0][0] * prior[0] + B[lastAction][0][1] * prior[1] + B[lastAction][0][2] * prior[2],
    B[lastAction][1][0] * prior[0] + B[lastAction][1][1] * prior[1] + B[lastAction][1][2] * prior[2],
    B[lastAction][2][0] * prior[0] + B[lastAction][2][1] * prior[1] + B[lastAction][2][2] * prior[2]
  ];

  // Likelihood: P(o_t | s_t) = A[observation, :]
  const likelihood = [A[observation][0], A[observation][1], A[observation][2]];

  // Posterior: Q(s_t) \propto Likelihood * Empirical Prior
  const unnormalizedPosterior = [
    likelihood[0] * empiricalPrior[0],
    likelihood[1] * empiricalPrior[1],
    likelihood[2] * empiricalPrior[2]
  ];
  const posterior = normalize(unnormalizedPosterior);

  // 2. Variational Free Energy (VFE)
  // VFE = D_KL(Q(s) || P(s|o)) - log P(o)
  // Practically calculated as: sum_s Q(s) * log(Q(s) / (P(o|s) * P(s)))
  let vfe = 0;
  for (let i = 0; i < 3; i++) {
    const q = posterior[i];
    const p_o_s = likelihood[i];
    const p_s = empiricalPrior[i];
    if (q > 1e-12 && p_o_s > 1e-12 && p_s > 1e-12) {
      vfe += q * Math.log(q / (p_o_s * p_s));
    }
  }

  // 3. Action Selection (Epistemic Foraging)
  // Calculate Expected Free Energy (EFE) for each policy (action)
  const numActions = B.length;
  const efe = new Array(numActions).fill(0);

  for (let u = 0; u < numActions; u++) {
    // Expected state: Q(s_{t+1}|u) = B[u] * posterior
    const q_s_u = [
      B[u][0][0] * posterior[0] + B[u][0][1] * posterior[1] + B[u][0][2] * posterior[2],
      B[u][1][0] * posterior[0] + B[u][1][1] * posterior[1] + B[u][1][2] * posterior[2],
      B[u][2][0] * posterior[0] + B[u][2][1] * posterior[1] + B[u][2][2] * posterior[2]
    ];

    // Expected observation: P(o_{t+1}|u) = A * Q(s_{t+1}|u)
    const p_o_u = [
      A[0][0] * q_s_u[0] + A[0][1] * q_s_u[1] + A[0][2] * q_s_u[2],
      A[1][0] * q_s_u[0] + A[1][1] * q_s_u[1] + A[1][2] * q_s_u[2],
      A[2][0] * q_s_u[0] + A[2][1] * q_s_u[1] + A[2][2] * q_s_u[2]
    ];

    // Ambiguity (Epistemic value): Expected entropy of A given Q(s|u)
    let ambiguity = 0;
    for (let s = 0; s < 3; s++) {
      const a_col = [A[0][s], A[1][s], A[2][s]];
      ambiguity += q_s_u[s] * entropy(a_col);
    }

    // Risk (Pragmatic value): KL(P(o|u) || C)
    const C = getCMatrix(boredom);
    const risk = klDivergence(p_o_u, C);

    // EFE = Ambiguity + Risk
    // Add a small inertia term to prefer the last action and prevent rapid oscillation
    const inertia = (u === lastAction) ? -0.2 : 0;
    efe[u] = ambiguity + risk + inertia;
  }

  // Select action that minimizes EFE (Softmax over negative EFE for probabilities)
  const negEFE = efe.map(val => -val);
  const actionProbs = softmax(negEFE, 0.2); // Lower temperature for sharper distribution
  
  // Deterministic action selection (argmax) to prevent random oscillation in the UI
  let action = 0;
  let maxProb = -1;
  for (let i = 0; i < actionProbs.length; i++) {
    if (actionProbs[i] > maxProb) {
      maxProb = actionProbs[i];
      action = i;
    }
  }

  return { posterior, vfe, efe, action, actionProbs };
}
