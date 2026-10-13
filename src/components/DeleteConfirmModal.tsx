import { useEffect } from 'react'
import type { HabitWithCompletion } from '../types'

interface DeleteConfirmModalProps {
  habit: HabitWithCompletion | null
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmModal({ habit, onConfirm, onCancel }: DeleteConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    if (habit) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [habit, onCancel])

  if (!habit) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onCancel}>
      <div
        className="card p-6 w-full max-w-sm mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-lg font-display font-bold text-neutral-900 text-center mb-2">
          ¿Eliminar hábito?
        </h3>
        <p className="text-sm text-neutral-500 text-center mb-6">
          ¿Estás seguro de que deseas eliminar este hábito? Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 shadow-lg shadow-red-600/20"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
