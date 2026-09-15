import { lazy, Suspense } from 'react'
import { ProveedorFinanzas, useFinanzas } from './estado/FinanzasContext'
import { Layout } from './ui/Layout'
import { useNavegacion } from './ui/navegacion'
import { Aviso } from './ui/componentes/base'
import { Ajustes } from './ui/paginas/Ajustes'
import { Cuentas } from './ui/paginas/Cuentas'
import { Movimientos } from './ui/paginas/Movimientos'
import { Objetivos } from './ui/paginas/Objetivos'
import { Presupuestos } from './ui/paginas/Presupuestos'

/**
 * El Resumen es la única pantalla que usa Recharts, y Recharts es casi la
 * mitad del bundle. Cargándolo aparte, el armazón y las demás pantallas
 * entran en un paquete pequeño y los gráficos llegan un instante después;
 * quien abra directamente Movimientos no llega a descargarlos nunca.
 */
const Resumen = lazy(() => import('./ui/paginas/Resumen').then((m) => ({ default: m.Resumen })))

function Contenido() {
  const [pagina, ir] = useNavegacion()
  const { cargando, error } = useFinanzas()

  if (cargando) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">Cargando tus datos…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <div className="max-w-md space-y-3">
          <Aviso tono="error">
            <strong>No se han podido abrir tus datos.</strong> {error}
          </Aviso>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suele deberse a que el navegador tiene bloqueado el almacenamiento local, algo
            habitual en ventanas privadas. Prueba en una ventana normal.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Layout pagina={pagina} onNavegar={ir}>
      {pagina === 'resumen' && (
        <Suspense fallback={<p className="py-12 text-center text-sm text-slate-500">Cargando gráficos…</p>}>
          <Resumen />
        </Suspense>
      )}
      {pagina === 'movimientos' && <Movimientos />}
      {pagina === 'cuentas' && <Cuentas />}
      {pagina === 'presupuestos' && <Presupuestos />}
      {pagina === 'objetivos' && <Objetivos />}
      {pagina === 'ajustes' && <Ajustes />}
    </Layout>
  )
}

export default function App() {
  return (
    <ProveedorFinanzas>
      <Contenido />
    </ProveedorFinanzas>
  )
}
