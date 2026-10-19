import { useEffect, useState, type FormEvent } from 'react'
import {
  type HabitWithCompletion,
  type Category,
  type Difficulty,
  type Frequency,
  CATEGORIES,
  DIFFICULTIES,
  FREQUENCIES,
  XP_BY_DIFFICULTY,
  DAY_LABELS,
} from '../types'

interface HabitFormModalProps {
  mode: 'create' | 'edit'
  habit?: HabitWithCompletion | null
  onSave: (
    name: string,
    category: Category,
    difficulty: Difficulty,
    frequency: Frequency,
    frequencyDays: number[] | null,
  ) => Promise<boolean>
    onCancel: () => void
}

export default function HabitFormModal({ mode, habit, onSave, onCancel }: HabitFormModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('Salud')
  const [difficulty, setDifficulty] = useState<Difficulty>('Fácil')
  const [frequency, setFrequency] = useState<Frequency>('Diario')
  const [frequencyDays, setFrequencyDays] = useState<number[]>([])
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (habit && mode === 'edit') {
      setName(habit.name)
      setCategory(habit.category)
      setDifficulty(habit.difficulty)
      setFrequency(habit.frequency)
      setFrequencyDays(habit.frequency_days ?? [])
    }
  }, [habit, mode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const toggleDay = (day: number) => {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setNameError('El nombre del hábito no puede estar vacío.')
      return
    }
    if (name.trim().length > 50) {
      setNameError('El nombre no puede superar los 50 caracteres.')
      return
    }
    if (frequency === 'Días específicos' && frequencyDays.length === 0) {
      setNameError('Selecciona al menos un día de la semana.')
      return
    }
    setSaving(true)
    const ok = await onSave(
      name.trim(),
      category,
      difficulty,
      frequency,
      frequency === 'Diario' ? null : frequencyDays,
    )
    setSaving(false)
    if (ok) onCancel()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onCancel}>
      <div
        className="card p-6 w-full max-w-lg mx-4 animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-neutral-900">
            {mode === 'create' ? 'Nuevo hábito' : 'Editar hábito'}
          </h2>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-700 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nombre del hábito</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              placeholder="Ej. Meditar 10 minutos"
              maxLength={50}
              className={`input-field ${nameError ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
            />
            {nameError && <p className="mt-1.5 text-sm text-red-600">{nameError}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Categoría</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    category === cat
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-surface text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
              Dificultad <span className="text-neutral-400 font-normal">(recompensa XP)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    difficulty === diff
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-surface text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {diff}
                  <span className="block text-xs opacity-80">+{XP_BY_DIFFICULTY[diff]} XP</span>
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Frecuencia</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                    frequency === freq
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-surface text-neutral-700 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
            {frequency === 'Días específicos' && (
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium border transition-all duration-200 ${
                      frequencyDays.includes(idx)
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-surface text-neutral-600 border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Guardando…
                </>
              ) : mode === 'create' ? 'Guardar hábito' : 'Actualizar hábito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
