import { describe, expect, test } from 'vitest'
import {
  diasEnMes,
  enMes,
  entre,
  esFechaValida,
  fecha,
  formatearFecha,
  hoy,
  mesDe,
  mesesEntre,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
  ultimoDiaDelMes,
  ultimosMeses,
} from './fechas'

/**
 * Esta suite se ejecuta además con `npm run test:tz`, que la corre bajo
 * TZ=Pacific/Kiritimati (UTC+14) y TZ=Pacific/Niue (UTC-11). Son los dos
 * extremos del planeta: si alguien reescribe estas funciones usando
 * `new Date(f)` o `toISOString()`, los casos de frontera de mes fallarán en
 * al menos una de las dos.
 */
describe('INV-4: la fecha civil no depende de la zona horaria', () => {
  test('el 31 de enero pertenece a enero', () => {
    expect(mesDe('2026-01-31')).toBe('2026-01')
    expect(enMes('2026-01-31', '2026-01')).toBe(true)
    expect(enMes('2026-01-31', '2026-02')).toBe(false)
  })

  test('el 1 de enero pertenece a enero, no a diciembre del año anterior', () => {
    expect(mesDe('2026-01-01')).toBe('2026-01')
    expect(enMes('2026-01-01', '2025-12')).toBe(false)
  })

  test('todos los primeros y últimos días del año caen en su mes', () => {
    for (let m = 1; m <= 12; m++) {
      const mes = `2026-${String(m).padStart(2, '0')}`
      const primero = primerDiaDelMes(mes)
      const ultimo = ultimoDiaDelMes(mes)
      expect(mesDe(primero)).toBe(mes)
      expect(mesDe(ultimo)).toBe(mes)
      expect(enMes(primero, mes)).toBe(true)
      expect(enMes(ultimo, mes)).toBe(true)
    }
  })

  test('hoy() coincide con los componentes locales del reloj', () => {
    const d = new Date()
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(hoy()).toBe(esperado)
  })

  test('hoy() tiene formato válido', () => {
    expect(esFechaValida(hoy())).toBe(true)
  })
})

describe('longitud de los meses', () => {
  test('febrero tiene 28 días en año normal y 29 en bisiesto', () => {
    expect(diasEnMes(2026, 2)).toBe(28)
    expect(diasEnMes(2028, 2)).toBe(29)
    expect(diasEnMes(2000, 2)).toBe(29)
    expect(diasEnMes(1900, 2)).toBe(28)
  })

  test('ultimoDiaDelMes acierta en los meses de 30 y 31', () => {
    expect(ultimoDiaDelMes('2026-01')).toBe('2026-01-31')
    expect(ultimoDiaDelMes('2026-02')).toBe('2026-02-28')
    expect(ultimoDiaDelMes('2028-02')).toBe('2028-02-29')
    expect(ultimoDiaDelMes('2026-04')).toBe('2026-04-30')
    expect(ultimoDiaDelMes('2026-12')).toBe('2026-12-31')
  })

  test('fecha() recorta el día al último del mes en vez de desbordar', () => {
    expect(fecha(2026, 2, 31)).toBe('2026-02-28')
    expect(fecha(2028, 2, 31)).toBe('2028-02-29')
    expect(fecha(2026, 4, 31)).toBe('2026-04-30')
    expect(fecha(2026, 1, 31)).toBe('2026-01-31')
  })
})

describe('aritmética de meses y días', () => {
  test('sumarMeses cruza el fin de año en ambos sentidos', () => {
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(sumarMeses('2026-06', 12)).toBe('2027-06')
    expect(sumarMeses('2026-06', -18)).toBe('2024-12')
    expect(sumarMeses('2026-06', 0)).toBe('2026-06')
  })

  test('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29')
    expect(sumarDias('2026-01-01', 0)).toBe('2026-01-01')
  })

  test('ultimosMeses devuelve la serie en orden cronológico', () => {
    expect(ultimosMeses('2026-03', 4)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03'])
    expect(ultimosMeses('2026-03', 1)).toEqual(['2026-03'])
  })

  test('mesesEntre cuenta la distancia con signo', () => {
    expect(mesesEntre('2026-01', '2026-06')).toBe(5)
    expect(mesesEntre('2026-06', '2026-01')).toBe(-5)
    expect(mesesEntre('2026-01', '2026-01')).toBe(0)
  })
})

describe('validación y formato', () => {
  test.each([
    ['2026-01-31', true],
    ['2026-02-29', false],
    ['2028-02-29', true],
    ['2026-13-01', false],
    ['2026-00-10', false],
    ['2026-04-31', false],
    ['26-01-31', false],
    ['2026-1-1', false],
    ['', false],
  ])('esFechaValida(%o) === %o', (entrada, esperado) => {
    expect(esFechaValida(entrada)).toBe(esperado)
  })

  test('formatearFecha usa dd/mm/aaaa', () => {
    expect(formatearFecha('2026-01-05')).toBe('05/01/2026')
    expect(formatearFecha('2026-12-31')).toBe('31/12/2026')
  })

  test('entre() incluye ambos extremos y tolera límites abiertos', () => {
    expect(entre('2026-01-15', '2026-01-01', '2026-01-31')).toBe(true)
    expect(entre('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true)
    expect(entre('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true)
    expect(entre('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false)
    expect(entre('2026-02-01', undefined, undefined)).toBe(true)
    expect(entre('2026-02-01', '2026-01-01', undefined)).toBe(true)
  })
})
