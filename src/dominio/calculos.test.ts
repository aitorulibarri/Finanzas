import { beforeEach, describe, expect, test } from 'vitest'
import {
  ahorroDelMes,
  consumoPresupuesto,
  gastosDelMes,
  gastosPorCategoria,
  ingresosDelMes,
  patrimonioNeto,
  presupuestoAplicable,
  progresoObjetivo,
  rendimientoInversion,
  saldoCuenta,
  tasaAhorro,
  valorCuenta,
} from './calculos'
import {
  unEstado,
  unaAportacion,
  unaCategoria,
  unaCuenta,
  unaValoracion,
  unMovimiento,
  unObjetivo,
  unPresupuesto,
} from './fixtures'
import type { EstadoFinanzas } from './tipos'

const NOMINA = 'c-nomina'
const AHORRO = 'c-ahorro'
const OCIO = 'k-ocio'
const SALARIO = 'k-salario'

function estadoBase(): EstadoFinanzas {
  return unEstado({
    cuentas: [
      unaCuenta({ id: NOMINA, nombre: 'Cuenta nómina', tipo: 'corriente', saldoInicial: 120000 }),
      unaCuenta({ id: AHORRO, nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 300000 }),
    ],
    categorias: [
      unaCategoria({ id: OCIO, nombre: 'Ocio', tipo: 'gasto' }),
      unaCategoria({ id: SALARIO, nombre: 'Salario', tipo: 'ingreso' }),
    ],
  })
}

describe('INV-1: un traspaso no altera el patrimonio neto', () => {
  let estado: EstadoFinanzas

  beforeEach(() => {
    estado = estadoBase()
  })

  test('el patrimonio es el mismo antes y después de mover dinero entre cuentas propias', () => {
    // Este es EL bug de las aplicaciones de finanzas: contar como gasto el
    // dinero que solo has cambiado de bolsillo.
    const antes = patrimonioNeto(estado)
    expect(antes).toBe(420000)

    estado.movimientos.push(
      unMovimiento({
        tipo: 'traspaso',
        importe: 30000,
        cuentaId: NOMINA,
        cuentaDestinoId: AHORRO,
        categoriaId: undefined,
        descripcion: 'A la hucha',
      }),
    )

    expect(patrimonioNeto(estado)).toBe(antes)
  })

  test('el traspaso sí mueve el saldo de cada cuenta por separado', () => {
    estado.movimientos.push(
      unMovimiento({
        tipo: 'traspaso', importe: 30000, cuentaId: NOMINA,
        cuentaDestinoId: AHORRO, categoriaId: undefined,
      }),
    )
    expect(saldoCuenta(estado, NOMINA)).toBe(90000)
    expect(saldoCuenta(estado, AHORRO)).toBe(330000)
  })

  test('diez traspasos de ida y vuelta dejan el patrimonio exactamente igual', () => {
    const antes = patrimonioNeto(estado)
    for (let i = 0; i < 10; i++) {
      estado.movimientos.push(
        unMovimiento({ tipo: 'traspaso', importe: 777, cuentaId: NOMINA, cuentaDestinoId: AHORRO, categoriaId: undefined }),
        unMovimiento({ tipo: 'traspaso', importe: 777, cuentaId: AHORRO, cuentaDestinoId: NOMINA, categoriaId: undefined }),
      )
    }
    expect(patrimonioNeto(estado)).toBe(antes)
  })
})

