import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHabitsGame } from '../hooks/useHabitsGame'
import type { HabitWithCompletion } from '../types'
import HabitCard from '../components/HabitCard'
import HabitFormModal from '../components/HabitFormModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import LevelUpModal from '../components/LevelUpModal'
import StreakWidget from '../components/StreakWidget'
import XpBar from '../components/XpBar'
import EmptyState from '../components/EmptyState'
import FloatingXp from '../components/FloatingXp'

export default function HabitsPage() {
  const { profile, user, signOut } = useAuth()
  const {
    habits,
    loading,
    levelUp,
    setLevelUp,
    createHabit,
    updateHabit,
    deleteHabit,
    completeHabit,
    isScheduledToday,
  } = useHabitsGame()

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingHabit, setEditingHabit] = useState<HabitWithCompletion | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<HabitWithCompletion | null>(null)
  const [floatingXp, setFloatingXp] = useState<{ xp: number; x: number; y: number } | null>(null)

  const openCreate = () => {
    setFormMode('create')
    setEditingHabit(null)
    setFormOpen(true)
  }

  const openEdit = (habit: HabitWithCompletion) => {
    setFormMode('edit')
    setEditingHabit(habit)
    setFormOpen(true)
  }

  const handleSave = async (
    name: string,
    category: Parameters<typeof createHabit>[1],
    difficulty: Parameters<typeof createHabit>[2],
    frequency: Parameters<typeof createHabit>[3],
    frequencyDays: Parameters<typeof createHabit>[4],
  ) => {
    if (formMode === 'create') {
      return createHabit(name, category, difficulty, frequency, frequencyDays)
    } else if (editingHabit) {
      return updateHabit(editingHabit.id, name, category, difficulty, frequency, frequencyDays)
    }
    return false
  }

  const handleToggle = async (habitId: string, x: number, y: number) => {
    const habit = habits.find((h) => h.id === habitId)
    if (habit && !habit.completed_today) {
      setFloatingXp({ xp: habit.xp_reward, x, y })
    }
    await completeHabit(habitId)
  }

  const pending = habits.filter((h) => isScheduledToday(h) && !h.completed_today)
  const completed = habits.filter((h) => h.completed_today)
  const notScheduled = habits.filter((h) => !isScheduledToday(h))

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-600/20">
              <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
                <path d="M10 16l4 4 8-8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-xl font-display font-bold text-neutral-900 hidden sm:block">Tiroteo</span>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end">
            <StreakWidget streak={profile?.streak_count ?? 0} />
            <XpBar xp={profile?.xp ?? 0} level={profile?.level ?? 1} />
            <button
              onClick={() => signOut()}
              className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors whitespace-nowrap"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-neutral-900">
              ¡Hola, {profile?.display_name || user?.email}!
            </h1>
            <p className="text-neutral-500 text-sm">Estos son tus hábitos de hoy</p>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 flex-shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Nuevo hábito</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-primary-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        ) : habits.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : (
          <div className="space-y-8">
            {/* Pending */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                  Pendientes de hoy
                </h2>
                <div className="space-y-3">
                  {pending.map((h) => (
                    <HabitCard
                      key={h.id}
                      habit={h}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={setDeletingHabit}
                      isScheduledToday={isScheduledToday}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                  Completados de hoy
                </h2>
                <div className="space-y-3">
                  {completed.map((h) => (
                    <HabitCard
                      key={h.id}
                      habit={h}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={setDeletingHabit}
                      isScheduledToday={isScheduledToday}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Not scheduled today */}
            {notScheduled.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                  Otros hábitos
                </h2>
                <div className="space-y-3">
                  {notScheduled.map((h) => (
                    <HabitCard
                      key={h.id}
                      habit={h}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={setDeletingHabit}
                      isScheduledToday={isScheduledToday}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All done message */}
            {pending.length === 0 && completed.length > 0 && notScheduled.length === 0 && (
              <div className="card p-8 text-center">
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <h3 className="text-lg font-display font-bold text-neutral-900 mb-1">
                  ¡Día completado!
                </h3>
                <p className="text-neutral-500">Completaste todos tus hábitos de hoy. ¡Sigue así!</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {formOpen && (
        <HabitFormModal
          mode={formMode}
          habit={editingHabit}
          onSave={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <DeleteConfirmModal
        habit={deletingHabit}
        onConfirm={async () => {
          if (deletingHabit) await deleteHabit(deletingHabit.id)
          setDeletingHabit(null)
        }}
        onCancel={() => setDeletingHabit(null)}
      />

      {levelUp && (
        <LevelUpModal level={levelUp.newLevel} onContinue={() => setLevelUp(null)} />
      )}

      {floatingXp && (
        <FloatingXp
          xp={floatingXp.xp}
          x={floatingXp.x}
          y={floatingXp.y}
          onDone={() => setFloatingXp(null)}
        />
      )}
    </div>
  )
}
