import { describe, expect, test } from 'vitest'
import { esquemaMovimiento, esquemaRecurrente } from './esquemas'

const base = {
  id: 'm1',
  fecha: '2026-01-15',
  importe: 4500,
  cuentaId: 'c1',
  descripcion: 'Cena',
  creadoEn: '2026-01-15T20:00:00.000Z',
}

describe('el esquema impide los datos que romperían los cálculos', () => {
  test('un gasto normal es válido', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'gasto', categoriaId: 'ocio' })
    expect(r.success).toBe(true)
  })

  test('un traspaso con categoría se rechaza', () => {
    // Si pasara, consumiría presupuesto y se contaría como gasto.
    const r = esquemaMovimiento.safeParse({
      ...base, tipo: 'traspaso', cuentaDestinoId: 'c2', categoriaId: 'ocio',
    })
    expect(r.success).toBe(false)
  })

  test('un traspaso sin cuenta de destino se rechaza', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'traspaso' })
    expect(r.success).toBe(false)
  })

  test('un traspaso a la misma cuenta se rechaza', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'traspaso', cuentaDestinoId: 'c1' })
    expect(r.success).toBe(false)
  })

  test('un gasto sin categoría se rechaza', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'gasto' })
    expect(r.success).toBe(false)
  })

  test('un gasto con cuenta de destino se rechaza', () => {
    const r = esquemaMovimiento.safeParse({
      ...base, tipo: 'gasto', categoriaId: 'ocio', cuentaDestinoId: 'c2',
    })
    expect(r.success).toBe(false)
  })

  test('un importe negativo se rechaza: el signo lo pone el tipo', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'gasto', categoriaId: 'ocio', importe: -4500 })
    expect(r.success).toBe(false)
  })

  test('un importe cero se rechaza', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'gasto', categoriaId: 'ocio', importe: 0 })
    expect(r.success).toBe(false)
  })

  test('un importe con decimales se rechaza: los céntimos son enteros', () => {
    const r = esquemaMovimiento.safeParse({ ...base, tipo: 'gasto', categoriaId: 'ocio', importe: 45.5 })
    expect(r.success).toBe(false)
  })

  test('una fecha inexistente se rechaza', () => {
    const r = esquemaMovimiento.safeParse({
      ...base, tipo: 'gasto', categoriaId: 'ocio', fecha: '2026-02-30',
    })
    expect(r.success).toBe(false)
  })
})

describe('el esquema de recurrente exige los campos de su frecuencia', () => {
  const rec = {
    id: 'r1', nombre: 'Nómina', tipo: 'ingreso' as const, importe: 190000,
    cuentaId: 'c1', categoriaId: 'salario', fechaInicio: '2026-01-01', activo: true,
  }

  test('mensual sin día del mes se rechaza', () => {
    expect(esquemaRecurrente.safeParse({ ...rec, frecuencia: 'mensual' }).success).toBe(false)
  })

  test('mensual con día del mes es válido', () => {
    expect(esquemaRecurrente.safeParse({ ...rec, frecuencia: 'mensual', diaDelMes: 25 }).success).toBe(true)
  })

  test('semanal sin día de la semana se rechaza', () => {
    expect(esquemaRecurrente.safeParse({ ...rec, frecuencia: 'semanal' }).success).toBe(false)
  })

  test('fecha de fin anterior a la de inicio se rechaza', () => {
    const r = esquemaRecurrente.safeParse({
      ...rec, frecuencia: 'mensual', diaDelMes: 25, fechaFin: '2025-06-01',
    })
    expect(r.success).toBe(false)
  })
})
