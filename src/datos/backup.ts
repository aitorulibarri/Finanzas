import { esquemaCopia, VERSION_ESQUEMA, type Copia } from '../dominio/esquemas'
import { hoy, sumarDias, type FechaISO } from '../dominio/fechas'
import type { Configuracion, EstadoFinanzas } from '../dominio/tipos'

/**
 * Copia de seguridad a fichero.
 *
 * Los datos de esta aplicación viven solo en IndexedDB de este navegador. Si
 * borras los datos de navegación, se van, y no hay servidor del que
 * recuperarlos. Por eso exportar no es una función accesoria: es la única
 * forma de que tu historial sobreviva a un cambio de ordenador, a un borrado
 * de caché o a un navegador que decide liberar espacio.
 *
 * La importación valida el fichero ENTERO antes de tocar nada. Un JSON
 * truncado o manipulado se rechaza con un mensaje claro en vez de dejar la
 * base a medio escribir, que sería peor que no importar.
 */

export function construirCopia(estado: EstadoFinanzas): Copia {
  return {
    version: VERSION_ESQUEMA,
    exportadoEn: new Date().toISOString(),
    estado,
  }
}

export function nombreFicheroCopia(fecha: FechaISO = hoy()): string {
  return `finanzas-backup-${fecha}.json`
}

/** Lanza la descarga del fichero en el navegador. */
export function descargarCopia(estado: EstadoFinanzas): void {
  const json = JSON.stringify(construirCopia(estado), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreFicheroCopia()
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

export interface ResumenCopia {
  exportadoEn: string
  cuentas: number
  movimientos: number
  categorias: number
  objetivos: number
  recurrentes: number
  desde?: FechaISO
  hasta?: FechaISO
}

/** Lo que se le enseña al usuario ANTES de dejarle sustituir sus datos. */
export function resumirCopia(copia: Copia): ResumenCopia {
  const fechas = copia.estado.movimientos.map((m) => m.fecha).sort()
  return {
    exportadoEn: copia.exportadoEn,
    cuentas: copia.estado.cuentas.length,
    movimientos: copia.estado.movimientos.length,
    categorias: copia.estado.categorias.length,
    objetivos: copia.estado.objetivos.length,
    recurrentes: copia.estado.recurrentes.length,
    desde: fechas[0],
    hasta: fechas.at(-1),
  }
}

export type ResultadoLectura =
  | { ok: true; copia: Copia; resumen: ResumenCopia }
  | { ok: false; error: string }

/**
 * Lee y valida un fichero de copia.
 *
 * Se comprueba la versión del formato antes que el contenido: un fichero de
 * una versión futura podría parsear a medias y corromper los datos en
 * silencio, así que se rechaza explícitamente.
 */
export function leerCopia(texto: string): ResultadoLectura {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, error: 'El fichero no es un JSON válido. ¿Se ha descargado entero?' }
  }

  if (typeof bruto !== 'object' || bruto === null) {
    return { ok: false, error: 'El fichero no tiene el formato de una copia de Finanzas.' }
  }

  const version = (bruto as { version?: unknown }).version
  if (typeof version !== 'number') {
    return { ok: false, error: 'El fichero no indica versión de formato; no parece una copia de Finanzas.' }
  }
  if (version > VERSION_ESQUEMA) {
    return {
      ok: false,
      error: `La copia es de la versión ${version} y esta aplicación entiende hasta la ${VERSION_ESQUEMA}. Actualiza la aplicación antes de importarla.`,
    }
  }

  const resultado = esquemaCopia.safeParse(bruto)
  if (!resultado.success) {
    const primero = resultado.error.issues[0]
    const donde = primero?.path.join('.') || 'el fichero'
    return { ok: false, error: `Copia inválida en ${donde}: ${primero?.message ?? 'formato incorrecto'}` }
  }

  return { ok: true, copia: resultado.data, resumen: resumirCopia(resultado.data) }
}

/** Días tras los que se avisa de que llevas mucho sin exportar. */
export const DIAS_AVISO_COPIA = 30

/**
 * ¿Toca recordar que haga una copia?
 *
 * Si nunca ha hecho ninguna y ya tiene movimientos, sí: es justo el momento
 * en que tiene algo que perder.
 */
export function necesitaCopia(
  configuracion: Configuracion,
  movimientos: number,
  hoyFecha: FechaISO = hoy(),
): boolean {
  if (movimientos === 0) return false
  if (!configuracion.ultimaCopia) return true
  return configuracion.ultimaCopia < sumarDias(hoyFecha, -DIAS_AVISO_COPIA)
}
