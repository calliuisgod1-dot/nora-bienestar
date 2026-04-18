import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Settings, LogOut, Sparkles, Heart, Menu, Camera, Check, RefreshCcw, Trophy, Bell } from 'lucide-react';
import { useAuth, AuthProvider } from './contexts/AuthContext';
import { Chat } from './components/Chat';
import { Checklist } from './components/Checklist';
import { MoodRadar } from './components/MoodRadar';
import { BreathingExercise } from './components/BreathingExercise';
import { BrilliantMomentsAlbum } from './components/BrilliantMomentsAlbum';
import { MoodType } from './types';
import { GeminiService } from './services/geminiService';
import { db, handleFirestoreError } from './lib/firebase';
import { cn, urlBase64ToUint8Array } from './lib/utils';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

import { speak, getAvailableVoices } from './lib/audio';

function MainLayout() {
  const { user, profile, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(localStorage.getItem('nora-voice') || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [currentMood, setCurrentMood] = useState<MoodType | null>(null);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUpdatingProfile(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        // Update Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { photoURL: base64 }).catch(e => handleFirestoreError(e, 'update', `users/${user.uid}`));
        
        // Update Auth - Firebase Auth has a strict limit on photoURL length (~2000 chars)
        // We truncate it as we use Firestore as the primary source of truth for the profile anyway
        const truncatedPhotoURL = base64.length > 500 ? base64.substring(0, 500) : base64;
        await updateProfile(user, { photoURL: truncatedPhotoURL });
        
        // Refresh profile state in Context is handled by onSnapshot in AuthContext
      } catch (error) {
        console.error("Error updating profile image:", error);
      } finally {
        setIsUpdatingProfile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  React.useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Handle deep links from notifications (e.g. /?action=breathe)
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'breathe') {
      setShowBreathing(true);
      // Clean URL for a better experience
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Register Service Worker and manage Push Notifications
    const isIframe = window.self !== window.top;
    
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js')
        .then(async (registration) => {
          console.log('Nora SW: Bitácora enlazada correctamente');
          
          if (Notification.permission === 'granted') {
            subscribeUser(registration);
          }
          
          if (isIframe && Notification.permission === 'default') {
            console.warn('Nora: Las notificaciones pueden estar bloqueadas por el iframe. Abre en pestaña nueva.');
          }
        })
        .catch(err => console.error('Error al registrar Bitácora SW:', err));
    }
  }, [user]);

  const requestNotificationPermission = async () => {
    const isIframe = window.self !== window.top;
    
    if (isIframe) {
      alert("⚠️ Karin: Para activar las notificaciones, por seguridad debes abrir la Bitácora en una PESTAÑA NUEVA (usa el botón de la flechita arriba a la derecha en AI Studio). En esta vista previa pequeñita el navegador no permite pedir permisos.");
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert("Tu dispositivo no soporta notificaciones de bitácora.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        subscribeUser(registration);
        alert("¡Listo! Bitácora conectada. Nora te avisará a las 9 AM y 9 PM. ✨");
      }
    } else {
      alert("Para recibir mis mensajes, por favor activa las notificaciones en los ajustes de tu navegador. ☀️");
    }
  };

  const subscribeUser = async (registration: ServiceWorkerRegistration) => {
    const publicVapidKey = (import.meta as any).env.VITE_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.warn('Bitácora: Falta VAPID_PUBLIC_KEY en el entorno para notificaciones.');
      return;
    }

    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('Bitácora: Karin suscrita a notificaciones push ✨');
    } catch (error) {
      console.error('Error al suscribir a Karin:', error);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedVoiceName(name);
    localStorage.setItem('nora-voice', name);
    speak("Hola Karin, ¿te gusta este tono de voz?");
  };

  const isHandlingCompletion = useRef(false);

  const handleAllCompleted = useCallback(async () => {
    if (!user || isHandlingCompletion.current) return;
    
    isHandlingCompletion.current = true;
    
    // Tiny delay to allow the Checklist component to finish its collapse animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get the current tasks to include them in the prompt
    const today = new Date().toISOString().split('T')[0];
    const tasksQuery = query(
      collection(db, 'users', user.uid, 'tasks')
    );
    const tasksSnapshot = await getDocs(tasksQuery).catch(e => handleFirestoreError(e, 'list', `users/${user.uid}/tasks`));
    
    // Filter tasks for today
    const todayTasks = tasksSnapshot 
      ? tasksSnapshot.docs
          .map(doc => doc.data())
          .filter(t => t.date === today && t.completed)
          .map(t => t.text)
          .join(', ')
      : '';

    if (!todayTasks) {
      isHandlingCompletion.current = false;
      return;
    }

    const messagePath = `users/${user.uid}/messages`;
    
    try {
      // Trigger local user message for immediate feedback
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        uid: user.uid,
        userId: user.uid,
        text: "¡He completado todo mi checklist de hoy! ✨",
        sender: 'user',
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, 'create', messagePath));

      // Automatic signal to Nora
      const prompt = `¡Pana! He completado todas mis escalas técnicas de hoy: ${todayTasks}. Me siento realizada. Dame ese cierre de bitácora especial con tu estilo, mencionando lo que logré.`;
      const noraResponse = await GeminiService.chat(prompt, [], undefined, currentMood || undefined);
      
      // Extract and save "Milla Ganada" if present
      const millaMatch = noraResponse.match(/\[MILLA_GANADA:\s*"(.*?)"\]/);
      if (millaMatch && millaMatch[1]) {
        const momentText = millaMatch[1];
        await addDoc(collection(db, 'users', user.uid, 'moments'), {
          userId: user.uid,
          text: momentText,
          timestamp: serverTimestamp(),
          category: 'achievement'
        }).catch(e => console.error("Error saving brilliant moment:", e));
      }

      const cleanResponse = noraResponse.replace(/\[MILLA_GANADA:\s*".*?"\]/, '').trim();

      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        uid: user.uid,
        userId: user.uid,
        text: cleanResponse,
        sender: 'nora',
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, 'create', messagePath));

    } catch (error) {
      console.error("Error generating closing bitácora:", error);
    } finally {
      // Small cooldown before allowing another completion trigger
      setTimeout(() => {
        isHandlingCompletion.current = false;
      }, 5000);
    }
  }, [user, currentMood]);

  return (
    <div className="w-[380px] h-[720px] bg-brand-cream rounded-xxl shadow-2xl overflow-hidden relative app-border flex flex-col">
      {/* PWA Indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[60px] h-[5px] bg-[#E5E0DA] rounded-full z-20" />

      {/* Header */}
      <header className="px-6 pt-10 pb-5 bg-transparent flex items-center justify-between z-10">
        <h1 className="text-2xl font-serif italic text-text-dark font-light">Mi Bitácora</h1>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="w-10 h-10 bg-brand-pink rounded-xl flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform"
        >
          <Briefcase className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        <MoodRadar currentMood={currentMood} onMoodChange={setCurrentMood} />
        <div className="flex flex-col flex-1 min-h-0">
          <Checklist onAllCompleted={handleAllCompleted} />
          <Chat currentMood={currentMood} />
        </div>
      </main>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute inset-0 bg-white z-50 p-8 flex flex-col"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif text-gray-800">Ajustes</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Menu className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-10 pt-4">
              <div className="relative mb-4 group">
                <div className="w-24 h-24 rounded-[30px] overflow-hidden border-4 border-brand-pink shadow-xl geometric-shadow bg-brand-soft flex items-center justify-center">
                  {profile?.photoURL ? (
                    <img 
                      src={profile.photoURL} 
                      alt={profile?.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-3xl font-serif text-brand-coral">{profile?.name?.charAt(0)}</span>
                  )}
                  {isUpdatingProfile && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-brand-coral text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:scale-110 active:scale-95 transition-all"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleProfileImageUpload} 
                />
              </div>
              <h3 className="text-xl font-medium text-gray-700">{profile?.name}</h3>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="p-5 bg-brand-soft rounded-[30px] border border-brand-pink/10">
                <label className="block text-[10px] font-bold text-brand-coral uppercase tracking-widest mb-3">
                  Voz de Nora (Gratis)
                </label>
                <select 
                  value={selectedVoiceName}
                  onChange={handleVoiceChange}
                  className="w-full bg-white border border-brand-pink/20 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 text-text-dark"
                >
                  <option value="">Predeterminada (Femenina)</option>
                  {availableVoices.map(voice => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name.replace('Spanish', '').replace('Google', 'Voz').replace('Microsoft', '').replace('Apple', '').trim()}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-gray-400 italic leading-relaxed">
                  Nota: Las voces dependen de tu sistema. Las de "Google" suelen sonar más naturales.
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowBreathing(true);
                  setShowSettings(false);
                }}
                className="w-full p-5 bg-gradient-to-r from-brand-coral to-brand-pink text-white rounded-[30px] flex items-center justify-between group shadow-lg shadow-brand-coral/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">Escala Técnica</p>
                    <p className="text-lg font-serif italic">Respirar ahora</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <Check className="w-4 h-4" />
                </div>
              </button>

              <div className="p-4 bg-brand-soft rounded-2xl flex items-center justify-between">
                <span className="text-sm text-gray-600 font-medium">Estilo App</span>
                <span className="text-xs text-brand-coral font-bold uppercase tracking-widest">Pastel Soft</span>
              </div>
              
              <button 
                onClick={() => {
                  setShowAlbum(true);
                  setShowSettings(false);
                }}
                className="w-full p-5 bg-white border border-brand-pink/20 rounded-[30px] flex items-center justify-between group hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-brand-soft rounded-2xl flex items-center justify-center text-brand-coral">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Colección</p>
                    <p className="text-lg font-serif italic text-gray-700">Álbum de Millas</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center group-hover:bg-brand-pink/10 transition-colors">
                  <Sparkles className="w-4 h-4 text-brand-coral" />
                </div>
              </button>

              <button 
                onClick={requestNotificationPermission}
                className="w-full p-4 bg-brand-pink text-white rounded-2xl flex items-center justify-between shadow-sm active:scale-95 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" />
                  <span className="font-medium">Activar Notificaciones de Nora</span>
                </div>
                {Notification.permission === 'granted' && <Check className="w-4 h-4" />}
              </button>

              <div className="p-4 bg-gray-50 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 font-medium">Versión</span>
                  <span className="text-xs text-brand-coral font-bold font-mono">1.0.9</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Desarrollada por</span>
                  <span className="text-[10px] text-brand-pink font-bold">Ayisgod</span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => logout()}
              className="mt-auto flex items-center justify-center gap-2 p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Equipaje</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <BreathingExercise 
        isOpen={showBreathing} 
        onClose={() => setShowBreathing(false)} 
      />

      <BrilliantMomentsAlbum
        isOpen={showAlbum}
        onClose={() => setShowAlbum(false)}
      />
    </div>
  );
}

