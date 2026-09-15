import { useState } from 'react'
import { patrimonioNeto, rendimientoInversion, saldoCuenta, ultimaValoracion, valorCuenta } from '../../dominio/calculos'
import { aTextoEditable, formatearEuros, parseImporte } from '../../dominio/dinero'
import { formatearFecha, hoy } from '../../dominio/fechas'
import { nuevoId, TIPOS_CUENTA, type Cuenta, type TipoCuenta } from '../../dominio/tipos'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Aviso, Boton, Campo, Desplegable, Entrada, EstadoVacio, Importe, Modal, Tarjeta } from '../componentes/base'

export function Cuentas() {
  const { estado, guardar, eliminarCuenta } = useFinanzas()
  const [editando, setEditando] = useState<Cuenta | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [valorando, setValorando] = useState<Cuenta | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const activas = estado.cuentas.filter((c) => !c.archivada).sort((a, b) => a.orden - b.orden)
  const archivadas = estado.cuentas.filter((c) => c.archivada)

  async function borrar(cuenta: Cuenta) {
    if (!confirm(`¿Borrar la cuenta "${cuenta.nombre}"?`)) return
    const motivo = await eliminarCuenta(cuenta.id)
    setAviso(motivo)
  }

  async function archivar(cuenta: Cuenta) {
    await guardar('cuentas', [{ ...cuenta, archivada: !cuenta.archivada }])
  }

  return (
    <div className="space-y-4">
      <Tarjeta fondo="bg-slate-900 dark:bg-white" className="text-white dark:text-slate-900">
        <p className="text-xs font-medium opacity-70">Patrimonio neto</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{formatearEuros(patrimonioNeto(estado))}</p>
        <p className="mt-1 text-xs opacity-70">
          {activas.length} {activas.length === 1 ? 'cuenta activa' : 'cuentas activas'}
        </p>
      </Tarjeta>

      {aviso && <Aviso tono="alerta">{aviso}</Aviso>}

      <div className="flex justify-end">
        <Boton
          variante="primario"
          onClick={() => {
            setEditando(null)
            setAbierto(true)
          }}
        >
          + Nueva cuenta
        </Boton>
      </div>

      {activas.length === 0 ? (
        <EstadoVacio
          icono="🏦"
          titulo="Todavía no tienes cuentas"
          descripcion="Crea tu cuenta de nómina y tu cuenta de ahorro con el saldo que tengan hoy. No hace falta que metas el historial: el saldo inicial es el punto de partida."
          accion={
            <Boton variante="primario" onClick={() => setAbierto(true)}>
              Crear cuenta
            </Boton>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {activas.map((cuenta) => {
            const esInversion = cuenta.tipo === 'inversion'
            const valor = valorCuenta(estado, cuenta.id)
            const rendimiento = esInversion ? rendimientoInversion(estado, cuenta.id) : null
            const valoracion = esInversion ? ultimaValoracion(estado, cuenta.id) : undefined

            return (
              <Tarjeta key={cuenta.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{cuenta.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{TIPOS_CUENTA[cuenta.tipo]}</p>
                  </div>
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: cuenta.color }} />
                </div>

                <p className="mt-3 text-2xl font-bold tabular-nums">
                  <Importe cents={valor} />
                </p>

                {esInversion && rendimiento && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p>
                      Aportado {formatearEuros(rendimiento.aportado)} ·{' '}
                      <span
                        className={
                          rendimiento.ganancia >= 0
                            ? 'font-semibold text-emerald-600 dark:text-emerald-400'
                            : 'font-semibold text-red-600 dark:text-red-400'
                        }
                      >
                        {rendimiento.ganancia >= 0 ? '+' : '−'}
                        {formatearEuros(Math.abs(rendimiento.ganancia))}
                        {rendimiento.porcentaje !== null && ` (${rendimiento.porcentaje.toFixed(1)} %)`}
                      </span>
                    </p>
                    <p>
                      {valoracion
                        ? `Valorado el ${formatearFecha(valoracion.fecha)}`
                        : 'Sin valorar: vale lo aportado'}
                    </p>
                  </div>
                )}

                {!esInversion && cuenta.saldoInicial !== 0 && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Saldo inicial {formatearEuros(cuenta.saldoInicial)}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {esInversion && (
                    <Boton onClick={() => setValorando(cuenta)}>Actualizar valor</Boton>
                  )}
                  <Boton
                    onClick={() => {
                      setEditando(cuenta)
                      setAbierto(true)
                    }}
                  >
                    Editar
                  </Boton>
                  <Boton variante="fantasma" onClick={() => archivar(cuenta)}>
                    Archivar
                  </Boton>
                  <Boton variante="fantasma" onClick={() => borrar(cuenta)}>
                    Borrar
                  </Boton>
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      {archivadas.length > 0 && (
        <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
            {archivadas.length} {archivadas.length === 1 ? 'cuenta archivada' : 'cuentas archivadas'}
          </summary>
          <ul className="mt-3 space-y-2">
            {archivadas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {c.nombre} · {formatearEuros(saldoCuenta(estado, c.id))}
                </span>
                <Boton variante="fantasma" onClick={() => archivar(c)}>
                  Reactivar
                </Boton>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Modal
        abierto={abierto}
        titulo={editando ? 'Editar cuenta' : 'Nueva cuenta'}
        onCerrar={() => setAbierto(false)}
      >
        <FormularioCuenta
          key={editando?.id ?? 'nueva'}
          inicial={editando ?? undefined}
          onGuardado={() => setAbierto(false)}
          onCancelar={() => setAbierto(false)}
        />
      </Modal>

      <Modal
        abierto={valorando !== null}
        titulo={`Valor de ${valorando?.nombre ?? ''}`}
        onCerrar={() => setValorando(null)}
      >
        {valorando && (
          <FormularioValoracion cuenta={valorando} onGuardado={() => setValorando(null)} />
        )}
      </Modal>
    </div>
  )
}

function FormularioCuenta({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial?: Cuenta
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [tipo, setTipo] = useState<TipoCuenta>(inicial?.tipo ?? 'corriente')
  const [saldo, setSaldo] = useState(
    inicial ? aTextoEditable(inicial.saldoInicial) : '',
  )
  const [color, setColor] = useState(inicial?.color ?? '#0ea5e9')
  const [error, setError] = useState('')

  async function enviar() {
    if (!nombre.trim()) {
      setError('Ponle un nombre')
      return
    }
    const centimos = saldo.trim() === '' ? 0 : parseImporte(saldo)
    if (centimos === null) {
      setError('El saldo inicial no se entiende')
      return
    }

    await guardar('cuentas', [
      {
        id: inicial?.id ?? nuevoId(),
        nombre: nombre.trim(),
        tipo,
        saldoInicial: centimos,
        color,
        archivada: inicial?.archivada ?? false,
        orden: inicial?.orden ?? estado.cuentas.length,
      },
    ])
    onGuardado()
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta="Nombre" error={error}>
        <Entrada
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Cuenta nómina"
        />
      </Campo>

      <Campo etiqueta="Tipo">
        <Desplegable value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
          {(Object.keys(TIPOS_CUENTA) as TipoCuenta[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS_CUENTA[t]}
            </option>
          ))}
        </Desplegable>
      </Campo>

      <Campo etiqueta={inicial ? 'Saldo inicial' : 'Saldo que tiene hoy'}>
        <Entrada inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" />
      </Campo>

      {tipo === 'tarjeta' && (
        <Aviso tono="info">
          Los gastos cargados a una tarjeta la dejan en negativo y restan del patrimonio, que es
          justo lo que hace una deuda.
        </Aviso>
      )}

      <Campo etiqueta="Color">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-10 w-full cursor-pointer rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
        />
      </Campo>

      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1">
          Guardar
        </Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}

function FormularioValoracion({ cuenta, onGuardado }: { cuenta: Cuenta; onGuardado: () => void }) {
  const { estado, guardar } = useFinanzas()
  const aportado = saldoCuenta(estado, cuenta.id)
  const [valor, setValor] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [error, setError] = useState('')

  const historico = estado.valoraciones
    .filter((v) => v.cuentaId === cuenta.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))

  async function enviar() {
    const centimos = parseImporte(valor)
    if (centimos === null) {
      setError('Escribe el valor actual')
      return
    }
    await guardar('valoraciones', [{ id: nuevoId(), cuentaId: cuenta.id, fecha, valor: centimos }])
    onGuardado()
  }

  return (
    <div className="space-y-3">
      <Aviso tono="info">
        Escribe lo que vale hoy la inversión según tu broker. Las aportaciones se registran como
        traspasos desde tu cuenta; esto es solo el valor de mercado, y la diferencia entre ambos es
        tu rendimiento.
      </Aviso>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Aportado hasta hoy: <strong className="tabular-nums">{formatearEuros(aportado)}</strong>
      </p>

      <Campo etiqueta="Valor actual" error={error}>
        <Entrada
          autoFocus
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          className="text-lg font-semibold tabular-nums"
        />
      </Campo>

      <Campo etiqueta="Fecha de la valoración">
        <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </Campo>

      <Boton variante="primario" onClick={enviar} className="w-full">
        Guardar valoración
      </Boton>

      {historico.length > 0 && (
        <div className="pt-2">
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico</h4>
          <ul className="space-y-1 text-sm">
            {historico.slice(0, 8).map((v) => (
              <li key={v.id} className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">{formatearFecha(v.fecha)}</span>
                <span className="tabular-nums">{formatearEuros(v.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
