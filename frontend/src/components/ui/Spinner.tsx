interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = { sm: 16, md: 24, lg: 36 }

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const px = sizeMap[size]
  return (
    <div
      className={className}
      role="status"
      aria-label="Cargando"
      style={{
        width: px, height: px, flexShrink: 0,
        borderRadius: '50%',
        border: `2px solid rgba(255,255,255,.1)`,
        borderTopColor: '#6366f1',
        animation: 'spin .7s linear infinite',
        display: 'inline-block',
      }}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f1117' }}>
      <Spinner size="lg" />
    </div>
  )
}