describe('INV-2: un traspaso no es ingreso, ni gasto, ni consume presupuesto', () => {
  let estado: EstadoFinanzas

  beforeEach(() => {
    estado = estadoBase()
    estado.movimientos.push(
      unMovimiento({ tipo: 'ingreso', importe: 190000, cuentaId: NOMINA, categoriaId: SALARIO, fecha: '2026-01-25' }),
      unMovimiento({ tipo: 'gasto', importe: 4500, cuentaId: NOMINA, categoriaId: OCIO, fecha: '2026-01-10' }),
      unMovimiento({
        tipo: 'traspaso', importe: 30000, cuentaId: NOMINA,
        cuentaDestinoId: AHORRO, categoriaId: undefined, fecha: '2026-01-26',
      }),
    )
  })

  test('no aparece en los ingresos del mes', () => {
    expect(ingresosDelMes(estado, '2026-01')).toBe(190000)
  })

  test('no aparece en los gastos del mes', () => {
    expect(gastosDelMes(estado, '2026-01')).toBe(4500)
  })

  test('el ahorro del mes no lo cuenta dos veces', () => {
    expect(ahorroDelMes(estado, '2026-01')).toBe(185500)
  })

  test('no consume el presupuesto de ninguna categoría', () => {
    const presupuesto = unPresupuesto({ categoriaId: OCIO, importeMensual: 20000 })
    estado.presupuestos.push(presupuesto)
    const consumo = consumoPresupuesto(estado, presupuesto, '2026-01')!
    expect(consumo.gastado).toBe(4500)
    expect(consumo.porcentaje).toBeCloseTo(22.5)
    expect(consumo.superado).toBe(false)
  })

  test('no aparece en el desglose de gastos por categoría', () => {
    const desglose = gastosPorCategoria(estado, '2026-01')
    expect(desglose).toHaveLength(1)
    expect(desglose[0].importe).toBe(4500)
  })
})

describe('INV-7: la tasa de ahorro no produce NaN ni Infinity', () => {
  test('sin ingresos devuelve null en vez de dividir por cero', () => {
    const estado = estadoBase()
    estado.movimientos.push(unMovimiento({ tipo: 'gasto', importe: 4500, cuentaId: NOMINA, categoriaId: OCIO }))
    expect(ingresosDelMes(estado, '2026-01')).toBe(0)
    expect(tasaAhorro(estado, '2026-01')).toBeNull()
  })

  test('un mes vacío también devuelve null', () => {
    expect(tasaAhorro(estadoBase(), '2026-01')).toBeNull()
  })

  test('con ingresos calcula el porcentaje real', () => {
    const estado = estadoBase()
    estado.movimientos.push(
      unMovimiento({ tipo: 'ingreso', importe: 200000, cuentaId: NOMINA, categoriaId: SALARIO }),
      unMovimiento({ tipo: 'gasto', importe: 50000, cuentaId: NOMINA, categoriaId: OCIO }),
    )
    expect(tasaAhorro(estado, '2026-01')).toBeCloseTo(75)
  })

  test('gastar más de lo que entra da una tasa negativa, no un error', () => {
    const estado = estadoBase()
    estado.movimientos.push(
      unMovimiento({ tipo: 'ingreso', importe: 100000, cuentaId: NOMINA, categoriaId: SALARIO }),
      unMovimiento({ tipo: 'gasto', importe: 150000, cuentaId: NOMINA, categoriaId: OCIO }),
    )
    expect(tasaAhorro(estado, '2026-01')).toBeCloseTo(-50)
  })
})

describe('INV-8: el saldo sale del inicial más los movimientos', () => {
  test('una cuenta sin movimientos vale su saldo inicial', () => {
    const estado = estadoBase()
    expect(saldoCuenta(estado, NOMINA)).toBe(120000)
  })

  test('una cuenta inexistente vale cero en vez de reventar', () => {
    expect(saldoCuenta(estadoBase(), 'no-existe')).toBe(0)
  })

  test('el saldo hasta una fecha ignora los movimientos posteriores', () => {
    const estado = estadoBase()
    estado.movimientos.push(
      unMovimiento({ tipo: 'gasto', importe: 10000, cuentaId: NOMINA, categoriaId: OCIO, fecha: '2026-01-10' }),
      unMovimiento({ tipo: 'gasto', importe: 50000, cuentaId: NOMINA, categoriaId: OCIO, fecha: '2026-02-10' }),
    )
    expect(saldoCuenta(estado, NOMINA, '2026-01-31')).toBe(110000)
    expect(saldoCuenta(estado, NOMINA)).toBe(60000)
  })

  test('una tarjeta de crédito se vuelve negativa sola y resta del patrimonio', () => {
    const estado = estadoBase()
    const TARJETA = 'c-visa'
    estado.cuentas.push(unaCuenta({ id: TARJETA, nombre: 'Visa', tipo: 'tarjeta', saldoInicial: 0 }))
    estado.movimientos.push(
      unMovimiento({ tipo: 'gasto', importe: 25000, cuentaId: TARJETA, categoriaId: OCIO }),
    )
    expect(saldoCuenta(estado, TARJETA)).toBe(-25000)
    expect(patrimonioNeto(estado)).toBe(420000 - 25000)
  })

  test('las cuentas archivadas no entran en el patrimonio', () => {
    const estado = estadoBase()
    estado.cuentas.push(unaCuenta({ id: 'c-vieja', saldoInicial: 999999, archivada: true }))
    expect(patrimonioNeto(estado)).toBe(420000)
  })
})

