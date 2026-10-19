interface BarChartProps {
  data: { label: string; value: number }[]
  unit: string
  title: string
}

// Gráfico de barras simple en SVG; el valor de cada barra queda en el título para lectores de pantalla.
export default function BarChart({ data, unit, title }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const barWidth = 100 / Math.max(data.length, 1)
  return (
    <figure>
      <figcaption className="text-sm font-semibold text-neutral-700 mb-2">{title}</figcaption>
      <svg viewBox="0 0 100 50" className="w-full h-40" preserveAspectRatio="none" role="img" aria-label={title}>
        {data.map((d, i) => {
          const h = (d.value / max) * 46
          return (
            <rect
              key={d.label + i}
              x={i * barWidth + barWidth * 0.15}
              y={48 - h}
              width={barWidth * 0.7}
              height={Math.max(h, d.value > 0 ? 0.8 : 0)}
              rx={0.6}
              className="fill-primary-500"
            >
              <title>{`${d.label}: ${d.value} ${unit}`}</title>
            </rect>
          )
        })}
        <line x1="0" y1="48" x2="100" y2="48" className="stroke-neutral-200" strokeWidth="0.4" />
      </svg>
      <div className="flex justify-between text-[11px] text-neutral-500 mt-1">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </figure>
  )
}
