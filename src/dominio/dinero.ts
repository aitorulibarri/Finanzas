/**
 * El dinero se representa SIEMPRE como un entero de céntimos.
 *
 * Motivo: en coma flotante 0.1 + 0.2 !== 0.3, y en una aplicación de finanzas
 * ese error se acumula hasta descuadrar los saldos. Aquí no se usa ningún
 * `number` decimal para dinero: se parsea a céntimos en la entrada y se
 * formatea a euros solo al pintar.
 */
export type Cents = number

/**
 * Convierte un número de euros (12.34) a céntimos (1234).
 *
 * `euros * 100` no basta: 1.005 * 100 da 100.49999999999999 en coma flotante
 * y Math.round lo dejaría en 100 céntimos, perdiendo uno. Se fija la
 * precisión a cuatro decimales antes de redondear para absorber ese error.
 *
 * Aun así esta función recibe un float, así que la vía de entrada buena es
 * `parseImporte`, que trabaja sobre el texto y no pasa por coma flotante.
 */
export function aCents(euros: number): Cents {
  return Math.round(Number((euros * 100).toFixed(4)))
}

/** Convierte céntimos a euros como número decimal. Solo para gráficos y formato. */
export function aEuros(cents: Cents): number {
  return cents / 100
}

/**
 * Parsea un importe escrito por una persona y devuelve céntimos, o `null` si
 * no es interpretable.
 *
 * Acepta las formas que de verdad se teclean: "1.234,56", "1234,56",
 * "1234.56", "1.234", "45", "-45,10", "12,5 €".
 *
 * Regla de separadores: si hay una coma, la coma es el decimal y los puntos
 * son miles (convención es-ES). Si no hay coma, un punto solo es decimal
 * cuando le siguen una o dos cifras; con tres cifras detrás es separador de
 * miles, para que "1.234" sean mil doscientos treinta y cuatro euros.
 *
 * La conversión final se hace con aritmética entera sobre las dos mitades,
 * nunca con parseFloat, para no reintroducir el error de coma flotante.
 */
export function parseImporte(texto: string): Cents | null {
  if (typeof texto !== 'string') return null

  let limpio = texto.trim().replace(/[\s €]/g, '')
  if (limpio === '') return null

  let negativo = false
  if (limpio.startsWith('-')) {
    negativo = true
    limpio = limpio.slice(1)
  } else if (limpio.startsWith('+')) {
    limpio = limpio.slice(1)
  }

  if (!/^[\d.,]+$/.test(limpio)) return null

  let normalizado: string
  if (limpio.includes(',')) {
    // La coma manda: es el separador decimal y los puntos son miles.
    if ((limpio.match(/,/g) ?? []).length > 1) return null
    normalizado = limpio.replace(/\./g, '').replace(',', '.')
  } else {
    const puntos = (limpio.match(/\./g) ?? []).length
    if (puntos === 0) {
      normalizado = limpio
    } else if (puntos === 1 && /\.\d{1,2}$/.test(limpio)) {
      normalizado = limpio
    } else {
      // Varios puntos, o uno seguido de tres cifras: separadores de miles.
      if (!/^\d{1,3}(\.\d{3})+$/.test(limpio)) return null
      normalizado = limpio.replace(/\./g, '')
    }
  }

  const [entera, decimal = ''] = normalizado.split('.')
  if (entera === '' && decimal === '') return null
  if (!/^\d*$/.test(entera) || !/^\d*$/.test(decimal)) return null
  if (decimal.length > 2) return null

  const centimos = Number(entera || '0') * 100 + Number(decimal.padEnd(2, '0') || '0')
  if (!Number.isFinite(centimos)) return null

  return negativo ? -centimos : centimos
}

const formateadorEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
})

const formateadorSinDecimales = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/**
 * Formatea céntimos como "1.234,56 €".
 *
 * Ojo: Intl con locale es-ES separa el importe del símbolo con un espacio
 * duro (U+00A0), no con un espacio normal. Al comparar estas cadenas en un
 * test hay que usar el mismo carácter o normalizarlas primero.
 */
export function formatearEuros(cents: Cents, compacto = false): string {
  const f = compacto ? formateadorSinDecimales : formateadorEuros
  return f.format(aEuros(cents))
}

/** Formatea con signo explícito, para listas de movimientos. */
export function formatearConSigno(cents: Cents): string {
  const signo = cents > 0 ? '+' : ''
  return signo + formatearEuros(cents)
}

/**
 * Céntimos al texto que se mete en un campo editable: 123456 -> "1234,56".
 *
 * Es la inversa de parseImporte y hace falta al precargar los formularios de
 * edición. Va aquí y no repetida en cada formulario porque un redondeo
 * distinto en uno de ellos haría que editar y guardar sin tocar nada
 * cambiase el importe.
 */
export function aTextoEditable(cents: Cents): string {
  const signo = cents < 0 ? '-' : ''
  const absoluto = Math.abs(cents)
  return `${signo}${Math.trunc(absoluto / 100)},${String(absoluto % 100).padStart(2, '0')}`
}

/** Suma exacta en céntimos. */
export function sumar(...importes: Cents[]): Cents {
  return importes.reduce((total, i) => total + i, 0)
}

/**
 * Porcentaje que representa `parte` sobre `total`, o `null` si el total es
 * cero. Devolver null en vez de NaN o Infinity obliga a quien llama a decidir
 * qué pintar cuando no hay base de cálculo.
 */
export function porcentaje(parte: Cents, total: Cents): number | null {
  if (total === 0) return null
  return (parte / total) * 100
}

/** Reparte `cents` en `n` partes que suman exactamente el original. */
export function repartir(cents: Cents, n: number): Cents[] {
  if (n <= 0) return []
  const base = Math.trunc(cents / n)
  const resto = cents - base * n
  return Array.from({ length: n }, (_, i) => base + (i < Math.abs(resto) ? Math.sign(resto) : 0))
}
