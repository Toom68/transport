import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Plus, Check, X, ChevronDown } from 'lucide-react';
import { useFocusStore } from '@/store/focusStore';

export function TaskList() {
  const {
    tasks,
    tasksExpanded,
    addTask,
    toggleTask,
    removeTask,
    toggleTasksExpanded,
  } = useFocusStore();

  const [taskInput, setTaskInput] = useState('');

  const handleAddTask = () => {
    if (!taskInput.trim()) return;
    addTask(taskInput);
    setTaskInput('');
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <button
        onClick={toggleTasksExpanded}
        className="flex items-center justify-between w-full mb-2 shrink-0 py-1"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-theme-secondary">
          <Target className="w-3.5 h-3.5 text-theme-muted" />
          Tasks
          <span className="text-theme-muted font-mono">({tasks.filter((t) => t.done).length}/{tasks.length})</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${tasksExpanded ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence>
        {tasksExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-1 min-h-0 flex flex-col"
          >
            <div className="flex gap-1.5 mb-2 shrink-0">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                placeholder="Add a focus task…"
                className="flex-1 px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
              />
              <button
                onClick={handleAddTask}
                className="w-8 h-8 rounded-lg bg-theme-accent-soft text-theme-accent flex items-center justify-center transition-all duration-200 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 group p-2.5 rounded-lg surface-soft hover:border-theme-border-solid transition-all duration-200"
                >
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all ${
                      task.done ? 'bg-theme-accent text-white' : 'border border-theme-border-solid hover:border-theme-accent-border'
                    }`}
                  >
                    {task.done && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`flex-1 text-xs ${task.done ? 'text-theme-muted line-through' : 'text-theme-primary'}`}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-theme-muted hover:text-red-500 transition-all shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-theme-muted text-center py-4">No tasks yet. Add one above.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
