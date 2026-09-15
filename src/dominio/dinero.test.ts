import { describe, expect, test } from 'vitest'
import {
  aCents,
  aTextoEditable,
  formatearEuros,
  parseImporte,
  porcentaje,
  repartir,
  sumar,
} from './dinero'

/** Intl es-ES separa importe y símbolo con espacio duro (U+00A0). */
const normalizar = (s: string) => s.replace(/\u00a0/g, ' ')

describe('INV-3: la aritmética del dinero es exacta', () => {
  test('0,10 € + 0,20 € son exactamente 0,30 €', () => {
    // Este es el test que falla si alguien reintroduce floats:
    // en coma flotante 0.1 + 0.2 === 0.30000000000000004
    const diez = parseImporte('0,10')!
    const veinte = parseImporte('0,20')!
    expect(sumar(diez, veinte)).toBe(30)
    expect(normalizar(formatearEuros(sumar(diez, veinte)))).toBe('0,30 €')
  })

  test('sumar mil importes de 0,01 € da exactamente 10,00 €', () => {
    const importes = Array.from({ length: 1000 }, () => 1)
    expect(sumar(...importes)).toBe(1000)
  })

  test('0,07 € por 3 no pierde céntimos al repartir', () => {
    const partes = repartir(7, 3)
    expect(sumar(...partes)).toBe(7)
    expect(partes).toHaveLength(3)
  })

  test('el reparto de importes negativos también conserva el total', () => {
    const partes = repartir(-100, 7)
    expect(sumar(...partes)).toBe(-100)
  })
})

describe('parseImporte acepta lo que la gente teclea de verdad', () => {
  test.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['45', 4500],
    ['0,05', 5],
    ['0,5', 50],
    ['-45,10', -4510],
    ['12,5 €', 1250],
    [' 99,99 ', 9999],
    ['+3,00', 300],
  ])('parseImporte(%o) === %i céntimos', (entrada, esperado) => {
    expect(parseImporte(entrada)).toBe(esperado)
  })

  test.each([['', null], ['abc', null], ['1,2,3', null], ['12,345', null], ['1.23.456', null]])(
    'parseImporte(%o) se rechaza',
    (entrada, esperado) => {
      expect(parseImporte(entrada)).toBe(esperado)
    },
  )

  test('el redondeo de aCents no arrastra error de coma flotante', () => {
    expect(aCents(1.005)).toBe(101)
    expect(aCents(0.1 + 0.2)).toBe(30)
  })
})

describe('porcentaje protege de la división por cero', () => {
  test('con total cero devuelve null, no NaN ni Infinity', () => {
    expect(porcentaje(500, 0)).toBeNull()
  })

  test('calcula bien el consumo de un presupuesto', () => {
    expect(porcentaje(4500, 20000)).toBeCloseTo(22.5)
  })
})

describe('aTextoEditable es la inversa exacta de parseImporte', () => {
  test.each([0, 5, 50, 100, 4500, 123456, 100000000, -4510])(
    'ida y vuelta de %i céntimos',
    (cents) => {
      // Si esta propiedad se rompiera, abrir un movimiento para editarlo y
      // guardarlo sin tocar nada le cambiaría el importe.
      expect(parseImporte(aTextoEditable(cents))).toBe(cents)
    },
  )

  test('formatea con dos decimales siempre', () => {
    expect(aTextoEditable(4500)).toBe('45,00')
    expect(aTextoEditable(5)).toBe('0,05')
    expect(aTextoEditable(50)).toBe('0,50')
    expect(aTextoEditable(123456)).toBe('1234,56')
    expect(aTextoEditable(-4510)).toBe('-45,10')
  })
})
