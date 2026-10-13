import Confetti from './Confetti'

interface LevelUpModalProps {
  level: number
  onContinue: () => void
}

export default function LevelUpModal({ level, onContinue }: LevelUpModalProps) {
  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
        <div className="card p-10 max-w-sm mx-4 text-center animate-scale-in">
          <div className="w-20 h-20 bg-gradient-to-br from-accent-400 to-accent-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-accent-500/30">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-neutral-900 mb-2">¡SUBISTE DE NIVEL!</h2>
          <p className="text-neutral-500 mb-1">Has alcanzado el</p>
          <p className="text-4xl font-display font-bold text-primary-600 mb-6">Nivel {level}</p>
          <button onClick={onContinue} className="btn-primary w-full">
            ¡Continuar!
          </button>
        </div>
      </div>
    </>
  )
}
