import { useMemo, useState } from 'react'
import { categoriasDe, cuentasActivas, movimientosDelMes } from '../../dominio/calculos'
import { formatearDia, formatearMes, mesActual, sumarMeses } from '../../dominio/fechas'
import { TIPOS_MOVIMIENTO, type Movimiento } from '../../dominio/tipos'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Boton, Desplegable, Entrada, EstadoVacio, Importe, Modal, Tarjeta } from '../componentes/base'
import { FormularioMovimiento } from '../componentes/FormularioMovimiento'

export function Movimientos() {
  const { estado, eliminarMovimiento } = useFinanzas()
  const [mes, setMes] = useState(mesActual())
  const [filtroCuenta, setFiltroCuenta] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Movimiento | null>(null)
  const [abierto, setAbierto] = useState(false)

  const cuentas = cuentasActivas(estado)
  const categorias = [...categoriasDe(estado, 'gasto'), ...categoriasDe(estado, 'ingreso')]

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return movimientosDelMes(estado, mes).filter((m) => {
      if (filtroCuenta && m.cuentaId !== filtroCuenta && m.cuentaDestinoId !== filtroCuenta) return false
      if (filtroCategoria && m.categoriaId !== filtroCategoria) return false
      if (texto && !m.descripcion.toLowerCase().includes(texto)) return false
      return true
    })
  }, [estado, mes, filtroCuenta, filtroCategoria, busqueda])

  // Agrupar por día para que la lista se lea como un extracto.
  const porDia = useMemo(() => {
    const grupos = new Map<string, Movimiento[]>()
    for (const m of visibles) {
      const lista = grupos.get(m.fecha) ?? []
      lista.push(m)
      grupos.set(m.fecha, lista)
    }
    return [...grupos.entries()]
  }, [visibles])

  function cerrar() {
    setAbierto(false)
    setEditando(null)
  }

  const nombreCuenta = (id?: string) => cuentas.find((c) => c.id === id)?.nombre ?? '—'
  const categoriaDe = (id?: string) => estado.categorias.find((c) => c.id === id)

  return (
    <div className="space-y-4">
      {/* Selector de mes */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">
            ←
          </Boton>
          <span className="min-w-40 text-center text-sm font-semibold first-letter:uppercase">{formatearMes(mes)}</span>
          <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">
            →
          </Boton>
        </div>
        <Boton variante="primario" onClick={() => setAbierto(true)}>
          + Añadir
        </Boton>
      </div>

      {/* Filtros */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Entrada
          placeholder="Buscar concepto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <Desplegable value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
          <option value="">Todas las cuentas</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Desplegable>
        <Desplegable value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icono} {c.nombre}
            </option>
          ))}
        </Desplegable>
      </div>

      {porDia.length === 0 ? (
        <EstadoVacio
          icono="📝"
          titulo="No hay movimientos este mes"
          descripcion="Apunta tu primer gasto o ingreso. Con el tiempo esto se convierte en el mapa de dónde va tu dinero."
          accion={
            <Boton variante="primario" onClick={() => setAbierto(true)}>
              Añadir movimiento
            </Boton>
          }
        />
      ) : (
        <div className="space-y-4">
          {porDia.map(([fecha, movimientos]) => (
            <div key={fecha}>
              <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {formatearDia(fecha)}
              </h3>
              <Tarjeta className="!p-0">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movimientos.map((m) => {
                    const categoria = categoriaDe(m.categoriaId)
                    return (
                      <li key={m.id} className="flex items-center gap-3 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-base dark:bg-slate-800">
                          {m.tipo === 'traspaso' ? '🔄' : (categoria?.icono ?? '•')}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.descripcion}</p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {m.tipo === 'traspaso'
                              ? `${nombreCuenta(m.cuentaId)} → ${nombreCuenta(m.cuentaDestinoId)}`
                              : `${categoria?.nombre ?? 'Sin categoría'} · ${nombreCuenta(m.cuentaId)}`}
                            {m.recurrenteId && ' · recurrente'}
                          </p>
                        </div>
                        <Importe cents={m.importe} tipo={m.tipo} />
                        <div className="flex shrink-0 gap-0.5">
                          <Boton
                            variante="fantasma"
                            onClick={() => {
                              setEditando(m)
                              setAbierto(true)
                            }}
                            aria-label={`Editar ${m.descripcion}`}
                            className="!px-2"
                          >
                            ✏️
                          </Boton>
                          <Boton
                            variante="fantasma"
                            onClick={() => {
                              if (confirm(`¿Borrar "${m.descripcion}"?`)) void eliminarMovimiento(m.id)
                            }}
                            aria-label={`Borrar ${m.descripcion}`}
                            className="!px-2"
                          >
                            🗑️
                          </Boton>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Tarjeta>
            </div>
          ))}
        </div>
      )}

      <Modal
        abierto={abierto}
        titulo={editando ? 'Editar movimiento' : `Nuevo ${TIPOS_MOVIMIENTO.gasto.toLowerCase()}`}
        onCerrar={cerrar}
      >
        <FormularioMovimiento
          key={editando?.id ?? 'nuevo'}
          inicial={editando ?? undefined}
          onGuardado={cerrar}
          onCancelar={cerrar}
        />
      </Modal>
    </div>
  )
}
