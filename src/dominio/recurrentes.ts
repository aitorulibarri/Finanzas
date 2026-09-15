import { fecha, mesDe, partesFecha, sumarDias, sumarMeses, type FechaISO } from './fechas'
import { nuevoId, type EstadoFinanzas, type Movimiento, type Recurrente } from './tipos'

/**
 * Materialización de los movimientos que se repiten solos: la nómina, el
 * alquiler, las suscripciones.
 *
 * Esto se ejecuta en CADA arranque de la aplicación, así que tiene que ser
 * idempotente: llamarlo dos veces seguidas no puede crear la nómina dos
 * veces. Lo garantiza `ultimaGeneracion`, que avanza hasta la última
 * ocurrencia creada; la siguiente llamada arranca del día siguiente y no
 * encuentra nada que hacer (INV-5).
 *
 * Nunca se genera hacia el futuro. Si hoy es día 20 y la nómina entra el 25,
 * ese movimiento todavía no existe: se muestra aparte como previsto, porque
 * apuntarlo ya inflaría el saldo con dinero que aún no has cobrado.
 */

/** Día de la semana (0 domingo … 6 sábado) de una fecha civil. */
function diaDeLaSemanaDe(f: FechaISO): number {
  const [a, m, d] = partesFecha(f)
  return new Date(a, m - 1, d).getDay()
}

/**
 * Fechas en las que toca este recurrente dentro del intervalo, ambos
 * extremos incluidos.
 *
 * En las frecuencias mensuales el día se recorta al último del mes: un
 * recibo a día 31 cae el 28 en febrero, y sobre todo NO se salta el mes,
 * que es el fallo habitual al implementar esto con aritmética de días
 * (INV-6).
 */
export function ocurrenciasEntre(r: Recurrente, desde: FechaISO, hasta: FechaISO): FechaISO[] {
  if (desde > hasta) return []
  const fechas: FechaISO[] = []

  if (r.frecuencia === 'semanal') {
    const objetivo = r.diaDeLaSemana ?? diaDeLaSemanaDe(r.fechaInicio)
    let actual = desde
    // Avanzar como mucho seis días hasta dar con el primer día correcto.
    for (let i = 0; i < 7 && diaDeLaSemanaDe(actual) !== objetivo; i++) {
      actual = sumarDias(actual, 1)
    }
    while (actual <= hasta) {
      fechas.push(actual)
      actual = sumarDias(actual, 7)
    }
    return fechas
  }

  const dia = r.diaDelMes ?? partesFecha(r.fechaInicio)[2]
  const paso = r.frecuencia === 'trimestral' ? 3 : 1
  const mesInicio = mesDe(r.fechaInicio)

  let mes = mesDe(desde)
  const mesFinal = mesDe(hasta)

  while (mes <= mesFinal) {
    const [anio, numeroMes] = [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))]

    let toca = true
    if (r.frecuencia === 'anual') {
      toca = numeroMes === (r.mesDelAnio ?? Number(mesInicio.slice(5, 7)))
    } else if (paso === 3) {
      const distancia =
        anio * 12 + numeroMes - (Number(mesInicio.slice(0, 4)) * 12 + Number(mesInicio.slice(5, 7)))
      toca = distancia % 3 === 0
    }

    if (toca) {
      // fecha() recorta el día al último del mes en vez de desbordar al
      // siguiente, que es lo que haría new Date(2026, 1, 31).
      const f = fecha(anio, numeroMes, dia)
      if (f >= desde && f <= hasta) fechas.push(f)
    }

    mes = sumarMeses(mes, 1)
  }

  return fechas
}

export interface GeneracionRecurrentes {
  movimientos: Movimiento[]
  /** Nuevo valor de ultimaGeneracion por recurrente, solo de los que avanzaron. */
  avances: Array<{ id: string; ultimaGeneracion: FechaISO }>
}

/**
 * Los movimientos que faltan por crear desde la última vez hasta hoy.
 *
 * No escribe nada: devuelve lo que habría que guardar, para que la capa de
 * datos decida y para que esto siga siendo testeable sin base de datos.
 */
export function generarPendientes(estado: EstadoFinanzas, hoy: FechaISO): GeneracionRecurrentes {
  const movimientos: Movimiento[] = []
  const avances: GeneracionRecurrentes['avances'] = []

  for (const r of estado.recurrentes) {
    if (!r.activo) continue

    // El día siguiente a lo ya generado, o el arranque si nunca se generó.
    const desdeCandidato = r.ultimaGeneracion ? sumarDias(r.ultimaGeneracion, 1) : r.fechaInicio
    const desde = desdeCandidato > r.fechaInicio ? desdeCandidato : r.fechaInicio
    const hasta = r.fechaFin && r.fechaFin < hoy ? r.fechaFin : hoy

    const fechas = ocurrenciasEntre(r, desde, hasta)
    if (fechas.length === 0) continue

    for (const f of fechas) {
      movimientos.push({
        id: nuevoId(),
        fecha: f,
        tipo: r.tipo,
        importe: r.importe,
        cuentaId: r.cuentaId,
        cuentaDestinoId: r.cuentaDestinoId,
        categoriaId: r.categoriaId,
        descripcion: r.nombre,
        recurrenteId: r.id,
        creadoEn: new Date().toISOString(),
      })
    }

    avances.push({ id: r.id, ultimaGeneracion: fechas[fechas.length - 1] })
  }

  return { movimientos, avances }
}

export interface ProximaOcurrencia {
  recurrente: Recurrente
  fecha: FechaISO
}

/**
 * Lo que está por venir en los próximos `dias`, para avisar en el resumen.
 *
 * Son previsiones, no movimientos: no tocan ningún saldo.
 */
export function proximasOcurrencias(
  estado: EstadoFinanzas,
  hoy: FechaISO,
  dias = 30,
): ProximaOcurrencia[] {
  const hasta = sumarDias(hoy, dias)
  const proximas: ProximaOcurrencia[] = []

  for (const r of estado.recurrentes) {
    if (!r.activo) continue
    const desde = sumarDias(hoy, 1)
    const limite = r.fechaFin && r.fechaFin < hasta ? r.fechaFin : hasta
    for (const f of ocurrenciasEntre(r, desde, limite)) {
      proximas.push({ recurrente: r, fecha: f })
    }
  }

  return proximas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}
