import { useMemo, useRef, useState } from 'react'
import { cuentasActivas } from '../../dominio/calculos'
import { aTextoEditable, formatearEuros, parseImporte } from '../../dominio/dinero'
import { formatearFecha, hoy } from '../../dominio/fechas'
import { ocurrenciasEntre } from '../../dominio/recurrentes'
import {
  FRECUENCIAS, nuevoId, TIPOS_MOVIMIENTO,
  type Categoria, type Frecuencia, type Recurrente, type TipoMovimiento,
} from '../../dominio/tipos'
import { DIAS_AVISO_COPIA, leerCopia, necesitaCopia, type ResumenCopia } from '../../datos/backup'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Aviso, Boton, Campo, Desplegable, Entrada, Modal, Tarjeta } from '../componentes/base'

export function Ajustes() {
  const { estado } = useFinanzas()
  const [seccion, setSeccion] = useState<'copia' | 'categorias' | 'recurrentes'>('copia')

  const avisoCopia = necesitaCopia(estado.configuracion, estado.movimientos.length)

  return (
    <div className="space-y-4">
      {avisoCopia && (
        <Aviso tono="alerta">
          <strong>Haz una copia de seguridad.</strong>{' '}
          {estado.configuracion.ultimaCopia
            ? `La última fue el ${formatearFecha(estado.configuracion.ultimaCopia)}, hace más de ${DIAS_AVISO_COPIA} días.`
            : 'Todavía no has hecho ninguna.'}{' '}
          Tus datos viven solo en este navegador: si borras los datos de navegación, se pierden.
        </Aviso>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {([
          ['copia', 'Copia de seguridad'],
          ['categorias', 'Categorías'],
          ['recurrentes', 'Recurrentes'],
        ] as const).map(([clave, titulo]) => (
          <button
            key={clave} type="button" onClick={() => setSeccion(clave)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              seccion === clave
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {titulo}
          </button>
        ))}
      </div>

      {seccion === 'copia' && <SeccionCopia />}
      {seccion === 'categorias' && <SeccionCategorias />}
      {seccion === 'recurrentes' && <SeccionRecurrentes />}
    </div>
  )
}

function SeccionCopia() {
  const { estado, exportar, importar, vaciarTodo } = useFinanzas()
  const entrada = useRef<HTMLInputElement>(null)
  const [mensaje, setMensaje] = useState<{ tono: 'info' | 'error'; texto: string } | null>(null)
  const [pendiente, setPendiente] = useState<{ texto: string; resumen: ResumenCopia } | null>(null)

  async function alElegirFichero(fichero: File) {
    const texto = await fichero.text()
    const leido = leerCopia(texto)
    if (!leido.ok) {
      setMensaje({ tono: 'error', texto: leido.error })
      return
    }
    // Se enseña qué trae ANTES de dejar sustituir nada.
    setPendiente({ texto, resumen: leido.resumen })
    setMensaje(null)
  }

  async function confirmarImportacion() {
    if (!pendiente) return
    const resultado = await importar(pendiente.texto)
    setPendiente(null)
    setMensaje(
      resultado.ok
        ? { tono: 'info', texto: 'Copia importada. Tus datos anteriores han sido sustituidos.' }
        : { tono: 'error', texto: resultado.error },
    )
  }

  return (
    <div className="space-y-4">
      <Tarjeta>
        <h3 className="font-semibold">Tus datos viven en este navegador</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Nada sale de tu dispositivo: no hay servidor, ni cuenta, ni nadie que pueda leer tus
          finanzas. El precio de eso es que tampoco hay nadie que pueda recuperártelas. Si borras
          los datos de navegación, cambias de ordenador o el navegador libera espacio, se pierden.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Exportar de vez en cuando es lo único que hace falta para estar a salvo. El fichero es
          un JSON que puedes guardar donde quieras.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Movimientos', estado.movimientos.length],
            ['Cuentas', estado.cuentas.length],
            ['Objetivos', estado.objetivos.length],
            ['Recurrentes', estado.recurrentes.length],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta as string}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
              <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {estado.configuracion.ultimaCopia
            ? `Última copia: ${formatearFecha(estado.configuracion.ultimaCopia)}`
            : 'Todavía no has exportado ninguna copia.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Boton variante="primario" onClick={() => void exportar()}>⬇ Exportar copia</Boton>
          <Boton onClick={() => entrada.current?.click()}>⬆ Importar copia</Boton>
          <input
            ref={entrada} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void alElegirFichero(f)
              e.target.value = ''
            }}
          />
        </div>
      </Tarjeta>

      {mensaje && <Aviso tono={mensaje.tono === 'error' ? 'error' : 'info'}>{mensaje.texto}</Aviso>}

      <Modal abierto={pendiente !== null} titulo="¿Importar esta copia?" onCerrar={() => setPendiente(null)}>
        {pendiente && (
          <div className="space-y-4">
            <Aviso tono="alerta">
              Esto <strong>sustituye por completo</strong> tus datos actuales
              ({estado.movimientos.length} movimientos). No se puede deshacer. Si tienes dudas,
              exporta una copia de lo de ahora antes de continuar.
            </Aviso>

            <dl className="space-y-1 text-sm">
              {[
                ['Exportada el', new Date(pendiente.resumen.exportadoEn).toLocaleString('es-ES')],
                ['Movimientos', String(pendiente.resumen.movimientos)],
                ['Cuentas', String(pendiente.resumen.cuentas)],
                ['Categorías', String(pendiente.resumen.categorias)],
                ['Objetivos', String(pendiente.resumen.objetivos)],
                ['Recurrentes', String(pendiente.resumen.recurrentes)],
                ...(pendiente.resumen.desde
                  ? [['Periodo', `${formatearFecha(pendiente.resumen.desde)} – ${formatearFecha(pendiente.resumen.hasta!)}`]]
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex gap-2">
              <Boton variante="peligro" onClick={() => void confirmarImportacion()} className="flex-1">
                Sustituir mis datos
              </Boton>
              <Boton onClick={() => setPendiente(null)}>Cancelar</Boton>
            </div>
          </div>
        )}
      </Modal>

      <Tarjeta className="border-red-200 dark:border-red-900">
        <h3 className="font-semibold text-red-700 dark:text-red-400">Borrar todo</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Elimina cuentas, movimientos, presupuestos y objetivos, y deja la aplicación como recién
          instalada. No se puede deshacer.
        </p>
        <Boton
          variante="peligro" className="mt-3"
          onClick={() => {
            if (!confirm('Se borrarán TODOS tus datos. ¿Seguro?')) return
            if (!confirm('Última oportunidad. ¿Has exportado una copia?')) return
            void vaciarTodo()
          }}
        >
          Borrar todos mis datos
        </Boton>
      </Tarjeta>
    </div>
  )
}

function SeccionCategorias() {
  const { estado, guardar, eliminarCategoria } = useFinanzas()
  const [aviso, setAviso] = useState<string | null>(null)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [abierto, setAbierto] = useState(false)

  const gastos = estado.categorias.filter((c) => c.tipo === 'gasto').sort((a, b) => a.orden - b.orden)
  const ingresos = estado.categorias.filter((c) => c.tipo === 'ingreso').sort((a, b) => a.orden - b.orden)

  async function borrar(categoria: Categoria) {
    const alternativas = estado.categorias.filter((c) => c.tipo === categoria.tipo && c.id !== categoria.id)
    if (alternativas.length === 0) {
      setAviso('No puedes borrar la única categoría de su tipo: los movimientos se quedarían sin dónde ir.')
      return
    }
    const usados = estado.movimientos.filter((m) => m.categoriaId === categoria.id).length
    const destino = alternativas[0]
    const confirmacion = usados > 0
      ? `"${categoria.nombre}" tiene ${usados} movimientos. Se reasignarán a "${destino.nombre}". ¿Continuar?`
      : `¿Borrar "${categoria.nombre}"?`
    if (!confirm(confirmacion)) return

    setAviso(await eliminarCategoria(categoria.id, destino.id))
  }

  function lista(categorias: Categoria[], titulo: string) {
    const madres = categorias.filter((c) => !c.padreId)
    return (
      <Tarjeta>
        <h3 className="mb-3 font-semibold">{titulo}</h3>
        <ul className="space-y-1">
          {madres.map((madre) => (
            <li key={madre.id}>
              <FilaCategoria categoria={madre} onEditar={() => { setEditando(madre); setAbierto(true) }} onBorrar={() => borrar(madre)} onArchivar={() => guardar('categorias', [{ ...madre, archivada: !madre.archivada }])} />
              <ul className="ml-6 space-y-1 border-l border-slate-200 pl-3 dark:border-slate-800">
                {categorias.filter((c) => c.padreId === madre.id).map((hija) => (
                  <li key={hija.id}>
                    <FilaCategoria categoria={hija} onEditar={() => { setEditando(hija); setAbierto(true) }} onBorrar={() => borrar(hija)} onArchivar={() => guardar('categorias', [{ ...hija, archivada: !hija.archivada }])} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Tarjeta>
    )
  }

  return (
    <div className="space-y-4">
      {aviso && <Aviso tono="alerta">{aviso}</Aviso>}
      <div className="flex justify-end">
        <Boton variante="primario" onClick={() => { setEditando(null); setAbierto(true) }}>+ Categoría</Boton>
      </div>
      {lista(gastos, 'Gastos')}
      {lista(ingresos, 'Ingresos')}

      <Modal abierto={abierto} titulo={editando ? 'Editar categoría' : 'Nueva categoría'} onCerrar={() => setAbierto(false)}>
        <FormularioCategoria
          key={editando?.id ?? 'nueva'}
          inicial={editando ?? undefined}
          onGuardado={() => setAbierto(false)}
          onCancelar={() => setAbierto(false)}
        />
      </Modal>
    </div>
  )
}

function FilaCategoria({
  categoria, onEditar, onBorrar, onArchivar,
}: {
  categoria: Categoria
  onEditar: () => void
  onBorrar: () => void
  onArchivar: () => void
}) {
  return (
    <div className={`flex items-center gap-2 py-1 ${categoria.archivada ? 'opacity-40' : ''}`}>
      <span aria-hidden>{categoria.icono}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{categoria.nombre}</span>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoria.color }} />
      <Boton variante="fantasma" className="!px-1.5 !py-0.5" onClick={onEditar} aria-label={`Editar ${categoria.nombre}`}>✏️</Boton>
      <Boton variante="fantasma" className="!px-1.5 !py-0.5" onClick={onArchivar} aria-label={`Archivar ${categoria.nombre}`}>
        {categoria.archivada ? '↩️' : '📥'}
      </Boton>
      <Boton variante="fantasma" className="!px-1.5 !py-0.5" onClick={onBorrar} aria-label={`Borrar ${categoria.nombre}`}>🗑️</Boton>
    </div>
  )
}

function FormularioCategoria({
  inicial, onGuardado, onCancelar,
}: {
  inicial?: Categoria
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<'ingreso' | 'gasto'>(inicial?.tipo ?? 'gasto')
  const [icono, setIcono] = useState(inicial?.icono ?? '📦')
  const [color, setColor] = useState(inicial?.color ?? '#94a3b8')
  const [padreId, setPadreId] = useState(inicial?.padreId ?? '')
  const [error, setError] = useState('')

  // La jerarquía es de un solo nivel: una subcategoría no puede tener hijas.
  const posiblesMadres = estado.categorias.filter(
    (c) => c.tipo === tipo && !c.padreId && c.id !== inicial?.id,
  )

  async function enviar() {
    if (!nombre.trim()) { setError('Ponle un nombre'); return }
    await guardar('categorias', [
      {
        id: inicial?.id ?? nuevoId(),
        nombre: nombre.trim(),
        tipo, icono, color,
        padreId: padreId || undefined,
        archivada: inicial?.archivada ?? false,
        orden: inicial?.orden ?? estado.categorias.length,
      },
    ])
    onGuardado()
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre" error={error}>
        <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Gimnasio" />
      </Campo>
      <Campo etiqueta="Tipo">
        <Desplegable value={tipo} onChange={(e) => { setTipo(e.target.value as 'ingreso' | 'gasto'); setPadreId('') }}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </Desplegable>
      </Campo>
      <Campo etiqueta="Dentro de (opcional)">
        <Desplegable value={padreId} onChange={(e) => setPadreId(e.target.value)}>
          <option value="">Categoría principal</option>
          {posiblesMadres.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
        </Desplegable>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Icono">
          <Entrada value={icono} onChange={(e) => setIcono(e.target.value)} maxLength={4} className="text-center text-lg" />
        </Campo>
        <Campo etiqueta="Color">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950" />
        </Campo>
      </div>
      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1">Guardar</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}

function SeccionRecurrentes() {
  const { estado, guardar, eliminarRecurrente } = useFinanzas()
  const [editando, setEditando] = useState<Recurrente | null>(null)
  const [abierto, setAbierto] = useState(false)

  const nombreCuenta = (id?: string) => estado.cuentas.find((c) => c.id === id)?.nombre ?? '—'

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Boton variante="primario" onClick={() => { setEditando(null); setAbierto(true) }}>+ Recurrente</Boton>
      </div>

      {estado.recurrentes.length === 0 ? (
        <Tarjeta>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Los recurrentes se apuntan solos: la nómina el día 25, el alquiler el 1, Netflix el 15.
            Se generan al abrir la aplicación, y nunca hacia el futuro: la nómina del 25 no aparece
            el día 20, porque todavía no la has cobrado.
          </p>
        </Tarjeta>
      ) : (
        <Tarjeta className="!p-0">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {estado.recurrentes.map((r) => {
              const siguiente = ocurrenciasEntre(r, hoy(), '2099-12-31')[0]
              return (
                <li key={r.id} className={`flex items-center gap-3 p-3 ${r.activo ? '' : 'opacity-50'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.nombre}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {FRECUENCIAS[r.frecuencia]} · {nombreCuenta(r.cuentaId)}
                      {r.activo && siguiente ? ` · próximo ${formatearFecha(siguiente)}` : ''}
                      {!r.activo && ' · pausado'}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-sm font-semibold">{formatearEuros(r.importe)}</span>
                  <div className="flex shrink-0 gap-0.5">
                    <Boton variante="fantasma" className="!px-2" onClick={() => guardar('recurrentes', [{ ...r, activo: !r.activo }])}
                      aria-label={r.activo ? `Pausar ${r.nombre}` : `Reanudar ${r.nombre}`}>
                      {r.activo ? '⏸️' : '▶️'}
                    </Boton>
                    <Boton variante="fantasma" className="!px-2" onClick={() => { setEditando(r); setAbierto(true) }} aria-label={`Editar ${r.nombre}`}>✏️</Boton>
                    <Boton variante="fantasma" className="!px-2"
                      onClick={() => {
                        if (confirm(`¿Borrar "${r.nombre}"? Los movimientos que ya generó se conservan.`))
                          void eliminarRecurrente(r.id)
                      }}
                      aria-label={`Borrar ${r.nombre}`}>🗑️</Boton>
                  </div>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}

      <Modal abierto={abierto} titulo={editando ? 'Editar recurrente' : 'Nuevo recurrente'} onCerrar={() => setAbierto(false)}>
        <FormularioRecurrente
          key={editando?.id ?? 'nuevo'}
          inicial={editando ?? undefined}
          onGuardado={() => setAbierto(false)}
          onCancelar={() => setAbierto(false)}
        />
      </Modal>
    </div>
  )
}

function FormularioRecurrente({
  inicial, onGuardado, onCancelar,
}: {
  inicial?: Recurrente
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const cuentas = useMemo(() => cuentasActivas(estado), [estado])

  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(inicial ? aTextoEditable(inicial.importe) : '')
  const [cuentaId, setCuentaId] = useState(inicial?.cuentaId ?? cuentas[0]?.id ?? '')
  const [cuentaDestinoId, setCuentaDestinoId] = useState(inicial?.cuentaDestinoId ?? '')
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? '')
  const [frecuencia, setFrecuencia] = useState<Frecuencia>(inicial?.frecuencia ?? 'mensual')
  const [diaDelMes, setDiaDelMes] = useState(String(inicial?.diaDelMes ?? 1))
  const [diaDeLaSemana, setDiaDeLaSemana] = useState(String(inicial?.diaDeLaSemana ?? 1))
  const [fechaInicio, setFechaInicio] = useState(inicial?.fechaInicio ?? hoy())
  const [error, setError] = useState('')

  const categorias = estado.categorias.filter(
    (c) => tipo !== 'traspaso' && c.tipo === tipo && !c.archivada,
  )

  async function enviar() {
    if (!nombre.trim()) { setError('Ponle un nombre'); return }
    const centimos = parseImporte(importe)
    if (centimos === null || centimos <= 0) { setError('Escribe un importe mayor que cero'); return }
    if (tipo !== 'traspaso' && !categoriaId) { setError('Elige una categoría'); return }
    if (tipo === 'traspaso' && !cuentaDestinoId) { setError('Elige la cuenta de destino'); return }

    await guardar('recurrentes', [
      {
        id: inicial?.id ?? nuevoId(),
        nombre: nombre.trim(),
        tipo,
        importe: centimos,
        cuentaId,
        cuentaDestinoId: tipo === 'traspaso' ? cuentaDestinoId : undefined,
        categoriaId: tipo === 'traspaso' ? undefined : categoriaId,
        frecuencia,
        diaDelMes: frecuencia === 'semanal' ? undefined : Number(diaDelMes),
        diaDeLaSemana: frecuencia === 'semanal' ? Number(diaDeLaSemana) : undefined,
        fechaInicio,
        fechaFin: inicial?.fechaFin,
        ultimaGeneracion: inicial?.ultimaGeneracion,
        activo: inicial?.activo ?? true,
      },
    ])
    onGuardado()
  }

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre" error={error}>
        <Entrada autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nómina" />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Tipo">
          <Desplegable value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMovimiento); setCategoriaId('') }}>
            {(Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[]).map((t) => (
              <option key={t} value={t}>{TIPOS_MOVIMIENTO[t]}</option>
            ))}
          </Desplegable>
        </Campo>
        <Campo etiqueta="Importe">
          <Entrada inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0,00" />
        </Campo>
      </div>

      {tipo !== 'traspaso' && (
        <Campo etiqueta="Categoría">
          <Desplegable value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">Elige…</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>)}
          </Desplegable>
        </Campo>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={tipo === 'traspaso' ? 'Desde' : 'Cuenta'}>
          <Desplegable value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Desplegable>
        </Campo>
        {tipo === 'traspaso' && (
          <Campo etiqueta="Hacia">
            <Desplegable value={cuentaDestinoId} onChange={(e) => setCuentaDestinoId(e.target.value)}>
              <option value="">Elige…</option>
              {cuentas.filter((c) => c.id !== cuentaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Desplegable>
          </Campo>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cada cuánto">
          <Desplegable value={frecuencia} onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}>
            {(Object.keys(FRECUENCIAS) as Frecuencia[]).map((f) => (
              <option key={f} value={f}>{FRECUENCIAS[f]}</option>
            ))}
          </Desplegable>
        </Campo>
        {frecuencia === 'semanal' ? (
          <Campo etiqueta="Día de la semana">
            <Desplegable value={diaDeLaSemana} onChange={(e) => setDiaDeLaSemana(e.target.value)}>
              {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Desplegable>
          </Campo>
        ) : (
          <Campo etiqueta="Día del mes">
            <Entrada type="number" min={1} max={31} value={diaDelMes} onChange={(e) => setDiaDelMes(e.target.value)} />
          </Campo>
        )}
      </div>

      {frecuencia !== 'semanal' && Number(diaDelMes) > 28 && (
        <Aviso tono="info">
          En los meses que no llegan al día {diaDelMes} se apuntará el último día del mes. En
          febrero será el 28, o el 29 en los años bisiestos.
        </Aviso>
      )}

      <Campo etiqueta="Empieza el">
        <Entrada type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
      </Campo>

      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1">Guardar</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}