function Login() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-8 max-w-md mx-auto shadow-2xl relative">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-brand-pink/30 to-transparent pointer-events-none" />
      
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-24 h-24 bg-white rounded-[30px] flex items-center justify-center shadow-xl shadow-brand-pink/20 mb-8 border border-brand-pink/30"
      >
        <Heart className="text-brand-coral w-12 h-12 fill-brand-coral/10" />
      </motion.div>

      <div className="text-center z-10 mb-12">
        <h1 className="text-4xl font-serif text-gray-800 mb-2">Hola, Nora te espera</h1>
        <p className="text-gray-400 text-sm leading-relaxed px-4">
          Un espacio seguro para Karin. Tu refugio emocional y bitácora de bienestar personal.
        </p>
      </div>

      <button
        onClick={handleLogin}
        disabled={loading}
        className="relative z-10 w-full bg-white text-gray-700 py-4 px-8 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all border border-gray-100 flex items-center justify-center gap-4 group"
      >
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
        <span className="font-semibold">Comenzar el Viaje con Google</span>
        {loading && (
          <div className="w-4 h-4 border-2 border-brand-coral border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      <p className="mt-8 text-[10px] text-gray-300 uppercase tracking-widest font-bold">
        Diseñado para Karin &bull; us-east1
      </p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-brand-pink border-t-brand-coral rounded-full"
        />
      </div>
    );
  }

  return user ? <MainLayout /> : <Login />;
}
