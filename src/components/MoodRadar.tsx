import React from 'react';
import { motion } from 'motion/react';
import { Sun, Cloud, CloudRain, CloudLightning } from 'lucide-react';
import { cn } from '../lib/utils';

export type MoodType = 'despejado' | 'nublado' | 'lluvia' | 'tormenta';

interface MoodRadarProps {
  currentMood: MoodType | null;
  onMoodChange: (mood: MoodType) => void;
}

const moods = [
  { id: 'despejado', icon: Sun, label: 'Cielo Despejado', color: 'text-yellow-400', glow: 'shadow-yellow-200' },
  { id: 'nublado', icon: Cloud, label: 'Nublado', color: 'text-blue-300', glow: 'shadow-blue-100' },
  { id: 'lluvia', icon: CloudRain, label: 'Lluvia', color: 'text-blue-500', glow: 'shadow-blue-200' },
  { id: 'tormenta', icon: CloudLightning, label: 'Tormenta', color: 'text-purple-500', glow: 'shadow-purple-200' },
] as const;

export function MoodRadar({ currentMood, onMoodChange }: MoodRadarProps) {
  return (
    <div className="mx-5 mb-2 p-3 bg-white/40 rounded-2xl backdrop-blur-sm border border-brand-pink/10 shadow-sm">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em]">Radar de Turbulencias</span>
        {currentMood && (
          <span className="text-[9px] font-medium text-brand-coral italic">
            Clima actual: {moods.find(m => m.id === currentMood)?.label}
          </span>
        )}
      </div>
      <div className="flex justify-around items-center gap-1">
        {moods.map((mood) => {
          const Icon = mood.icon;
          const isActive = currentMood === mood.id;
          
          return (
            <button
              key={mood.id}
              onClick={() => onMoodChange(mood.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300",
                isActive ? "bg-white shadow-md scale-110" : "hover:bg-white/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="mood-glow"
                  className={cn(
                    "absolute inset-0 rounded-xl blur-md opacity-40",
                    mood.glow.replace('shadow-', 'bg-')
                  )}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                />
              )}
              <Icon 
                className={cn(
                  "w-6 h-6 transition-colors relative z-10",
                  isActive ? mood.color : "text-gray-300"
                )} 
              />
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-tighter relative z-10 transition-colors",
                isActive ? "text-gray-600" : "text-gray-300"
              )}>
                {mood.id}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
