import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, User, Info, MessageSquare, Loader2, Globe } from 'lucide-react';
import { CharacterSeed } from '../lib/attractorEngine';
import { Type } from '@google/genai';
import { generateContentWithFallback } from '../lib/gemini';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrate: (seed: CharacterSeed) => void;
}

export default function CalibrationModal({ isOpen, onClose, onCalibrate }: CalibrationModalProps) {
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [environment, setEnvironment] = useState('A nicely decorated wooden waiting room. The only interesting objects are the toys on the central table.');
  const [ask, setAsk] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCalibrate = async () => {
    setIsLoading(true);
    try {
      const prompt = `
      Task: Calibrate a cognitive simulation for a specific persona in a specific environment.
      
      User Input:
      Name: ${name}
      Background Info: ${info}
      Environment: ${environment}
      Specific Persona Request: ${ask}
      
      Generate a CharacterSeed JSON object that maps this persona to the following cognitive parameters:
      - identity: A short string describing who they are.
      - currentContext: The environment description (use the user provided one or refine it slightly).
      - voiceDescriptor: 3-5 adjectives describing their linguistic style.
      - driveProfile:
        - boredomRate: (1.0 to 10.0) High = restless, low = patient.
        - obsessionCoefficient: (0.05 to 2.0) LOW (0.05-0.2) = highly focused/obsessive, HIGH (1.0-2.0) = flighty/distractible.
        - socialEnergyCost: (0.0 to 5.0) High = introverted/drained by interaction, low = extroverted.
        - stimulationCeiling: (50 to 100) High = thrill-seeker, low = sensitive/easily overwhelmed.
        
      Output JSON only.
      `;

      const response = await generateContentWithFallback({
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              identity: { type: Type.STRING },
              currentContext: { type: Type.STRING },
              voiceDescriptor: { type: Type.STRING },
              driveProfile: {
                type: Type.OBJECT,
                properties: {
                  boredomRate: { type: Type.NUMBER },
                  obsessionCoefficient: { type: Type.NUMBER },
                  socialEnergyCost: { type: Type.NUMBER },
                  stimulationCeiling: { type: Type.NUMBER }
                },
                required: ["boredomRate", "obsessionCoefficient", "socialEnergyCost", "stimulationCeiling"]
              }
            },
            required: ["identity", "currentContext", "voiceDescriptor", "driveProfile"]
          }
        }
      });

      const seed = JSON.parse(response.text || '{}') as CharacterSeed;
      onCalibrate(seed);
      onClose();
    } catch (error) {
      console.error("Calibration failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Persona Calibration</h2>
                  <p className="text-xs text-neutral-400">Align the cognitive engine to a specific identity</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <User className="w-3 h-3" /> Name / Alias
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sherlock Holmes, Alan Turing, My Best Friend..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <Info className="w-3 h-3" /> Background Info
                </label>
                <textarea
                  value={info}
                  onChange={(e) => setInfo(e.target.value)}
                  placeholder="Describe their history, personality, or current situation..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all h-20 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <Globe className="w-3 h-3" /> Environment
                </label>
                <textarea
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder="Where is the simulation taking place?"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all h-20 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> The &quot;Ask&quot; (Persona Request)
                </label>
                <textarea
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  placeholder="How should they behave? What is their current obsession? e.g. 'Make them highly analytical but prone to deep melancholy when bored.'"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 outline-none transition-all h-20 resize-none"
                />
              </div>
            </div>

            <div className="p-6 bg-neutral-950/50 border-t border-neutral-800 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-neutral-800 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCalibrate}
                disabled={isLoading || !name || !ask}
                className="flex-[2] px-4 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calibrating Engine...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Apply Calibration
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
