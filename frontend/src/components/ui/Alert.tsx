import { XCircleIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/solid'

type AlertType = 'error' | 'success' | 'warning' | 'info'

const styles: Record<AlertType, { container: string; icon: React.ElementType }> = {
  error:   { container: 'bg-red-50 text-red-800 border-red-200',     icon: XCircleIcon },
  success: { container: 'bg-green-50 text-green-800 border-green-200', icon: CheckCircleIcon },
  warning: { container: 'bg-yellow-50 text-yellow-800 border-yellow-200', icon: ExclamationTriangleIcon },
  info:    { container: 'bg-blue-50 text-blue-800 border-blue-200',   icon: InformationCircleIcon },
}

interface AlertProps {
  type?: AlertType
  message: string
  onClose?: () => void
  className?: string
}

export default function Alert({ type = 'error', message, onClose, className = '' }: AlertProps) {
  const { container, icon: Icon } = styles[type]
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${container} ${className}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-auto shrink-0 opacity-70 hover:opacity-100" aria-label="Cerrar">
          ✕
        </button>
      )}
    </div>
  )
}
