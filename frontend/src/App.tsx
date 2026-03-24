import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { FullPageSpinner } from './components/ui/Spinner'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clientes from './pages/Clientes'
import ClienteForm from './pages/ClienteForm'
import ClienteDetalle from './pages/ClienteDetalle'
import PrestamosList from './pages/PrestamosList'
import PrestamosNuevo from './pages/PrestamosNuevo'
import PrestamoDetalle from './pages/PrestamoDetalle'
import CobrosHoy from './pages/CobrosHoy'
import Reportes from './pages/Reportes'
import Usuarios from './pages/Usuarios'

export default function App() {
  const { initialize, initialized } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!initialized) return <FullPageSpinner />

  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Login />} />

        {/* Protegidas — con Layout */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/nuevo" element={<ClienteForm />} />
          <Route path="clientes/:id" element={<ClienteDetalle />} />
          <Route path="clientes/:id/editar" element={<ClienteForm />} />
          <Route path="prestamos" element={<PrestamosList />} />
          <Route path="prestamos/nuevo" element={<PrestamosNuevo />} />
          <Route path="prestamos/:id" element={<PrestamoDetalle />} />
          <Route path="cobros" element={<CobrosHoy />} />
          <Route path="reportes" element={<Reportes />} />
          <Route path="usuarios" element={
            <ProtectedRoute requireAdmin>
              <Usuarios />
            </ProtectedRoute>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
