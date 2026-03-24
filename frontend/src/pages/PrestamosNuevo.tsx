import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftIcon, CalculatorIcon } from '@heroicons/react/24/outline'
import { apiGet, apiPost } from '../services/api'
import { usePrestamosStore } from '../stores/prestamosStore'
import Alert from '../components/ui/Alert'
import Spinner from '../components/ui/Spinner'
import type { Cliente, PrestamoCalcularForm } from '../types'
import { format } from 'date-fns'

interface PreviewCuota {
  numero: number
  fecha_vencimiento: string
  monto: number
  capital: number
  interes: number
  saldo: number
}

interface Preview {
  total_a_pagar: number
  total_interes: number
  cuotas: PreviewCuota[]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export default function PrestamosNuevo() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { crearPrestamo } = usePrestamosStore()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<PrestamoCalcularForm>({
    cliente_id: searchParams.get('cliente_id') ?? '',
    monto: 0,
    tasa: 5,
    tipo_tasa: 'flat',
    periodicidad: 'mensual',
    n_cuotas: 12,
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    cobrador_id: '',
  })

  useEffect(() => {
    apiGet<any>('/clientes', { per_page: 200 })
      .then((r: any) => setClientes(r.items ?? r))
      .catch(() => {})
  }, [])

  const setField = <K extends keyof PrestamoCalcularForm>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
      setForm((f) => ({ ...f, [k]: val }))
      setPreview(null)
    }

  const calcular = async () => {
    if (!form.monto || !form.cliente_id) {
      setError('Seleccioná un cliente y completá el monto')
      return
    }
    setLoadingPreview(true)
    setError(null)
    try {
      const data = await apiPost<Preview>('/prestamos/calcular', form)
      setPreview(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSubmit = async () => {
    if (!preview) { setError('Calculá primero el préstamo'); return }
    setSaving(true)
    setError(null)
    try {
      const p = await crearPrestamo(form)
      navigate(`/prestamos/${p.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nuevo préstamo</h1>
      </div>

      {error && <Alert message={error} onClose={() => setError(null)} className="mb-4" />}

      <div className="space-y-4">
        {/* Formulario */}
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Condiciones</h2>

          <div className="space-y-3">
            <div>
              <label className="field-label">Cliente *</label>
              <select value={form.cliente_id} onChange={setField('cliente_id')} required className="field-input">
                <option value="">Seleccionar cliente...</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} — DNI {c.dni}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Monto ($) *</label>
                <input type="number" value={form.monto || ''} onChange={setField('monto')}
                  min="1" step="100" required placeholder="0" className="field-input" />
              </div>
              <div>
                <label className="field-label">Tasa (%)</label>
                <input type="number" value={form.tasa} onChange={setField('tasa')}
                  min="0" step="0.5" className="field-input" />
              </div>
              <div>
                <label className="field-label">Tipo de tasa</label>
                <select value={form.tipo_tasa} onChange={setField('tipo_tasa')} className="field-input">
                  <option value="flat">Flat (cuota fija)</option>
                  <option value="sobre_saldo">Sobre saldo (decreciente)</option>
                </select>
              </div>
              <div>
                <label className="field-label">Periodicidad</label>
                <select value={form.periodicidad} onChange={setField('periodicidad')} className="field-input">
                  <option value="diaria">Diaria</option>
                  <option value="semanal">Semanal</option>
                  <option value="quincenal">Quincenal</option>
                  <option value="mensual">Mensual</option>
                </select>
              </div>
              <div>
                <label className="field-label">N° de cuotas</label>
                <input type="number" value={form.n_cuotas} onChange={setField('n_cuotas')}
                  min="1" max="360" className="field-input" />
              </div>
              <div>
                <label className="field-label">Fecha inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={setField('fecha_inicio')}
                  className="field-input" />
              </div>
            </div>

            <button onClick={calcular} disabled={loadingPreview}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-800 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60">
              {loadingPreview
                ? <Spinner size="sm" className="border-white border-t-gray-300" />
                : <CalculatorIcon className="h-4 w-4" />}
              {loadingPreview ? 'Calculando...' : 'Calcular cuotas'}
            </button>
          </div>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100">
              <div className="bg-white p-4 text-center">
                <p className="text-xs text-gray-500">Total a devolver</p>
                <p className="text-lg font-bold text-gray-900">{fmt(preview.total_a_pagar)}</p>
              </div>
              <div className="bg-white p-4 text-center">
                <p className="text-xs text-gray-500">Total interés</p>
                <p className="text-lg font-bold text-blue-600">{fmt(preview.total_interes)}</p>
              </div>
            </div>

            {/* Tabla cuotas */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">N°</th>
                    <th className="px-3 py-2 text-left font-medium">Vencimiento</th>
                    <th className="px-3 py-2 text-right font-medium">Cuota</th>
                    <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Capital</th>
                    <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Interés</th>
                    <th className="px-3 py-2 text-right font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.cuotas.map((c) => (
                    <tr key={c.numero} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 font-medium">{c.numero}</td>
                      <td className="px-3 py-1.5">{c.fecha_vencimiento}</td>
                      <td className="px-3 py-1.5 text-right font-semibold">{fmt(c.monto)}</td>
                      <td className="px-3 py-1.5 text-right hidden sm:table-cell">{fmt(c.capital)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-600 hidden sm:table-cell">{fmt(c.interes)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{fmt(c.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Crear */}
            <div className="border-t border-gray-100 p-4">
              <button onClick={handleSubmit} disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {saving && <Spinner size="sm" className="border-white border-t-blue-200" />}
                {saving ? 'Creando préstamo...' : 'Confirmar y crear préstamo'}
              </button>
              <p className="mt-2 text-center text-xs text-gray-400">
                El préstamo quedará en estado "pendiente de aprobación"
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
