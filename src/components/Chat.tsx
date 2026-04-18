import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Paperclip, X, Image as ImageIcon, Volume2, RotateCcw, Edit2, Trash2 } from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, orderBy, limit, serverTimestamp, writeBatch, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Message, MoodType } from '../types';
import { GeminiService } from '../services/geminiService';
import { cn } from '../lib/utils';
import { speak, startRecognition } from '../lib/audio';
import ReactMarkdown from 'react-markdown';

interface ChatProps {
  currentMood: MoodType | null;
}

export function Chat({ currentMood }: ChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lastInputMethod, setLastInputMethod] = useState<'text' | 'voice'>('text');

  React.useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgList.push({ 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        } as Message);
      });
      setMessages(msgList);
      setOptimisticMessage(null);
      setTimeout(scrollToBottom, 50);
    }, (error) => {
      handleFirestoreError(error, 'list', `users/${user.uid}/messages`);
    });

    return unsubscribe;
  }, [user]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (textOverride?: string, isRetry: boolean = false, inputMethod: 'text' | 'voice' = 'text') => {
    const text = textOverride || inputText;
    if ((!text.trim() && !selectedImage) || !user) return;

    setLastInputMethod(inputMethod);
    
    if (!isRetry) {
      const userMessage: any = {
        userId: user.uid,
        text: text,
        sender: 'user' as const,
        timestamp: new Date(), // Local timestamp for optimistic UI
      };
      if (selectedImage) {
        userMessage.imageUrl = selectedImage;
      }
      
      setOptimisticMessage({ id: 'optimistic', ...userMessage });
      
      addDoc(collection(db, 'users', user.uid, 'messages'), {
        ...userMessage,
        timestamp: serverTimestamp() // Real timestamp for Firestore
      }).catch(e => handleFirestoreError(e, 'create', `users/${user.uid}/messages`));
    }

    setInputText('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      // Get history excluding the current message if it's already in the messages list
      // We slice the last 15 previous messages to provide context without duplicates
      const history = messages
        .filter(m => m.id !== 'optimistic' && m.text !== text) 
        .slice(-15)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: m.text
        }));

      const noraResponse = await GeminiService.chat(text, history, selectedImage || undefined, currentMood || undefined);
      
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

      // Clean response for display
      const cleanResponse = noraResponse.replace(/\[MILLA_GANADA:\s*".*?"\]/, '').trim();

      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        userId: user.uid,
        text: cleanResponse,
        sender: 'nora' as const,
        timestamp: serverTimestamp()
      }).catch(e => handleFirestoreError(e, 'create', `users/${user.uid}/messages`));

      // ONLY speak automatically if input was voice or it's a retry from a nora message
      if (inputMethod === 'voice' || isRetry) {
        speak(cleanResponse);
      }

    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const editMessage = (msg: Message) => {
    setInputText(msg.text);
    // Note: Simple UI implementation, in a real app we might delete or mark as edited
  };

  const playAudio = async (text: string) => {
    speak(text);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const deleteChat = async () => {
    if (!user) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000); // 3 seconds to confirm
      return;
    }

    try {
      // Fetch ALL messages to clear the whole history
      const messagesRef = collection(db, 'users', user.uid, 'messages');
      const snapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      setMessages([]);
      setConfirmDelete(false);
    } catch (error) {
      handleFirestoreError(error, 'delete', `users/${user.uid}/messages`);
      setConfirmDelete(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }
    
    setIsRecording(true);
    startRecognition(
      (text) => {
        setInputText(text);
        handleSend(text, false, 'voice');
      },
      () => setIsRecording(false)
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[60vh] overflow-hidden bg-brand-cream/50 relative">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {[...messages, ...(optimisticMessage ? [optimisticMessage] : [])].map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.sender === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {msg.imageUrl && (
                <img 
                  src={msg.imageUrl} 
                  className="w-48 rounded-xl mb-1 shadow-sm border border-brand-pink/20" 
                  referrerPolicy="no-referrer"
                />
              )}
              <div className={cn(
                "px-[18px] py-[14px] rounded-[20px] text-sm leading-relaxed shadow-sm",
                msg.sender === 'user' 
                  ? "bg-brand-coral text-white chat-bubble-user" 
                  : "bg-white text-text-dark chat-bubble-nora geometric-shadow"
              )}>
                <div className="prose prose-sm leading-relaxed text-current">
                  <ReactMarkdown>
                    {msg.text}
                  </ReactMarkdown>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  {msg.sender === 'nora' ? (
                    <>
                      <button 
                        onClick={() => speak(msg.text)}
                        className="text-brand-coral hover:bg-brand-soft p-1.5 rounded-full transition-colors bg-white/50"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleSend(messages.filter(m => m.sender === 'user').pop()?.text, true)}
                        className="text-gray-400 hover:text-brand-coral p-1.5 rounded-full transition-colors bg-white/50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => editMessage(msg)}
                      className="text-white/70 hover:text-white p-1.5 rounded-full transition-colors bg-black/10"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white border border-brand-pink/20 px-4 py-3 rounded-2xl rounded-tl-none mr-auto shadow-sm"
            >
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-brand-coral rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-brand-coral rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-brand-coral rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Bar */}
      <div className="p-5 bg-brand-cream mt-auto border-t border-brand-pink/10">
        <div className="flex items-center justify-between mb-2 px-2">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Chat bitácora</span>
          <button 
            onClick={deleteChat}
            className={cn(
              "flex items-center gap-1.5 text-[10px] transition-all uppercase font-bold tracking-widest px-2 py-1 rounded-full",
              confirmDelete 
                ? "bg-red-500 text-white animate-pulse" 
                : "text-gray-400 hover:text-red-400"
            )}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete ? "¿Confirmar borrado?" : "Borrar rastro"}
          </button>
        </div>
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="mb-3 relative inline-block p-1 bg-white rounded-lg geometric-shadow"
            >
              <img src={selectedImage} className="h-16 w-16 object-cover rounded-md" referrerPolicy="no-referrer" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-brand-coral text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex h-[54px] items-center gap-2 bg-white px-2.5 rounded-[30px] geometric-shadow transition-all focus-within:ring-2 focus-within:ring-brand-pink/30">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(undefined, false, 'text')}
            placeholder="Cuéntale a Nora..."
            className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none placeholder:text-text-light/50 text-text-dark"
          />

          <div className="flex items-center gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 flex items-center justify-center bg-brand-soft rounded-full text-text-light hover:text-brand-coral transition-colors"
            >
              <Paperclip className="w-[18px] h-[18px]" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageSelect}
            />
            
            <button 
              onClick={toggleRecording}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-full transition-all",
                isRecording ? "bg-red-100 text-red-500 animate-pulse" : "bg-brand-soft text-text-light hover:text-brand-coral"
              )}
            >
              <Mic className="w-[18px] h-[18px]" />
            </button>

            <button 
              onClick={() => handleSend(undefined, false, 'text')}
              disabled={(!inputText.trim() && !selectedImage) || isTyping}
              className="w-9 h-9 flex items-center justify-center bg-brand-coral text-white rounded-full disabled:opacity-50 disabled:scale-95 hover:scale-105 active:scale-95 transition-all"
            >
              <Send className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
