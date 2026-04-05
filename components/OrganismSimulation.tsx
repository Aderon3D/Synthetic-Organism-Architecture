'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx } from 'clsx';
import { 
  Activity, 
  Brain, 
  Zap, 
  Database, 
  Clock, 
  Play, 
  Pause, 
  FastForward, 
  StepForward, 
  AlertTriangle,
  Terminal,
  Globe,
  Send,
  Search,
  PenTool,
  Gamepad2,
  MessageSquare
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

import { 
  LLMState, 
  HistoryPoint, 
  LogEntry, 
  ThoughtEntry, 
  WorldEvent, 
  TICK_RATES, 
  MAX_HISTORY, 
  MAX_LOGS, 
  MAX_THOUGHTS, 
  MAX_WORLD_EVENTS,
  ToyType 
} from '../lib/simulationEngine';
import { useSimulationLoop } from '../hooks/useSimulationLoop';
import { useLLMBrain } from '../hooks/useLLMBrain';

// --- Main Component ---

export default function OrganismSimulation() {
  const {
    simState,
    dispatch,
    tickRate,
    setTickRate,
    isPaused,
    setIsPaused,
    tick
  } = useSimulationLoop(TICK_RATES.REALTIME);
  
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [thoughts, setThoughts] = useState<ThoughtEntry[]>([]);
  const [worldEvents, setWorldEvents] = useState<WorldEvent[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [lastStimulus, setLastStimulus] = useState('');
  
  // Virtual World State
  const [notepad, setNotepad] = useState<string[]>([]);
  const [browserState, setBrowserState] = useState<{ active: boolean, query: string, result: string | null }>({ active: false, query: '', result: null });
  const [activeTab, setActiveTab] = useState<'logs' | 'memory'>('logs');

  const logIdCounter = useRef(0);
  const thoughtIdCounter = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  const worldEventsEndRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(simState.time);

  useEffect(() => {
    timeRef.current = simState.time;
  }, [simState.time]);

  // --- Actions ---

  const writeToServerLog = useCallback((data: any) => {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(console.error);
  }, []);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => {
      const newLogs = [...prev, { id: logIdCounter.current++, time: timeRef.current, message, type }];
      if (newLogs.length > MAX_LOGS) return newLogs.slice(newLogs.length - MAX_LOGS);
      return newLogs;
    });
    writeToServerLog({ category: 'LOG', time: timeRef.current, type, message });
  }, [writeToServerLog]);

  const addThought = useCallback((text: string, type: ThoughtEntry['type'] = 'thought') => {
    setThoughts(prev => {
      const newThoughts = [...prev, { id: thoughtIdCounter.current++, time: timeRef.current, text, type }];
      if (newThoughts.length > MAX_THOUGHTS) return newThoughts.slice(newThoughts.length - MAX_THOUGHTS);
      return newThoughts;
    });
    writeToServerLog({ category: 'THOUGHT', time: timeRef.current, type, text });
  }, [writeToServerLog]);

  useLLMBrain({
    simState,
    dispatch,
    addLog,
    addThought,
    lastStimulus,
    notepad,
    setNotepad,
    browserState,
    setBrowserState,
  });

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thoughts]);

  useEffect(() => {
    worldEventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [worldEvents]);

  // Initial log
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      addLog('System initialized. Brainstem active.', 'system');
      addLog('Liquid State Machine reservoir instantiated.', 'system');
      addThought('Awareness online. Blank slate.', 'thought');
      hasInitialized.current = true;
    }
  }, [addLog, addThought]);

  useEffect(() => {
    setHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].time === simState.time) {
        return prev;
      }
      const newHistory = [...prev, { 
        time: simState.time, 
        energy: simState.energy, 
        freeEnergy: simState.freeEnergy,
        boredom: simState.boredom
      }];
      if (newHistory.length > MAX_HISTORY) return newHistory.slice(newHistory.length - MAX_HISTORY);
      return newHistory;
    });
  }, [simState.time, simState.energy, simState.freeEnergy, simState.boredom]);

  // --- User Interactions ---

  const injectSurprise = () => {
    dispatch({ type: 'INJECT_SURPRISE', payload: 60 });
    addLog('EXTERNAL INJECTION: Massive sensory anomaly detected. Uncertainty spiking!', 'alert');
  };

  const handleSendStimulus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const stimulus = inputValue.trim();

    setWorldEvents(prev => {
      const newEvents = [...prev, { 
        id: Date.now(), 
        time: simState.time, 
        source: 'user' as const, 
        content: stimulus 
      }];
      if (newEvents.length > MAX_WORLD_EVENTS) return newEvents.slice(newEvents.length - MAX_WORLD_EVENTS);
      return newEvents;
    });

    writeToServerLog({ category: 'WORLD_EVENT', time: simState.time, source: 'user', content: stimulus });

    dispatch({ type: 'INJECT_SURPRISE', payload: 40 });

    setLastStimulus(stimulus);
    setInputValue('');
    addLog(`Sensory input received: "${stimulus}"`, 'info');
  };

  const drainEnergy = () => {
    dispatch({ type: 'DRAIN_ENERGY', payload: 50 });
    addLog('EXTERNAL INJECTION: Metabolic drain applied.', 'alert');
  };

  // --- Render Helpers ---

  const getLlmStateColor = (state: LLMState) => {
    switch (state) {
      case 'SLEEPING': return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
      case 'IDLE': return 'text-neutral-400 border-neutral-400/30 bg-neutral-400/10';
      case 'WAKING': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
      case 'FORAGING': return 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10';
      case 'CONSOLIDATING': return 'text-purple-400 border-purple-400/30 bg-purple-400/10';
      case 'PLAYING_INIT': return 'text-pink-400 border-pink-400/30 bg-pink-400/10';
      case 'PLAYING': return 'text-pink-400 border-pink-400/30 bg-pink-400/10';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-400" />
            Synthetic Organism Architecture
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Continuous ODEs + Active Inference + Reservoir Computing + LLM
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 bg-neutral-900/50 p-1.5 rounded-lg border border-neutral-800">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`p-2 rounded-md transition-colors ${isPaused ? 'bg-amber-500/20 text-amber-400' : 'hover:bg-neutral-800 text-neutral-400'}`}
            title={isPaused ? "Play" : "Pause"}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-1" />
          <button 
            onClick={() => { setTickRate(TICK_RATES.REALTIME); setIsPaused(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tickRate === TICK_RATES.REALTIME && !isPaused ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-neutral-800 text-neutral-400'}`}
          >
            1x
          </button>
          <button 
            onClick={() => { setTickRate(TICK_RATES.FAST); setIsPaused(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tickRate === TICK_RATES.FAST && !isPaused ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-neutral-800 text-neutral-400'}`}
          >
            5x
          </button>
          <button 
            onClick={() => { setTickRate(TICK_RATES.TURBO); setIsPaused(false); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${tickRate === TICK_RATES.TURBO && !isPaused ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-neutral-800 text-neutral-400'}`}
          >
            <FastForward className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-1" />
          <button 
            onClick={() => { setIsPaused(true); tick(); }}
            className="p-2 hover:bg-neutral-800 text-neutral-400 rounded-md transition-colors"
            title="Step Forward"
          >
            <StepForward className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Core Systems */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Top Row: Brainstem & LLM */}
          <div className="grid grid-cols-1 gap-6">
            
            {/* Brainstem (Clock & Metabolism) */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Brainstem & Metabolism
                </h2>
                <span className="text-xs font-mono text-neutral-500">T={simState.time}</span>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-400">Virtual ATP (Energy)</span>
                    <span className="font-mono text-emerald-400">{simState.energy.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${simState.energy}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Manages continuous ODE updates and metabolic constraints. Energy depletes during high-level cognitive tasks and replenishes during sleep states.
                </p>
                <div className="pt-2">
                  <button 
                    onClick={drainEnergy}
                    className="text-xs px-3 py-1.5 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-md text-neutral-400 transition-colors"
                  >
                    Force Energy Drain
                  </button>
                </div>
              </div>
            </section>

            {/* Prefrontal Cortex (LLM) */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/20 to-indigo-500/5" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  Prefrontal Cortex (LLM)
                </h2>
              </div>
              
              <div className="flex flex-col items-center justify-center py-2">
                <motion.div 
                  className={`px-4 py-2 rounded-full border text-sm font-medium tracking-wide transition-colors duration-500 ${getLlmStateColor(simState.llmState)}`}
                  layout
                >
                  {simState.llmState}
                </motion.div>
                
                <div className="mt-6 text-center">
                  <p className="text-xs text-neutral-500 leading-relaxed max-w-[250px]">
                    {simState.llmState === 'SLEEPING' && "Offline. Conserving metabolic energy."}
                    {simState.llmState === 'IDLE' && "Standby mode. Monitoring limbic signals."}
                    {simState.llmState === 'WAKING' && "Booting context window. Preparing for inference."}
                    {simState.llmState === 'FORAGING' && "Executing epistemic foraging to reduce Uncertainty."}
                    {simState.llmState === 'CONSOLIDATING' && "Updating priors and writing to long-term memory."}
                    {simState.llmState === 'PLAYING_INIT' && "Boredom critical. Selecting stimulation strategy."}
                    {simState.llmState === 'PLAYING' && "Engaged in play to reduce boredom."}
                  </p>
                </div>

                <div className="mt-6 w-full bg-neutral-950 rounded-lg p-3 border border-neutral-800">
                  <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1 text-left">Current Linguistic Style</h3>
                  <p className="text-xs text-indigo-300 italic text-left">"{simState.linguisticStyle}"</p>
                </div>
              </div>
            </section>
          </div>

          {/* Middle Row: Active Inference & LSM */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Surprise / Uncertainty */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500/20 to-rose-500/5" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  Surprise / Uncertainty
                </h2>
                <span className="text-xs font-mono text-rose-400">{simState.freeEnergy.toFixed(1)} %</span>
              </div>
              
              <div className="h-[120px] w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <YAxis domain={[0, 100]} hide />
                    <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Line 
                      type="monotone" 
                      dataKey="freeEnergy" 
                      stroke="#fb7185" 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-neutral-500 max-w-[200px]">
                  Minimizing uncertainty. Spikes trigger LLM foraging.
                </p>
                <button 
                  onClick={injectSurprise}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 rounded-md transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Inject Surprise
                </button>
              </div>
            </section>

            {/* Liquid State Machine */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/20 to-cyan-500/5" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Liquid State Machine
                </h2>
              </div>
              
              <div className="grid grid-cols-8 gap-1 p-2 bg-neutral-950 rounded-lg border border-neutral-800">
                {simState.lsmNodes.map((val, i) => (
                  <motion.div
                    key={i}
                    className="aspect-square rounded-sm"
                    style={{
                      backgroundColor: `rgba(34, 211, 238, ${val})`, // cyan-400
                    }}
                    animate={{ opacity: val * 2 }}
                    transition={{ duration: 0.1 }}
                  />
                ))}
              </div>
              
              <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
                Continuous-time reservoir computing. Processes ambient data streams into temporal ripples, providing rich context to the LLM without discrete tokenization.
              </p>
            </section>

          </div>
        </div>

        {/* Middle Column: Virtual World */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col h-full overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/20 to-amber-500/5" />
            <div className="p-3 border-b border-neutral-800 bg-neutral-950/50 flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-mono text-neutral-300 uppercase tracking-wider">Virtual World</h2>
            </div>
            
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
              
              {/* Browser Tool */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="bg-neutral-900 border-b border-neutral-800 p-2 flex items-center gap-2">
                  <Search className="w-3 h-3 text-neutral-500" />
                  <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-[10px] font-mono text-neutral-400 truncate">
                    {browserState.active ? browserState.query : 'idle'}
                  </div>
                </div>
                <div className="p-4 flex items-center justify-center min-h-[80px]">
                  {browserState.active ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"
                    />
                  ) : (
                    <span className="text-xs text-neutral-600 italic">Browser inactive</span>
                  )}
                </div>
              </div>

              {/* Notepad Tool */}
              <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-lg overflow-hidden flex flex-col flex-1 min-h-[150px]">
                <div className="bg-yellow-900/20 border-b border-yellow-900/30 p-2 flex items-center gap-2">
                  <PenTool className="w-3 h-3 text-yellow-600" />
                  <span className="text-[10px] font-mono text-yellow-600/80 uppercase">Internal Notes</span>
                </div>
                <div className="p-3 font-mono text-[10px] text-yellow-500/80 space-y-1 overflow-y-auto flex-1">
                  {notepad.length === 0 ? (
                    <span className="italic opacity-50">Blank.</span>
                  ) : (
                    notepad.map((note, i) => <div key={i}>&gt; {note}</div>)
                  )}
                </div>
              </div>

              {/* Toys */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="bg-neutral-900 border-b border-neutral-800 p-2 flex items-center gap-2">
                  <Gamepad2 className="w-3 h-3 text-pink-500" />
                  <span className="text-[10px] font-mono text-pink-500/80 uppercase">Instruments</span>
                </div>
                <div className="p-4 flex items-center justify-around min-h-[80px]">
                  <div className={clsx("transition-opacity", simState.toyState.type === 'blocks' ? 'opacity-100' : 'opacity-30')}>
                    <motion.div animate={simState.toyState.type === 'blocks' ? { y: [-5, 5, -5] } : {}} transition={{ repeat: Infinity, duration: 1 }} className="w-6 h-6 bg-blue-500/50 rounded-sm" />
                  </div>
                  <div className={clsx("transition-opacity", simState.toyState.type === 'spinner' ? 'opacity-100' : 'opacity-30')}>
                    <motion.div animate={simState.toyState.type === 'spinner' ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }} className="w-6 h-6 border-4 border-emerald-500/50 rounded-full border-t-transparent" />
                  </div>
                  <div className={clsx("transition-opacity", simState.toyState.type === 'chimes' ? 'opacity-100' : 'opacity-30')}>
                    <motion.div animate={simState.toyState.type === 'chimes' ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 0.8 }} className="w-6 h-6 bg-purple-500/50 rounded-full" />
                  </div>
                </div>
                <div className="px-4 pb-4 text-[10px] font-mono text-neutral-500 text-center">
                  {simState.toyState.type ? (
                    <div className="flex flex-col gap-1">
                      <div className="text-pink-400/80 uppercase tracking-widest">{simState.toyState.type}</div>
                      <div className="text-neutral-400 italic">"{simState.toyState.lastResult || 'Initializing...'}"</div>
                    </div>
                  ) : (
                    <div className="opacity-50 italic">No active instrument.</div>
                  )}
                </div>
              </div>

            </div>

            <div className="p-3 border-t border-neutral-800 bg-neutral-950/50">
              <form onSubmit={handleSendStimulus} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Inject stimulus..."
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button 
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-neutral-800 disabled:text-neutral-600 text-white p-1.5 rounded-md transition-colors flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Right Column: Terminal / Logs */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Stream of Consciousness */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col h-[350px] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/20 to-purple-500/5" />
            <div className="p-3 border-b border-neutral-800 bg-neutral-950/50 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <h2 className="text-xs font-mono text-neutral-300 uppercase tracking-wider">Stream of Consciousness</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-mono">
              <AnimatePresence initial={false}>
                {thoughts.map((thought) => (
                  <motion.div 
                    key={thought.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex flex-col ${thought.type === 'action' ? 'text-emerald-400' : 'text-neutral-300'}`}
                  >
                    <div className="flex gap-2">
                      <span className="text-neutral-600 shrink-0">[{thought.time.toString().padStart(4, '0')}]</span>
                      <span className={thought.type === 'thought' ? 'italic opacity-80' : ''}>
                        {thought.text}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={thoughtsEndRef} />
            </div>
          </section>

          {/* System Event Log & Memory */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col flex-1 min-h-[300px] overflow-hidden">
            <div className="flex border-b border-neutral-800 bg-neutral-950/50">
              <button 
                onClick={() => setActiveTab('logs')}
                className={clsx(
                  "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2",
                  activeTab === 'logs' ? "text-indigo-400 bg-indigo-500/5" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                <Terminal className="w-3 h-3" />
                System Logs
              </button>
              <button 
                onClick={() => setActiveTab('memory')}
                className={clsx(
                  "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border-l border-neutral-800 flex items-center justify-center gap-2",
                  activeTab === 'memory' ? "text-indigo-400 bg-indigo-500/5" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                <Database className="w-3 h-3" />
                Episodic Memory
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {activeTab === 'logs' ? (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {logs.map((log) => (
                      <motion.div 
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-3"
                      >
                        <span className="text-neutral-600 shrink-0">[{log.time.toString().padStart(4, '0')}]</span>
                        <span className={clsx(
                          log.type === 'system' && 'text-neutral-400',
                          log.type === 'info' && 'text-blue-400',
                          log.type === 'action' && 'text-emerald-400',
                          log.type === 'alert' && 'text-rose-400',
                        )}>
                          {log.message}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <div ref={logsEndRef} />
                </div>
              ) : (
                <div className="space-y-4">
                  {simState.episodicMemory.length === 0 ? (
                    <p className="text-neutral-600 italic text-center py-8">No significant experiences recorded.</p>
                  ) : (
                    simState.episodicMemory.map((memory) => (
                      <div key={memory.id} className="bg-neutral-950 border border-neutral-800 p-3 rounded-lg">
                        <div className="flex justify-between text-[9px] text-neutral-600 mb-2 font-bold uppercase tracking-tighter">
                          <span>Experience Log</span>
                          <span>T={memory.time}</span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-neutral-600 uppercase text-[9px] block mb-0.5">Stimulus</span>
                            <p className="text-neutral-400">{memory.stimulus}</p>
                          </div>
                          <div>
                            <span className="text-neutral-600 uppercase text-[9px] block mb-0.5">Outcome</span>
                            <p className="text-indigo-300">{memory.outcome}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

      </main>
    </div>
  );
}
