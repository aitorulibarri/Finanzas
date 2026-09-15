import { useMemo, useState } from 'react'
import { aTextoEditable, parseImporte } from '../../dominio/dinero'
import { hoy } from '../../dominio/fechas'
import { esquemaMovimiento } from '../../dominio/esquemas'
import { nuevoId, TIPOS_MOVIMIENTO, type Movimiento, type TipoMovimiento } from '../../dominio/tipos'
import { cuentasActivas, categoriasDe } from '../../dominio/calculos'
import { useFinanzas } from '../../estado/FinanzasContext'
import { Aviso, Boton, Campo, Desplegable, Entrada } from './base'

/**
 * Alta y edición de movimientos.
 *
 * Optimizado para la vía rápida: importe, categoría, guardar. La fecha
 * arranca en hoy y la cuenta en la preferida, que son los valores correctos
 * la mayoría de las veces. El campo de importe usa inputMode decimal para
 * que en el móvil salga el teclado numérico directamente.
 *
 * Al elegir traspaso desaparece la categoría y aparece la cuenta de destino:
 * la interfaz refleja que un traspaso no es un gasto categorizable, la misma
 * regla que imponen los esquemas.
 */
export function FormularioMovimiento({
  inicial,
  onGuardado,
  onCancelar,
}: {
  inicial?: Movimiento
  onGuardado: () => void
  onCancelar: () => void
}) {
  const { estado, guardar } = useFinanzas()
  const cuentas = useMemo(() => cuentasActivas(estado), [estado])

  const [tipo, setTipo] = useState<TipoMovimiento>(inicial?.tipo ?? 'gasto')
  const [importe, setImporte] = useState(
    inicial ? aTextoEditable(inicial.importe) : '',
  )
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoy())
  const [cuentaId, setCuentaId] = useState(
    inicial?.cuentaId ?? estado.configuracion.cuentaPorDefectoId ?? cuentas[0]?.id ?? '',
  )
  const [cuentaDestinoId, setCuentaDestinoId] = useState(inicial?.cuentaDestinoId ?? '')
  const [categoriaId, setCategoriaId] = useState(inicial?.categoriaId ?? '')
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '')
  const [errores, setErrores] = useState<Record<string, string>>({})

  const categorias = useMemo(
    () => (tipo === 'traspaso' ? [] : categoriasDe(estado, tipo)),
    [estado, tipo],
  )

  /**
   * Al cambiar de tipo, la categoría elegida puede dejar de ser válida: un
   * traspaso no lleva ninguna, y las de gasto no sirven para un ingreso.
   *
   * Se resuelve aquí, en el evento que provoca el cambio, y no en un efecto:
   * un efecto que llama a setState dispara un render en cascada y deja un
   * instante con el formulario en un estado imposible.
   */
  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    if (nuevo === 'traspaso') {
      setCategoriaId('')
    } else if (categoriaId && !categoriasDe(estado, nuevo).some((c) => c.id === categoriaId)) {
      setCategoriaId('')
    }
  }

  async function enviar() {
    const centimos = parseImporte(importe)
    if (centimos === null || centimos <= 0) {
      setErrores({ importe: 'Escribe un importe mayor que cero' })
      return
    }

    const candidato: Movimiento = {
      id: inicial?.id ?? nuevoId(),
      fecha,
      tipo,
      importe: centimos,
      cuentaId,
      cuentaDestinoId: tipo === 'traspaso' ? cuentaDestinoId || undefined : undefined,
      categoriaId: tipo === 'traspaso' ? undefined : categoriaId || undefined,
      descripcion: descripcion.trim() || nombrePorDefecto(),
      notas: inicial?.notas,
      recurrenteId: inicial?.recurrenteId,
      creadoEn: inicial?.creadoEn ?? new Date().toISOString(),
    }

    // La misma validación que protege la copia de seguridad protege el alta.
    const resultado = esquemaMovimiento.safeParse(candidato)
    if (!resultado.success) {
      const mapa: Record<string, string> = {}
      for (const issue of resultado.error.issues) {
        mapa[String(issue.path[0] ?? 'general')] = issue.message
      }
      setErrores(mapa)
      return
    }

    await guardar('movimientos', [candidato])
    onGuardado()
  }

  function nombrePorDefecto() {
    if (tipo === 'traspaso') return 'Traspaso'
    const categoria = categorias.find((c) => c.id === categoriaId)
    return categoria?.nombre ?? TIPOS_MOVIMIENTO[tipo]
  }

  // Sin ninguna cuenta no hay dónde apuntar el movimiento. Decirlo aquí
  // evita que el usuario rellene el formulario entero y choque al guardar
  // con un error de validación que no le dice qué hacer.
  if (cuentas.length === 0) {
    return (
      <div className="space-y-4">
        <Aviso tono="alerta">
          Antes de apuntar movimientos necesitas al menos una cuenta donde
          registrarlos.
        </Aviso>
        <div className="flex gap-2">
          <Boton
            variante="primario"
            className="flex-1"
            onClick={() => {
              window.location.hash = '/cuentas'
              onCancelar()
            }}
          >
            Crear una cuenta
          </Boton>
          <Boton onClick={onCancelar}>Cancelar</Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selector de tipo */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => cambiarTipo(t)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tipo === t
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {TIPOS_MOVIMIENTO[t]}
          </button>
        ))}
      </div>

      <Campo etiqueta="Importe" error={errores.importe}>
        <div className="relative">
          <Entrada
            // inputMode decimal saca el teclado numérico en el móvil.
            inputMode="decimal"
            autoFocus
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="0,00"
            className="!py-3 pr-8 text-2xl font-semibold tabular-nums"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-slate-400">
            €
          </span>
        </div>
      </Campo>

      {tipo !== 'traspaso' && (
        <Campo etiqueta="Categoría" error={errores.categoriaId}>
          <div className="flex flex-wrap gap-1.5">
            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  categoriaId === c.id
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span aria-hidden>{c.icono}</span>
                {c.nombre}
              </button>
            ))}
          </div>
        </Campo>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={tipo === 'traspaso' ? 'Desde' : 'Cuenta'} error={errores.cuentaId}>
          <Desplegable value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Desplegable>
        </Campo>

        {tipo === 'traspaso' ? (
          <Campo etiqueta="Hacia" error={errores.cuentaDestinoId}>
            <Desplegable value={cuentaDestinoId} onChange={(e) => setCuentaDestinoId(e.target.value)}>
              <option value="">Elige cuenta…</option>
              {cuentas
                .filter((c) => c.id !== cuentaId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
            </Desplegable>
          </Campo>
        ) : (
          <Campo etiqueta="Fecha" error={errores.fecha}>
            <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Campo>
        )}
      </div>

      {tipo === 'traspaso' && (
        <Campo etiqueta="Fecha" error={errores.fecha}>
          <Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      )}

      <Campo etiqueta="Concepto (opcional)">
        <Entrada
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder={nombrePorDefecto()}
        />
      </Campo>

      <div className="flex gap-2 pt-1">
        <Boton variante="primario" onClick={enviar} className="flex-1 !py-2.5">
          {inicial ? 'Guardar cambios' : 'Añadir'}
        </Boton>
        <Boton onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  )
}
