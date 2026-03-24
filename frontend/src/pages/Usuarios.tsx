import { useEffect, useState } from 'react'
import {
  UserPlusIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  UserIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { apiGet, apiPost, apiPatch, apiDelete } from '../services/api'
import type { Profile } from '../types'
import Spinner from '../components/ui/Spinner'
import Alert from '../components/ui/Alert'
import Modal from '../components/ui/Modal'
import { useAuthStore } from '../stores/authStore'

const ROL_LABELS: Record<string, { label: string; color: string; Icon: typeof UserIcon }> = {
  admin:        { label: 'Admin',        color: 'bg-purple-100 text-purple-700', Icon: ShieldCheckIcon },
  cobrador:     { label: 'Cobrador',     color: 'bg-blue-100 text-blue-700',     Icon: UserIcon },
  solo_lectura: { label: 'Solo lectura', color: 'bg-gray-100 text-gray-600',     Icon: EyeIcon },
}

const ZONAS = ['Zona Norte', 'Zona Sur', 'Zona Centro', 'Zona Este', 'Zona Oeste']

export default function Usuarios() {
  const { user: authUser } = useAuthStore()
  const [usuarios, setUsuarios] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // Modal nuevo usuario
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    nombre: '', email: '', password: '', rol: 'cobrador', zona: '',
  })

  // Modal editar
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [formEdit, setFormEdit] = useState({ nombre: '', rol: 'cobrador', zona: '' })
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Profile[]>('/usuarios')
      setUsuarios(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const crearUsuario = async () => {
    if (!formNuevo.nombre || !formNuevo.email || !formNuevo.password) return
    setGuardando(true)
    try {
      await apiPost('/usuarios', {
        ...formNuevo,
        zona: formNuevo.zona || undefined,
      })
      setOkMsg(`Usuario ${formNuevo.email} creado`)
      setModalNuevo(false)
      setFormNuevo({ nombre: '', email: '', password: '', rol: 'cobrador', zona: '' })
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  const abrirEditar = (u: Profile) => {
    setEditTarget(u)
    setFormEdit({ nombre: u.nombre, rol: u.rol, zona: u.zona || '' })
  }

  const guardarEditar = async () => {
    if (!editTarget) return
    setGuardandoEdit(true)
    try {
      await apiPatch(`/usuarios/${editTarget.id}`, {
        nombre: formEdit.nombre || undefined,
        rol: formEdit.rol || undefined,
        zona: formEdit.zona || undefined,
      })
      setOkMsg('Usuario actualizado')
      setEditTarget(null)
      cargar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGuardandoEdit(false)
    }
  }

  const toggleActivo = async (u: Profile) => {
    try {
      if (u.activo) {
        await apiDelete(`/usuarios/${u.id}`)
        setOkMsg(`${u.nombre} desactivado`)
      } else {
        await apiPost(`/usuarios/${u.id}/activar`, {})
        setOkMsg(`${u.nombre} reactivado`)
      }
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-xs text-gray-500">{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setModalNuevo(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          <UserPlusIcon className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {okMsg && <Alert type="success" message={okMsg} onClose={() => setOkMsg(null)} className="mb-4" />}
      {error && <Alert message={error} onClose={() => setError(null)} className="mb-4" />}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => {
            const rolInfo = ROL_LABELS[u.rol] || ROL_LABELS.solo_lectura
            const Icon = rolInfo.Icon
            const esMiMismo = u.id === authUser?.id
            return (
              <div
                key={u.id}
                className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition-opacity ${
                  u.activo ? 'ring-gray-100' : 'opacity-50 ring-gray-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      u.activo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{u.nombre}</p>
                        {esMiMismo && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">Tú</span>
                        )}
                        {!u.activo && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">Inactivo</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      {u.zona && <p className="text-xs text-gray-400">📍 {u.zona}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${rolInfo.color}`}>
                      <Icon className="h-3 w-3" />
                      {rolInfo.label}
                    </span>
                    <button
                      onClick={() => abrirEditar(u)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Editar"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {!esMiMismo && (
                      <button
                        onClick={() => toggleActivo(u)}
                        className={`rounded-lg p-1.5 ${
                          u.activo
                            ? 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                            : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
                        }`}
                        title={u.activo ? 'Desactivar' : 'Reactivar'}
                      >
                        {u.activo ? <XCircleIcon className="h-4 w-4" /> : <CheckCircleIcon className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuevo usuario */}
      <Modal open={modalNuevo} onClose={() => setModalNuevo(false)} title="Nuevo usuario">
        <div className="space-y-3">
          <div>
            <label className="field-label">Nombre completo</label>
            <input
              value={formNuevo.nombre}
              onChange={(e) => setFormNuevo({ ...formNuevo, nombre: e.target.value })}
              className="field-input"
              placeholder="Ej: Carlos Pérez"
            />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input
              type="email"
              value={formNuevo.email}
              onChange={(e) => setFormNuevo({ ...formNuevo, email: e.target.value })}
              className="field-input"
              placeholder="cobrador@ejemplo.com"
            />
          </div>
          <div>
            <label className="field-label">Contraseña inicial</label>
            <input
              type="password"
              value={formNuevo.password}
              onChange={(e) => setFormNuevo({ ...formNuevo, password: e.target.value })}
              className="field-input"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Rol</label>
              <select
                value={formNuevo.rol}
                onChange={(e) => setFormNuevo({ ...formNuevo, rol: e.target.value })}
                className="field-input"
              >
                <option value="cobrador">Cobrador</option>
                <option value="admin">Admin</option>
                <option value="solo_lectura">Solo lectura</option>
              </select>
            </div>
            <div>
              <label className="field-label">Zona (opcional)</label>
              <select
                value={formNuevo.zona}
                onChange={(e) => setFormNuevo({ ...formNuevo, zona: e.target.value })}
                className="field-input"
              >
                <option value="">Sin zona</option>
                {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalNuevo(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700">
              Cancelar
            </button>
            <button
              onClick={crearUsuario}
              disabled={guardando || !formNuevo.nombre || !formNuevo.email || !formNuevo.password}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {guardando && <Spinner size="sm" className="border-white border-t-blue-200" />}
              {guardando ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal editar usuario */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar usuario">
        {editTarget && (
          <div className="space-y-3">
            <p className="text-center text-sm text-gray-500">{editTarget.email}</p>
            <div>
              <label className="field-label">Nombre</label>
              <input
                value={formEdit.nombre}
                onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })}
                className="field-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Rol</label>
                <select
                  value={formEdit.rol}
                  onChange={(e) => setFormEdit({ ...formEdit, rol: e.target.value })}
                  className="field-input"
                  disabled={editTarget.id === authUser?.id}
                >
                  <option value="cobrador">Cobrador</option>
                  <option value="admin">Admin</option>
                  <option value="solo_lectura">Solo lectura</option>
                </select>
                {editTarget.id === authUser?.id && (
                  <p className="mt-1 text-[10px] text-gray-400">No podés cambiar tu propio rol</p>
                )}
              </div>
              <div>
                <label className="field-label">Zona</label>
                <select
                  value={formEdit.zona}
                  onChange={(e) => setFormEdit({ ...formEdit, zona: e.target.value })}
                  className="field-input"
                >
                  <option value="">Sin zona</option>
                  {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700">
                Cancelar
              </button>
              <button
                onClick={guardarEditar}
                disabled={guardandoEdit}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {guardandoEdit && <Spinner size="sm" className="border-white border-t-blue-200" />}
                {guardandoEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
