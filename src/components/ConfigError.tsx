export default function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
      <div className="card p-8 max-w-lg">
        <h1 className="text-xl font-display font-bold text-neutral-900 mb-3">Falta configurar Supabase</h1>
        <p className="text-neutral-600 mb-4">
          La app no encuentra las variables <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <p className="text-neutral-600">
          En tu computadora, copiá <code>.env.example</code> como <code>.env</code> y completalo. En Vercel, cargalas en
          Settings → Environment Variables y volvé a desplegar. Los pasos están en <code>DESPLIEGUE.md</code>.
        </p>
      </div>
    </div>
  )
}
