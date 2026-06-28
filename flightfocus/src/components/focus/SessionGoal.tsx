import { useState, useEffect } from 'react';
import { Target, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusStore } from '@/store/focusStore';
import { PREDEFINED_SUBJECTS } from '@/types/simulation';
import type { FocusGoalType } from '@/types/simulation';
import { getSubjectColor } from '@/utils/subjectColor';

const GOAL_TYPES: { value: FocusGoalType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'subject', label: 'Subject' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'custom', label: 'Custom' },
];

export function SessionGoal() {
  const {
    isActive,
    currentSession,
    currentGoal,
    recentSubjects,
    sessions,
    setCurrentGoal,
  } = useFocusStore();

  const [goalType, setGoalType] = useState<FocusGoalType>('subject');
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Pre-fill from last session goal after session ends
  useEffect(() => {
    if (!isActive && sessions.length > 0) {
      const lastGoal = sessions[sessions.length - 1]?.goal;
      if (lastGoal) {
        setGoalType(lastGoal.type);
        setSubject(lastGoal.subject);
        setDetail(lastGoal.detail);
        setCurrentGoal(lastGoal);
      }
    }
  }, [isActive, sessions, setCurrentGoal]);

  // Update store goal when fields change
  useEffect(() => {
    if (!isActive && subject.trim()) {
      setCurrentGoal({ type: goalType, subject: subject.trim(), detail: detail.trim() });
    } else if (!isActive && !subject.trim()) {
      setCurrentGoal(null);
    }
  }, [goalType, subject, detail, isActive, setCurrentGoal]);

  // Display mode during active session
  if (isActive && currentSession?.goal) {
    const goal = currentSession.goal;
    const color = getSubjectColor(goal.subject);
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 shrink-0 flex items-center gap-2 px-3 py-2 surface-soft rounded-lg"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-theme-secondary">
          <span className="font-medium text-theme-primary">{goal.subject}</span>
          {goal.detail && <span className="text-theme-muted"> · {goal.detail}</span>}
        </span>
      </motion.div>
    );
  }

  // Don't show selector during active session without goal
  if (isActive) return null;

  const allSubjects = Array.from(new Set([...PREDEFINED_SUBJECTS, ...recentSubjects]));

  const hasGoal = subject.trim().length > 0;

  return (
    <div className="mb-3 shrink-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between py-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-theme-muted" />
          Study Goal
          {hasGoal && (
            <span className="flex items-center gap-1 text-theme-muted">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: getSubjectColor(subject.trim()) }}
              />
              {subject.trim()}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-theme-muted transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-2">
              {/* Goal type pills */}
              <div className="flex gap-1 flex-wrap">
                {GOAL_TYPES.map((gt) => (
                  <button
                    key={gt.value}
                    onClick={() => setGoalType(gt.value)}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded-full transition-all ${
                      goalType === gt.value
                        ? 'bg-theme-accent-soft text-theme-accent'
                        : 'bg-theme-dim text-theme-muted hover:text-theme-secondary'
                    }`}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>

              {/* Subject input with datalist */}
              <input
                list="focus-subjects"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (e.g. Biology)"
                className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
              />
              <datalist id="focus-subjects">
                {allSubjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              {/* Detail input */}
              <AnimatePresence>
                {subject.trim() && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    type="text"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Detail (e.g. Chapter 3 photosynthesis)"
                    className="w-full px-3 py-2 bg-theme-input-bg border border-theme-input-border rounded-lg text-xs text-theme-primary placeholder-theme-muted focus:outline-none focus:border-theme-accent-border transition-all"
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