describe('cuentas de inversión: manda la valoración, no las aportaciones', () => {
  const INVERSION = 'c-indexa'

  function conInversion(): EstadoFinanzas {
    const estado = estadoBase()
    estado.cuentas.push(unaCuenta({ id: INVERSION, nombre: 'Indexa', tipo: 'inversion', saldoInicial: 0 }))
    estado.movimientos.push(
      unMovimiento({
        tipo: 'traspaso', importe: 100000, cuentaId: NOMINA,
        cuentaDestinoId: INVERSION, categoriaId: undefined, fecha: '2026-01-05',
      }),
    )
    return estado
  }

  test('sin valoración vale lo que has aportado', () => {
    expect(valorCuenta(conInversion(), INVERSION)).toBe(100000)
  })

  test('con valoración vale lo que dice la valoración', () => {
    const estado = conInversion()
    estado.valoraciones.push(unaValoracion({ cuentaId: INVERSION, fecha: '2026-01-31', valor: 112000 }))
    expect(valorCuenta(estado, INVERSION)).toBe(112000)
  })

  test('manda la valoración más reciente', () => {
    const estado = conInversion()
    estado.valoraciones.push(
      unaValoracion({ cuentaId: INVERSION, fecha: '2026-01-31', valor: 112000 }),
      unaValoracion({ cuentaId: INVERSION, fecha: '2026-03-31', valor: 98000 }),
      unaValoracion({ cuentaId: INVERSION, fecha: '2026-02-28', valor: 105000 }),
    )
    expect(valorCuenta(estado, INVERSION)).toBe(98000)
  })

  test('el rendimiento es lo que vale menos lo que metiste', () => {
    const estado = conInversion()
    estado.valoraciones.push(unaValoracion({ cuentaId: INVERSION, fecha: '2026-01-31', valor: 112000 }))
    const r = rendimientoInversion(estado, INVERSION)!
    expect(r.aportado).toBe(100000)
    expect(r.valor).toBe(112000)
    expect(r.ganancia).toBe(12000)
    expect(r.porcentaje).toBeCloseTo(12)
  })

  test('aportar a la inversión no cambia el patrimonio: es un traspaso', () => {
    const estado = estadoBase()
    estado.cuentas.push(unaCuenta({ id: INVERSION, tipo: 'inversion', saldoInicial: 0 }))
    const antes = patrimonioNeto(estado)
    estado.movimientos.push(
      unMovimiento({
        tipo: 'traspaso', importe: 100000, cuentaId: NOMINA,
        cuentaDestinoId: INVERSION, categoriaId: undefined,
      }),
    )
    expect(patrimonioNeto(estado)).toBe(antes)
  })
})

