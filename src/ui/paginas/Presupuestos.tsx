import { useMemo, useState } from 'react'
import { categoriasDe, consumosDelMes, presupuestoAplicable } from '../../dominio/calculos'
import { formatearEuros, parseImporte, porcentaje, sumar } from '../../dominio/dinero'
import { formatearMes, mesActual, sumarMeses } from '../../dominio/fechas'
import { nuevoId } from '../../dominio/tipos'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Aviso, BarraProgreso, Boton, Campo, Desplegable, Entrada, EstadoVacio, Modal, Tarjeta } from '../componentes/base'

export function Presupuestos() {
  const { estado, eliminar } = useFinanzas()
  const [mes, setMes] = useState(mesActual())
  const [abierto, setAbierto] = useState(false)

  const consumos = useMemo(() => consumosDelMes(estado, mes), [estado, mes])
  const totalLimite = sumar(...consumos.map((c) => c.limite))
  const totalGastado = sumar(...consumos.map((c) => c.gastado))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">←</Boton>
          <span className="min-w-40 text-center text-sm font-semibold capitalize">{formatearMes(mes)}</span>
          <Boton variante="fantasma" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">→</Boton>
        </div>
        <Boton variante="primario" onClick={() => setAbierto(true)}>+ Presupuesto</Boton>
      </div>

      {consumos.length === 0 ? (
        <EstadoVacio
          icono="🎯"
          titulo="Sin presupuestos todavía"
          descripcion="Un presupuesto es un límite mensual por categoría. No es una imposición: sirve para enterarte de que llevas gastados 180 € en Ocio antes de que acabe el mes, no después."
          accion={<Boton variante="primario" onClick={() => setAbierto(true)}>Crear presupuesto</Boton>}
        />
      ) : (
        <>
          <Tarjeta>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold">Total presupuestado</span>
              <span className="text-sm tabular-nums">
                {formatearEuros(totalGastado)} de {formatearEuros(totalLimite)}
              </span>
            </div>
            <BarraProgreso
              porcentaje={porcentaje(totalGastado, totalLimite) ?? 0}
              color={totalGastado > totalLimite ? 'bg-red-500' : 'bg-viz-gastos'}
            />
          </Tarjeta>

          <div className="grid gap-3 sm:grid-cols-2">
            {consumos.map((c) => (
              <Tarjeta key={c.presupuesto.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span aria-hidden>{c.categoria.icono}</span>
                    {c.categoria.nombre}
                  </span>
                  <Boton
                    variante="fantasma"
                    className="!px-2 !py-1"
                    onClick={() => {
                      if (confirm(`¿Quitar el presupuesto de ${c.categoria.nombre}?`))
                        void eliminar('presupuestos', [c.presupuesto.id])
                    }}
                    aria-label={`Quitar presupuesto de ${c.categoria.nombre}`}
                  >
                    🗑️
                  </Boton>
                </div>

                <p className="mt-2 text-2xl font-bold tabular-nums">
                  {formatearEuros(Math.abs(c.restante))}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {c.superado ? 'de más sobre el límite' : 'te quedan este mes'}
                </p>

                <div className="mt-3">
                  <BarraProgreso
                    porcentaje={c.porcentaje ?? 0}
                    color={c.superado ? 'bg-red-500' : (c.porcentaje ?? 0) > 80 ? 'bg-amber-500' : 'bg-viz-gastos'}
                  />
                  <p className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">{formatearEuros(c.gastado)} de {formatearEuros(c.limite)}</span>
                    <span className="tabular-nums">{(c.porcentaje ?? 0).toFixed(0)} %</span>
                  </p>
                </div>

                {c.presupuesto.mes !== null && (
                  <p className="mt-2 text-xs text-slate-400">Solo para este mes</p>
                )}
              </Tarjeta>
            ))}
          </div>
        </>
      )}

      <Modal abierto={abierto} titulo="Nuevo presupuesto" onCerrar={() => setAbierto(false)}>
        <FormularioPresupuesto mes={mes} onGuardado={() => setAbierto(false)} onCancelar={() => setAbierto(false)} />
      </Modal>
    </div>
  )
}

function FormularioPresupuesto({
  mes, onGuardado, onCancelar,
}: {
  mes: string
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const categorias = categoriasDe(estado, 'gasto')
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
  const [importe, setImporte] = useState('')
  const [soloEsteMes, setSoloEsteMes] = useState(false)
  const [error, setError] = useState('')

  const yaExiste = presupuestoAplicable(estado.presupuestos, categoriaId, mes)

  async function enviar() {
    const centimos = parseImporte(importe)
    if (centimos === null || centimos <= 0) {
      setError('Escribe un límite mayor que cero')
      return
    }
    await guardar('presupuestos', [
      {
        id: yaExiste && (yaExiste.mes === (soloEsteMes ? mes : null)) ? yaExiste.id : nuevoId(),
        categoriaId,
        importeMensual: centimos,
        mes: soloEsteMes ? mes : null,
      },
    ])
    onGuardado()
  }

  return (
    <div className="space-y-3">
      <Campo etiqueta="Categoría">
        <Desplegable value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
          ))}
        </Desplegable>
      </Campo>

      <Campo etiqueta="Límite al mes" error={error}>
        <Entrada
          autoFocus inputMode="decimal" value={importe}
          onChange={(e) => setImporte(e.target.value)} placeholder="200,00"
          className="text-lg font-semibold tabular-nums"
        />
      </Campo>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={soloEsteMes}
          onChange={(e) => setSoloEsteMes(e.target.checked)}
          className="size-4 rounded border-slate-300"
        />
        Solo para {formatearMes(mes)}
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sin marcar, el límite se repite todos los meses. Marcado, se aplica solo a este y el
        resto de meses mantienen el habitual.
      </p>

      {yaExiste && (
        <Aviso tono="alerta">
          Ya hay un presupuesto para esta categoría ({formatearEuros(yaExiste.importeMensual)}
          {yaExiste.mes ? ' solo para este mes' : ' todos los meses'}).
          {yaExiste.mes === (soloEsteMes ? mes : null) ? ' Se sustituirá.' : ' El más específico tendrá prioridad.'}
        </Aviso>
      )}

      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1">Guardar</Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}
