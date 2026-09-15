import { describe, expect, test } from 'vitest'
import {
  borrarCategoria,
  borrarCuenta,
  borrarMovimiento,
  borrarObjetivo,
  borrarRecurrente,
  estaBloqueado,
} from './integridad'
import { progresoObjetivo } from './calculos'
import { unaAportacion, unaCategoria, unaCuenta, unEstado, unMovimiento, unObjetivo } from './fixtures'
import { aplicarCascadaEnMemoria } from '../datos/repositorio'
import type { EstadoFinanzas } from './tipos'

describe('INV-9: ningún borrado deja números incorrectos detrás', () => {
  test('borrar un traspaso asignado a un objetivo se lleva su aportación', () => {
    // Sin esto el objetivo seguiría mostrando progreso respaldado por dinero
    // que ya no se movió.
    const estado: EstadoFinanzas = unEstado({
      objetivos: [unObjetivo({ id: 'o1', objetivo: 300000 })],
      movimientos: [
        unMovimiento({ id: 'm1', tipo: 'traspaso', cuentaId: 'c1', cuentaDestinoId: 'c2', categoriaId: undefined, importe: 30000 }),
      ],
      aportaciones: [unaAportacion({ id: 'a1', objetivoId: 'o1', movimientoId: 'm1', importe: 30000 })],
    })

    expect(progresoObjetivo(estado, estado.objetivos[0], '2026-01-31').aportado).toBe(30000)

    const cascada = borrarMovimiento(estado, 'm1')
    expect(cascada.aportaciones).toEqual(['a1'])

    const despues = aplicarCascadaEnMemoria(estado, cascada)
    expect(despues.movimientos).toHaveLength(0)
    expect(despues.aportaciones).toHaveLength(0)
    expect(progresoObjetivo(despues, despues.objetivos[0], '2026-01-31').aportado).toBe(0)
  })

  test('borrar un movimiento normal no toca aportaciones de otros', () => {
    const estado = unEstado({
      movimientos: [unMovimiento({ id: 'm1' }), unMovimiento({ id: 'm2' })],
      aportaciones: [unaAportacion({ id: 'a1', movimientoId: 'm2' })],
    })
    const cascada = borrarMovimiento(estado, 'm1')
    expect(cascada.aportaciones).toEqual([])
  })

  test('borrar una categoría reasigna sus movimientos en vez de dejarlos huérfanos', () => {
    const estado = unEstado({
      categorias: [
        unaCategoria({ id: 'k-ocio', nombre: 'Ocio' }),
        unaCategoria({ id: 'k-otros', nombre: 'Otros' }),
      ],
      movimientos: [
        unMovimiento({ id: 'm1', categoriaId: 'k-ocio', importe: 4500 }),
        unMovimiento({ id: 'm2', categoriaId: 'k-otros', importe: 1000 }),
      ],
    })

    const cascada = borrarCategoria(estado, 'k-ocio', 'k-otros')
    expect(estaBloqueado(cascada)).toBe(false)
    if (estaBloqueado(cascada)) return

    const despues = aplicarCascadaEnMemoria(estado, cascada)
    expect(despues.categorias.map((c) => c.id)).toEqual(['k-otros'])
    // Ningún movimiento apunta a una categoría inexistente.
    const ids = new Set(despues.categorias.map((c) => c.id))
    for (const m of despues.movimientos) {
      expect(ids.has(m.categoriaId!)).toBe(true)
    }
  })

  test('borrar una categoría madre arrastra y reasigna también sus hijas', () => {
    const estado = unEstado({
      categorias: [
        unaCategoria({ id: 'k-ocio' }),
        unaCategoria({ id: 'k-viajes', padreId: 'k-ocio' }),
        unaCategoria({ id: 'k-otros' }),
      ],
      movimientos: [unMovimiento({ id: 'm1', categoriaId: 'k-viajes' })],
    })

    const cascada = borrarCategoria(estado, 'k-ocio', 'k-otros')
    if (estaBloqueado(cascada)) throw new Error('no debería bloquear')

    const despues = aplicarCascadaEnMemoria(estado, cascada)
    expect(despues.categorias.map((c) => c.id)).toEqual(['k-otros'])
    expect(despues.movimientos[0].categoriaId).toBe('k-otros')
  })

  test('reasignar una categoría a sí misma se bloquea', () => {
    const estado = unEstado({ categorias: [unaCategoria({ id: 'k1' })] })
    const r = borrarCategoria(estado, 'k1', 'k1')
    expect(estaBloqueado(r)).toBe(true)
  })

  test('borrar una cuenta con movimientos se bloquea y explica por qué', () => {
    const estado = unEstado({
      cuentas: [unaCuenta({ id: 'c1' })],
      movimientos: [unMovimiento({ id: 'm1', cuentaId: 'c1' })],
    })
    const r = borrarCuenta(estado, 'c1')
    expect(estaBloqueado(r)).toBe(true)
    if (estaBloqueado(r)) expect(r.motivo).toContain('Archívala')
  })

  test('borrar una cuenta que es destino de un traspaso también se bloquea', () => {
    const estado = unEstado({
      cuentas: [unaCuenta({ id: 'c1' }), unaCuenta({ id: 'c2' })],
      movimientos: [
        unMovimiento({ tipo: 'traspaso', cuentaId: 'c1', cuentaDestinoId: 'c2', categoriaId: undefined }),
      ],
    })
    expect(estaBloqueado(borrarCuenta(estado, 'c2'))).toBe(true)
  })

  test('una cuenta vacía sí se puede borrar', () => {
    const estado = unEstado({ cuentas: [unaCuenta({ id: 'c1' })] })
    const r = borrarCuenta(estado, 'c1')
    expect(estaBloqueado(r)).toBe(false)
  })

  test('borrar un objetivo se lleva sus aportaciones', () => {
    const estado = unEstado({
      objetivos: [unObjetivo({ id: 'o1' }), unObjetivo({ id: 'o2' })],
      aportaciones: [
        unaAportacion({ id: 'a1', objetivoId: 'o1' }),
        unaAportacion({ id: 'a2', objetivoId: 'o2' }),
      ],
    })
    const cascada = borrarObjetivo(estado, 'o1')
    const despues = aplicarCascadaEnMemoria(estado, cascada)
    expect(despues.aportaciones.map((a) => a.id)).toEqual(['a2'])
  })

  test('borrar un recurrente NO borra las nóminas que ya cobraste', () => {
    // Son dinero que de verdad se movió: borrarlas descuadraría los saldos.
    const estado = unEstado({
      recurrentes: [
        {
          id: 'r1', nombre: 'Nómina', tipo: 'ingreso', importe: 190000, cuentaId: 'c1',
          categoriaId: 'k1', frecuencia: 'mensual', diaDelMes: 25,
          fechaInicio: '2026-01-01', activo: true,
        },
      ],
      movimientos: [
        unMovimiento({ id: 'm1', tipo: 'ingreso', recurrenteId: 'r1', importe: 190000 }),
        unMovimiento({ id: 'm2', tipo: 'ingreso', recurrenteId: 'r1', importe: 190000 }),
      ],
    })

    const cascada = borrarRecurrente(estado, 'r1')
    const despues = aplicarCascadaEnMemoria(estado, cascada)

    expect(despues.recurrentes).toHaveLength(0)
    expect(despues.movimientos).toHaveLength(2)
    // Pero ya no apuntan a un recurrente que no existe.
    expect(despues.movimientos.every((m) => m.recurrenteId === undefined)).toBe(true)
  })
})
