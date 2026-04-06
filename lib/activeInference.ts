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
// States (S): 0 = Safe/Known, 1 = Volatile/Novel
// Observations (O): 0 = Boring/Static, 1 = Expected/Playful, 2 = Surprising/Anomalous
// Actions (U): 0 = Rest (Idle), 1 = Explore (Forage), 2 = Exploit (Play)

// A Matrix: P(o|s) - Observation Model
export const A = [
  [0.7, 0.1], // O=0 (Boring)
  [0.2, 0.2], // O=1 (Expected)
  [0.1, 0.7]  // O=2 (Surprising)
];

// B Matrix: P(s_t|s_{t-1}, u) - Transition Model
export const B = [
  // U=0 (Rest) - Tends to stay in current state, slight drift to Safe
  [
    [0.9, 0.2], // S_t=0
    [0.1, 0.8]  // S_t=1
  ],
  // U=1 (Explore) - Drives state towards Volatile/Novel
  [
    [0.2, 0.1],
    [0.8, 0.9]
  ],
  // U=2 (Exploit) - Drives state towards Safe/Known
  [
    [0.8, 0.7],
    [0.2, 0.3]
  ]
];

// C Matrix: P(o) - Prior Preferences
// Prefers Expected (1) > Boring (0) > Surprising (2)
export const C = [0.3, 0.6, 0.1];

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
  lastAction: number
): ActiveInferenceResult {
  
  // 1. Perception (State Inference)
  // Empirical prior: P(s_t | s_{t-1}, u_{t-1}) = B[lastAction] * prior
  const empiricalPrior = [
    B[lastAction][0][0] * prior[0] + B[lastAction][0][1] * prior[1],
    B[lastAction][1][0] * prior[0] + B[lastAction][1][1] * prior[1]
  ];

  // Likelihood: P(o_t | s_t) = A[observation, :]
  const likelihood = [A[observation][0], A[observation][1]];

  // Posterior: Q(s_t) \propto Likelihood * Empirical Prior
  const unnormalizedPosterior = [
    likelihood[0] * empiricalPrior[0],
    likelihood[1] * empiricalPrior[1]
  ];
  const posterior = normalize(unnormalizedPosterior);

  // 2. Variational Free Energy (VFE)
  // VFE = D_KL(Q(s) || P(s|o)) - log P(o)
  // Practically calculated as: sum_s Q(s) * log(Q(s) / (P(o|s) * P(s)))
  let vfe = 0;
  for (let i = 0; i < 2; i++) {
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
      B[u][0][0] * posterior[0] + B[u][0][1] * posterior[1],
      B[u][1][0] * posterior[0] + B[u][1][1] * posterior[1]
    ];

    // Expected observation: P(o_{t+1}|u) = A * Q(s_{t+1}|u)
    const p_o_u = [
      A[0][0] * q_s_u[0] + A[0][1] * q_s_u[1],
      A[1][0] * q_s_u[0] + A[1][1] * q_s_u[1],
      A[2][0] * q_s_u[0] + A[2][1] * q_s_u[1]
    ];

    // Ambiguity (Epistemic value): Expected entropy of A given Q(s|u)
    let ambiguity = 0;
    for (let s = 0; s < 2; s++) {
      const a_col = [A[0][s], A[1][s], A[2][s]];
      ambiguity += q_s_u[s] * entropy(a_col);
    }

    // Risk (Pragmatic value): KL(P(o|u) || C)
    const risk = klDivergence(p_o_u, C);

    // EFE = Ambiguity + Risk
    efe[u] = ambiguity + risk;
  }

  // Select action that minimizes EFE (Softmax over negative EFE)
  // Temperature controls exploration/exploitation
  const negEFE = efe.map(val => -val);
  const actionProbs = softmax(negEFE, 0.5); 
  
  // Sample action based on probabilities
  const rand = Math.random();
  let cumulativeProb = 0;
  let action = 0;
  for (let i = 0; i < actionProbs.length; i++) {
    cumulativeProb += actionProbs[i];
    if (rand <= cumulativeProb) {
      action = i;
      break;
    }
  }

  return { posterior, vfe, efe, action, actionProbs };
}
