import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useClientesStore } from '../stores/clientesStore'
import Alert from '../components/ui/Alert'
import Spinner from '../components/ui/Spinner'
import type { ClienteForm as FormData } from '../types'

const ZONAS = ['Zona Norte', 'Zona Sur', 'Zona Este', 'Zona Oeste', 'Centro']

export default function ClienteForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { clienteActual, fetchCliente, crearCliente, actualizarCliente, loading } = useClientesStore()

  const [form, setForm] = useState<FormData>({
    nombre: '', dni: '', telefono: '', direccion: '', zona: '', notas: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit && id) fetchCliente(id)
  }, [isEdit, id, fetchCliente])

  useEffect(() => {
    if (isEdit && clienteActual) {
      setForm({
        nombre:    clienteActual.nombre ?? '',
        dni:       clienteActual.dni ?? '',
        telefono:  clienteActual.telefono ?? '',
        direccion: clienteActual.direccion ?? '',
        zona:      clienteActual.zona ?? '',
        notas:     clienteActual.notas ?? '',
      })
    }
  }, [isEdit, clienteActual])

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      if (isEdit && id) {
        await actualizarCliente(id, form)
        navigate(`/clientes/${id}`)
      } else {
        const c = await crearCliente(form)
        navigate(`/clientes/${c.id}`)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && loading) return <div className="flex justify-center py-10"><Spinner size="lg" /></div>

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
        </h1>
      </div>

      {error && <Alert message={error} onClose={() => setError(null)} className="mb-4" />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Datos personales
          </h2>

          <div className="space-y-3">
            <Field label="Nombre completo *" required>
              <input type="text" value={form.nombre} onChange={set('nombre')}
                required placeholder="Ej: Juan García"
                className="field-input" />
            </Field>

            <Field label={isEdit ? 'DNI (no editable)' : 'DNI *'} required={!isEdit}>
              <input type="text" value={form.dni} onChange={set('dni')}
                required={!isEdit} disabled={isEdit}
                placeholder="12345678" pattern="[0-9]{6,10}"
                title="Solo números, entre 6 y 10 dígitos"
                className="field-input disabled:bg-gray-50 disabled:text-gray-400" />
            </Field>

            <Field label="Teléfono">
              <input type="tel" value={form.telefono} onChange={set('telefono')}
                placeholder="Ej: 11-1234-5678"
                className="field-input" />
            </Field>

            <Field label="Dirección">
              <input type="text" value={form.direccion} onChange={set('direccion')}
                placeholder="Ej: Av. Corrientes 1234"
                className="field-input" />
            </Field>

            <Field label="Zona">
              <select value={form.zona} onChange={set('zona')} className="field-input">
                <option value="">Seleccionar zona...</option>
                {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>

            <Field label="Notas internas">
              <textarea value={form.notas} onChange={set('notas')}
                rows={2} placeholder="Observaciones del cliente..."
                className="field-input resize-none" />
            </Field>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving && <Spinner size="sm" className="border-white border-t-blue-200" />}
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  )
}
