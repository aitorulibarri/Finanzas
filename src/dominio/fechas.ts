/**
 * Las fechas se representan SIEMPRE como el string 'YYYY-MM-DD'.
 *
 * Motivo: si se guardara un `Date` o un timestamp ISO, un gasto del 31 de
 * enero a las 23:00 en Madrid pasaría a ser 1 de febrero al convertir a UTC,
 * y aparecería en el mes equivocado. Con un string de fecha civil no hay
 * conversión posible: el 2026-01-31 está en enero desde cualquier zona
 * horaria del mundo.
 *
 * Toda operación de calendario de este módulo construye el `Date` con el
 * constructor local `new Date(a, m, d)` y lo lee con getFullYear/getMonth/
 * getDate, que también son locales. Nunca se usa toISOString().
 */

/** Fecha civil en formato 'YYYY-MM-DD'. */
export type FechaISO = string

/** Mes civil en formato 'YYYY-MM'. */
export type MesISO = string

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** Construye una FechaISO. El día se recorta al último del mes si se pasa. */
export function fecha(anio: number, mes: number, dia: number): FechaISO {
  const diaValido = Math.min(dia, diasEnMes(anio, mes))
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(diaValido)}`
}

/** Fecha de hoy en la zona horaria del usuario. */
export function hoy(): FechaISO {
  const d = new Date()
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/** Mes actual en la zona horaria del usuario. */
export function mesActual(): MesISO {
  return mesDe(hoy())
}

/** Extrae el mes de una fecha. Operación de string pura: inmune a zona horaria. */
export function mesDe(f: FechaISO): MesISO {
  return f.slice(0, 7)
}

/** ¿Pertenece esta fecha a este mes? */
export function enMes(f: FechaISO, mes: MesISO): boolean {
  return f.startsWith(mes)
}

/** ¿Está la fecha dentro del intervalo, ambos extremos incluidos? */
export function entre(f: FechaISO, desde: FechaISO | undefined, hasta: FechaISO | undefined): boolean {
  if (desde && f < desde) return false
  if (hasta && f > hasta) return false
  return true
}

export function esFechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false
  const [a, m, d] = f.split('-').map(Number)
  if (m < 1 || m > 12) return false
  return d >= 1 && d <= diasEnMes(a, m)
}

export function esMesValido(m: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(m)) return false
  const mes = Number(m.slice(5, 7))
  return mes >= 1 && mes <= 12
}

/** Número de días del mes. El día 0 del mes siguiente es el último de este. */
export function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/** Último día del mes como FechaISO. */
export function ultimoDiaDelMes(mes: MesISO): FechaISO {
  const [a, m] = partesMes(mes)
  return fecha(a, m, diasEnMes(a, m))
}

/** Primer día del mes como FechaISO. */
export function primerDiaDelMes(mes: MesISO): FechaISO {
  return `${mes}-01`
}

function partesMes(mes: MesISO): [number, number] {
  return [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))]
}

export function partesFecha(f: FechaISO): [number, number, number] {
  return [Number(f.slice(0, 4)), Number(f.slice(5, 7)), Number(f.slice(8, 10))]
}

/** Suma (o resta, con n negativo) meses a un MesISO. */
export function sumarMeses(mes: MesISO, n: number): MesISO {
  const [a, m] = partesMes(mes)
  const total = a * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${dosDigitos((total % 12) + 1)}`
}

/** Suma días a una fecha, cruzando meses y años correctamente. */
export function sumarDias(f: FechaISO, n: number): FechaISO {
  const [a, m, d] = partesFecha(f)
  const fin = new Date(a, m - 1, d + n)
  return `${fin.getFullYear()}-${dosDigitos(fin.getMonth() + 1)}-${dosDigitos(fin.getDate())}`
}

/**
 * Los `n` meses que terminan en `mes`, del más antiguo al más reciente.
 * Para las series del resumen.
 */
export function ultimosMeses(mes: MesISO, n: number): MesISO[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(mes, i - (n - 1)))
}

const nombresMes = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** 'dd/mm/aaaa' para pintar. */
export function formatearFecha(f: FechaISO): string {
  const [a, m, d] = partesFecha(f)
  return `${dosDigitos(d)}/${dosDigitos(m)}/${a}`
}

/** 'enero de 2026' para cabeceras. */
export function formatearMes(mes: MesISO): string {
  const [a, m] = partesMes(mes)
  return `${nombresMes[m - 1]} de ${a}`
}

/** '31 de enero' para agrupar movimientos por día. */
export function formatearDia(f: FechaISO): string {
  const [, m, d] = partesFecha(f)
  return `${d} de ${nombresMes[m - 1]}`
}

/** Meses completos entre dos meses, incluidos ambos. */
export function mesesEntre(desde: MesISO, hasta: MesISO): number {
  const [a1, m1] = partesMes(desde)
  const [a2, m2] = partesMes(hasta)
  return (a2 * 12 + m2) - (a1 * 12 + m1)
}
