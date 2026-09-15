import { useMemo, useState } from 'react'
import { progresoObjetivo } from '../../dominio/calculos'
import { aTextoEditable, formatearEuros, parseImporte } from '../../dominio/dinero'
import { formatearFecha, hoy } from '../../dominio/fechas'
import { nuevoId, type Movimiento, type Objetivo } from '../../dominio/tipos'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Aviso, BarraProgreso, Boton, Campo, Desplegable, Entrada, EstadoVacio, Modal, Tarjeta } from '../componentes/base'

export function Objetivos() {
  const { estado, eliminarObjetivo } = useFinanzas()
  const [editando, setEditando] = useState<Objetivo | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [asignando, setAsignando] = useState<Objetivo | null>(null)

  const activos = estado.objetivos.filter((o) => !o.archivado).sort((a, b) => a.orden - b.orden)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Boton variante="primario" onClick={() => { setEditando(null); setAbierto(true) }}>
          + Nuevo objetivo
        </Boton>
      </div>

      {activos.length === 0 ? (
        <EstadoVacio
          icono="🐖"
          titulo="Sin objetivos de ahorro"
          descripcion="Un objetivo es una meta con nombre: el viaje, el coche, el colchón de emergencia. Puedes tener varios sobre la misma cuenta de ahorro, porque lo que cuenta son los traspasos que le asignas, no el saldo de la cuenta."
          accion={<Boton variante="primario" onClick={() => setAbierto(true)}>Crear objetivo</Boton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activos.map((objetivo) => {
            const p = progresoObjetivo(estado, objetivo, hoy())
            return (
              <Tarjeta key={objetivo.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="text-lg" aria-hidden>{objetivo.icono}</span>
                    <span className="truncate">{objetivo.nombre}</span>
                  </span>
                  {p.completado && (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      ¡Conseguido!
                    </span>
                  )}
                </div>

                <p className="mt-3 text-2xl font-bold tabular-nums">{formatearEuros(p.aportado)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  de {formatearEuros(objetivo.objetivo)}
                  {!p.completado && ` · faltan ${formatearEuros(p.restante)}`}
                </p>

                <div className="mt-3">
                  <BarraProgreso
                    porcentaje={p.porcentaje ?? 0}
                    color={p.completado ? 'bg-emerald-500' : 'bg-viz-patrimonio'}
                  />
                  <p className="mt-1.5 text-right text-xs tabular-nums text-slate-500">
                    {(p.porcentaje ?? 0).toFixed(0)} %
                  </p>
                </div>

                {objetivo.fechaLimite && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Para el {formatearFecha(objetivo.fechaLimite)}
                    {p.cuotaMensual !== null && p.mesesRestantes !== null && p.mesesRestantes > 0 && (
                      <> · aparta <strong>{formatearEuros(p.cuotaMensual)}</strong> al mes</>
                    )}
                    {p.mesesRestantes !== null && p.mesesRestantes <= 0 && !p.completado && (
                      <span className="text-amber-600 dark:text-amber-400"> · fecha pasada</span>
                    )}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Boton onClick={() => setAsignando(objetivo)}>Asignar traspaso</Boton>
                  <Boton variante="fantasma" onClick={() => { setEditando(objetivo); setAbierto(true) }}>
                    Editar
                  </Boton>
                  <Boton
                    variante="fantasma"
                    onClick={() => {
                      if (confirm(`¿Borrar "${objetivo.nombre}" y sus aportaciones?`))
                        void eliminarObjetivo(objetivo.id)
                    }}
                  >
                    Borrar
                  </Boton>
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      <Modal abierto={abierto} titulo={editando ? 'Editar objetivo' : 'Nuevo objetivo'} onCerrar={() => setAbierto(false)}>
        <FormularioObjetivo
          key={editando?.id ?? 'nuevo'}
          inicial={editando ?? undefined}
          onGuardado={() => setAbierto(false)}
          onCancelar={() => setAbierto(false)}
        />
      </Modal>

      <Modal abierto={asignando !== null} titulo={`Asignar a ${asignando?.nombre ?? ''}`} onCerrar={() => setAsignando(null)}>
        {asignando && <AsignarTraspaso objetivo={asignando} onGuardado={() => setAsignando(null)} />}
      </Modal>
    </div>
  )
}

const ICONOS = ['🐖', '✈️', '🏠', '🚗', '🛡️', '🎓', '💍', '🏖️', '💻', '🎁']

function FormularioObjetivo({
  inicial, onGuardado, onCancelar,
}: {
  inicial?: Objetivo
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [objetivo, setObjetivo] = useState(
    inicial ? aTextoEditable(inicial.objetivo) : '',
  )
  const [fechaLimite, setFechaLimite] = useState(inicial?.fechaLimite ?? '')
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? '')
  const [icono, setIcono] = useState(inicial?.icono ?? '🐖')
  const [error, setError] = useState('')

  const cuentasAhorro = estado.cuentas.filter(
    (c) => !c.archivada && (c.tipo === 'ahorro' || c.tipo === 'inversion' || c.tipo === 'corriente'),
  )

  async function enviar() {
    if (!nombre.trim()) { setError('Ponle un nombre'); return }
    const centimos = parseImporte(objetivo)
    if (centimos === null || centimos <= 0) { setError('Escribe cuánto quieres reunir'); return }

    await guardar('objetivos', [
      {
        id: inicial?.id ?? nuevoId(),
        nombre: nombre.trim(),
        objetivo: centimos,
        fechaLimite: fechaLimite || undefined,
        cuentaId: cuentaId || undefined,
        icono,
        color: inicial?.color ?? '#4a3aa7',
        archivado: inicial?.archivado ?? false,
        orden: inicial?.orden ?? estado.objetivos.length,
      },
    ])
    onGuardado()
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre" error={error}>
        <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Viaje a Japón" />
      </Campo>

      <Campo etiqueta="Cuánto quieres reunir">
        <Entrada inputMode="decimal" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="3.000,00" />
      </Campo>

      <Campo etiqueta="Fecha límite (opcional)">
        <Entrada type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
      </Campo>

      <Campo etiqueta="Dónde lo guardas (opcional)">
        <Desplegable value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
          <option value="">Sin especificar</option>
          {cuentasAhorro.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Desplegable>
      </Campo>

      <Campo etiqueta="Icono">
        <div className="flex flex-wrap gap-1.5">
          {ICONOS.map((i) => (
            <button
              key={i} type="button" onClick={() => setIcono(i)}
              className={`grid size-10 place-items-center rounded-xl border text-lg transition-colors ${
                icono === i ? 'border-slate-900 bg-slate-100 dark:border-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </Campo>

      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1">Guardar</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}

/**
 * Asignar un traspaso existente a un objetivo.
 *
 * No crea dinero: marca un traspaso que YA hiciste como aportación a esta
 * meta. Por eso pueden convivir varios objetivos sobre la misma cuenta de
 * ahorro sin que el progreso de uno infle el del otro.
 */
function AsignarTraspaso({ objetivo, onGuardado }: { objetivo: Objetivo; onGuardado: () => void }) {
  const { estado, guardar, eliminar } = useFinanzas()

  const yaAsignados = useMemo(
    () => new Set(estado.aportaciones.filter((a) => a.movimientoId).map((a) => a.movimientoId!)),
    [estado.aportaciones],
  )

  const traspasos = useMemo(
    () =>
      estado.movimientos
        .filter((m): m is Movimiento => m.tipo === 'traspaso' && !yaAsignados.has(m.id))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, 30),
    [estado.movimientos, yaAsignados],
  )

  const mias = estado.aportaciones
    .filter((a) => a.objetivoId === objetivo.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  const nombreCuenta = (id?: string) => estado.cuentas.find((c) => c.id === id)?.nombre ?? '—'

  return (
    <div className="space-y-4">
      <Aviso tono="info">
        Marcar un traspaso como aportación no mueve dinero: solo lo etiqueta. El traspaso ya
        existe y tu patrimonio no cambia.
      </Aviso>

      {mias.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Ya asignado</h4>
          <ul className="space-y-1">
            {mias.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">{formatearFecha(a.fecha)}</span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums font-medium">{formatearEuros(a.importe)}</span>
                  <Boton variante="fantasma" className="!px-2 !py-0.5" onClick={() => void eliminar('aportaciones', [a.id])}>
                    ✕
                  </Boton>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Traspasos sin asignar
        </h4>
        {traspasos.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay traspasos libres. Haz un traspaso a tu cuenta de ahorro desde Movimientos y
            vuelve aquí para asignarlo.
          </p>
        ) : (
          <ul className="space-y-1">
            {traspasos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate">{m.descripcion}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatearFecha(m.fecha)} · {nombreCuenta(m.cuentaId)} → {nombreCuenta(m.cuentaDestinoId)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums font-medium">{formatearEuros(m.importe)}</span>
                  <Boton
                    onClick={async () => {
                      await guardar('aportaciones', [
                        { id: nuevoId(), objetivoId: objetivo.id, movimientoId: m.id, fecha: m.fecha, importe: m.importe },
                      ])
                      onGuardado()
                    }}
                  >
                    Asignar
                  </Boton>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
