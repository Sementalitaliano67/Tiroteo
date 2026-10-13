import { useState } from 'react'
import {
  type HabitWithCompletion,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  type Category,
} from '../types'

interface HabitCardProps {
  habit: HabitWithCompletion
  onToggle: (id: string, x: number, y: number) => void
  onEdit: (habit: HabitWithCompletion) => void
  onDelete: (habit: HabitWithCompletion) => void
  isScheduledToday: (h: HabitWithCompletion) => boolean
}

export default function HabitCard({ habit, onToggle, onEdit, onDelete, isScheduledToday }: HabitCardProps) {
  const [removing, setRemoving] = useState(false)
  const scheduled = isScheduledToday(habit)

  const handleDelete = () => {
    setRemoving(true)
    setTimeout(() => onDelete(habit), 300)
  }

  return (
    <div
      className={`card p-4 flex items-center gap-4 transition-all duration-300 ${
        removing ? 'translate-x-[-100%] opacity-0' : ''
      } ${habit.completed_today ? 'opacity-60' : ''}`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => onToggle(habit.id, e.clientX, e.clientY)}
        disabled={habit.completed_today || !scheduled}
        className={`flex-shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all duration-200 ${
          habit.completed_today
            ? 'bg-primary-600 border-primary-600 cursor-default'
            : scheduled
              ? 'border-neutral-300 hover:border-primary-500 hover:bg-primary-50 cursor-pointer'
              : 'border-neutral-200 bg-neutral-50 cursor-not-allowed'
        }`}
        aria-label="Completar hábito"
      >
        {habit.completed_today && (
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-neutral-900 truncate ${habit.completed_today ? 'line-through' : ''}`}>
          {habit.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[habit.category as Category]}`}>
            {CATEGORY_ICONS[habit.category as Category]} {habit.category}
          </span>
          <span className="text-xs text-neutral-400">{habit.difficulty}</span>
          <span className="text-xs text-primary-600 font-medium">+{habit.xp_reward} XP</span>
          {!scheduled && (
            <span className="text-xs text-neutral-400 italic">No programado hoy</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onEdit(habit)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          aria-label="Editar hábito"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          aria-label="Eliminar hábito"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
