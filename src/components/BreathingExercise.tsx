import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Wind } from 'lucide-react';

interface BreathingExerciseProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BreathingExercise({ isOpen, onClose }: BreathingExerciseProps) {
  const [phase, setPhase] = useState<'inhala' | 'exhala'>('inhala');

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setPhase(prev => (prev === 'inhala' ? 'exhala' : 'inhala'));
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-brand-pink via-brand-coral to-brand-peach flex flex-col items-center justify-center p-8 backdrop-blur-md"
        >
          {/* Subtle Close Button */}
          <button
            onClick={onClose}
            className="absolute top-10 right-8 p-3 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="flex flex-col items-center gap-12">
            <div className="text-center space-y-2">
              <h2 className="text-white text-2xl font-serif italic font-light tracking-wide">Escala Técnica de Respiración</h2>
              <p className="text-white/60 text-xs uppercase tracking-[0.2em] font-bold">Encuentra tu centro, Karin</p>
            </div>

            {/* Breathing Circle */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              {/* Outer soft glow */}
              <motion.div
                animate={{
                  scale: phase === 'inhala' ? [1, 1.4] : [1.4, 1],
                  opacity: phase === 'inhala' ? [0.2, 0.4] : [0.4, 0.2],
                }}
                transition={{
                  duration: 4,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="absolute inset-0 bg-white rounded-full blur-3xl"
              />
              
              {/* Main Translucent Circle */}
              <motion.div
                animate={{
                  scale: phase === 'inhala' ? [1, 1.8] : [1.8, 1],
                  opacity: phase === 'inhala' ? [0.1, 0.3] : [0.3, 0.1],
                }}
                transition={{
                  duration: 4,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
                className="w-32 h-32 bg-white rounded-full border-2 border-white/20"
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <Wind className="w-8 h-8 text-white/40" />
              </div>
            </div>

            {/* Instruction Text */}
            <motion.div
              key={phase}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="text-center"
            >
              <h3 className="text-white text-4xl font-serif italic capitalize tracking-widest min-w-[200px]">
                {phase}
              </h3>
            </motion.div>

            <p className="text-white/40 text-[10px] text-center max-w-[200px] leading-relaxed uppercase tracking-widest font-bold">
              Sigue el ritmo del círculo suavemente
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