describe('presupuestos', () => {
  test('el del mes concreto gana al recurrente', () => {
    const recurrente = unPresupuesto({ categoriaId: OCIO, importeMensual: 20000, mes: null })
    const enero = unPresupuesto({ categoriaId: OCIO, importeMensual: 50000, mes: '2026-01' })
    const ps = [recurrente, enero]
    expect(presupuestoAplicable(ps, OCIO, '2026-01')?.importeMensual).toBe(50000)
    expect(presupuestoAplicable(ps, OCIO, '2026-02')?.importeMensual).toBe(20000)
  })

  test('el consumo suma las subcategorías', () => {
    const estado = estadoBase()
    const SUB = 'k-viajes'
    estado.categorias.push(unaCategoria({ id: SUB, nombre: 'Viajes', tipo: 'gasto', padreId: OCIO }))
    estado.movimientos.push(
      unMovimiento({ tipo: 'gasto', importe: 4500, cuentaId: NOMINA, categoriaId: OCIO }),
      unMovimiento({ tipo: 'gasto', importe: 15000, cuentaId: NOMINA, categoriaId: SUB }),
    )
    const presupuesto = unPresupuesto({ categoriaId: OCIO, importeMensual: 20000 })
    const consumo = consumoPresupuesto(estado, presupuesto, '2026-01')!
    expect(consumo.gastado).toBe(19500)
    expect(consumo.restante).toBe(500)
    expect(consumo.superado).toBe(false)
  })

  test('marca superado cuando te pasas', () => {
    const estado = estadoBase()
    estado.movimientos.push(unMovimiento({ tipo: 'gasto', importe: 25000, cuentaId: NOMINA, categoriaId: OCIO }))
    const presupuesto = unPresupuesto({ categoriaId: OCIO, importeMensual: 20000 })
    const consumo = consumoPresupuesto(estado, presupuesto, '2026-01')!
    expect(consumo.superado).toBe(true)
    expect(consumo.restante).toBe(-5000)
  })
})

describe('objetivos de ahorro', () => {
  test('el progreso sale de las aportaciones', () => {
    const estado = estadoBase()
    const objetivo = unObjetivo({ id: 'o1', objetivo: 300000, nombre: 'Viaje' })
    estado.objetivos.push(objetivo)
    estado.aportaciones.push(
      unaAportacion({ objetivoId: 'o1', importe: 20000 }),
      unaAportacion({ objetivoId: 'o1', importe: 10000 }),
    )
    const p = progresoObjetivo(estado, objetivo, '2026-01-31')
    expect(p.aportado).toBe(30000)
    expect(p.restante).toBe(270000)
    expect(p.porcentaje).toBeCloseTo(10)
    expect(p.completado).toBe(false)
  })

  test('dos objetivos sobre la misma cuenta no se pisan', () => {
    const estado = estadoBase()
    const viaje = unObjetivo({ id: 'o1', objetivo: 300000, cuentaId: AHORRO })
    const colchon = unObjetivo({ id: 'o2', objetivo: 600000, cuentaId: AHORRO })
    estado.objetivos.push(viaje, colchon)
    estado.aportaciones.push(
      unaAportacion({ objetivoId: 'o1', importe: 30000 }),
      unaAportacion({ objetivoId: 'o2', importe: 50000 }),
    )
    expect(progresoObjetivo(estado, viaje, '2026-01-31').aportado).toBe(30000)
    expect(progresoObjetivo(estado, colchon, '2026-01-31').aportado).toBe(50000)
  })

  test('calcula cuánto hay que apartar al mes para llegar a la fecha', () => {
    const estado = estadoBase()
    const objetivo = unObjetivo({ id: 'o1', objetivo: 300000, fechaLimite: '2026-07-15' })
    estado.objetivos.push(objetivo)
    estado.aportaciones.push(unaAportacion({ objetivoId: 'o1', importe: 60000 }))
    const p = progresoObjetivo(estado, objetivo, '2026-01-20')
    expect(p.mesesRestantes).toBe(6)
    expect(p.cuotaMensual).toBe(40000)
  })

  test('un objetivo ya cumplido no pide cuota mensual', () => {
    const estado = estadoBase()
    const objetivo = unObjetivo({ id: 'o1', objetivo: 100000, fechaLimite: '2026-07-15' })
    estado.objetivos.push(objetivo)
    estado.aportaciones.push(unaAportacion({ objetivoId: 'o1', importe: 100000 }))
    const p = progresoObjetivo(estado, objetivo, '2026-01-20')
    expect(p.completado).toBe(true)
    expect(p.restante).toBe(0)
    expect(p.cuotaMensual).toBeNull()
  })
})
