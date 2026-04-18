import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Trophy, Calendar, X, Heart, Plane } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Moment {
  id: string;
  text: string;
  timestamp: any;
  category?: string;
}

interface BrilliantMomentsAlbumProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrilliantMomentsAlbum({ isOpen, onClose }: BrilliantMomentsAlbumProps) {
  const { user } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user) return;

    const q = query(
      collection(db, 'users', user.uid, 'moments'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Moment[];
      setMoments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, user]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed inset-0 z-50 bg-brand-cream flex flex-col pt-12"
        >
          {/* Header */}
          <div className="px-6 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand-pink rounded-2xl flex items-center justify-center shadow-lg shadow-brand-pink/20">
                <Plane className="w-6 h-6 text-white rotate-[-45deg]" />
              </div>
              <div>
                <h2 className="text-2xl font-serif text-gray-800">Álbum de Millas</h2>
                <p className="text-[10px] text-brand-coral font-bold uppercase tracking-widest">Tus Momentos Brillantes</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-white/50 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-12 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="w-8 h-8 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-serif italic">Abriendo el cofre de recuerdos...</p>
              </div>
            ) : moments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-6 px-4">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-inner">
                  <Heart className="w-12 h-12 text-brand-pink/20" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif text-gray-700 italic">Aún no hay millas registradas</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Sigue charlando con Nora y cumpliendo tus tareas. <br/>
                    ¡Ella tiene un ojo especial para tus logros!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {moments.map((moment, index) => (
                  <motion.div
                    key={moment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-5 bg-white border border-brand-pink/10 rounded-[30px] shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Sparkles className="w-12 h-12 text-brand-coral" />
                    </div>
                    
                    <div className="flex items-start gap-4 mb-3">
                      <div className="w-10 h-10 bg-brand-soft rounded-2xl flex items-center justify-center text-brand-coral shrink-0">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <p className="text-gray-700 font-medium leading-relaxed italic pr-8">
                        "{moment.text}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-14">
                      <Calendar className="w-3 h-3" />
                      {moment.timestamp?.toDate ? moment.timestamp.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : 'Reciente'}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Quote */}
          <div className="p-8 bg-white/40 border-t border-brand-pink/5 text-center">
            <p className="text-[10px] text-gray-400 italic mb-2">
              "Cada milla recorrida es un acto de amor hacia ti misma."
            </p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-1 h-1 bg-brand-pink/30 rounded-full" />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
