import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Plus, Trash2, Smartphone, ChevronDown, ChevronUp } from 'lucide-react';
import { db, handleFirestoreError } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';

// Create a safe instance of confetti for environments with restricted OffscreenCanvas
const fireConfetti = confetti.create(undefined, {
  resize: true,
  useWorker: false
});

interface ChecklistProps {
  onAllCompleted: () => void;
}

export function Checklist({ onAllCompleted }: ChecklistProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isAllCompleted, setIsAllCompleted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const completionHandledRef = React.useRef(false);
  const hasInitializedRef = React.useRef(false);

  React.useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'users', user.uid, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(taskList);
      
      const allDone = taskList.length > 0 && taskList.every(t => t.completed);
      
      if (allDone) {
        if (!hasInitializedRef.current) {
          // First load: set state but skip the celebration trigger
          hasInitializedRef.current = true;
          completionHandledRef.current = true;
          setIsAllCompleted(true);
        } else if (!completionHandledRef.current) {
          completionHandledRef.current = true;
          setIsAllCompleted(true);
          fireConfetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FCE4EC', '#FFAB91', '#FDEEF4']
          });
          onAllCompleted();
        }
      } else {
        hasInitializedRef.current = true;
        completionHandledRef.current = false;
        setIsAllCompleted(false);
      }
    }, (error) => {
      handleFirestoreError(error, 'list', `users/${user.uid}/tasks`);
    });

    return unsubscribe;
  }, [user, onAllCompleted]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text || !user) return;

    setNewTaskText(''); // Clear immediately for snappiness

    const path = `users/${user.uid}/tasks`;
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      userId: user.uid,
      text: text,
      completed: false,
      date: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    }).catch(e => {
      setNewTaskText(text); // Restore on error
      handleFirestoreError(e, 'create', path);
    });
  };

  const toggleTask = async (task: Task) => {
    if (!user) return;
    const path = `users/${user.uid}/tasks/${task.id}`;
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
    await updateDoc(taskRef, { completed: !task.completed }).catch(e => handleFirestoreError(e, 'update', path));
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    const path = `users/${user.uid}/tasks/${id}`;
    await deleteDoc(doc(db, 'users', user.uid, 'tasks', id)).catch(e => handleFirestoreError(e, 'delete', path));
  };

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white mx-5 my-4 p-5 rounded-lg geometric-shadow border-l-[5px] border-brand-pink relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-text-light uppercase tracking-widest">
            Rutina de Bienestar
          </h3>
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-brand-soft rounded-full transition-colors text-brand-pink"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-brand-pink font-mono font-bold">
            {tasks.filter(t => t.completed).length}/{tasks.length}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1 mb-4">
              <AnimatePresence>
                {tasks.map((task) => (
                  <motion.div
                    key={task.id}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 10, opacity: 0 }}
                    className="flex items-center gap-3 transition-colors group"
                  >
                    <button 
                      onClick={() => toggleTask(task)}
                      className={cn(
                        "w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center",
                        task.completed ? "bg-brand-pink border-brand-pink text-white" : "border-brand-pink"
                      )}
                    >
                      {task.completed && <span className="text-[10px]">✓</span>}
                    </button>
                    <span className={cn(
                      "flex-1 text-sm transition-all",
                      task.completed ? "text-text-light/50 line-through" : "text-text-dark"
                    )}>
                      {task.text}
                    </span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <form onSubmit={addTask} className="flex gap-2">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Añadir escala técnica..."
                className="flex-1 px-4 py-2 bg-gray-50 border border-brand-pink/20 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink/50 placeholder:text-gray-300"
              />
              <button 
                type="submit"
                className="p-2 bg-brand-coral text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-coral/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
