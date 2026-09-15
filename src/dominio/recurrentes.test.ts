import { describe, expect, test } from 'vitest'
import { generarPendientes, ocurrenciasEntre, proximasOcurrencias } from './recurrentes'
import { unaCuenta, unEstado } from './fixtures'
import type { EstadoFinanzas, Recurrente } from './tipos'

function unRecurrente(p: Partial<Recurrente> = {}): Recurrente {
  return {
    id: 'r1',
    nombre: 'Nómina',
    tipo: 'ingreso',
    importe: 190000,
    cuentaId: 'c1',
    categoriaId: 'k-salario',
    frecuencia: 'mensual',
    diaDelMes: 25,
    fechaInicio: '2026-01-01',
    activo: true,
    ...p,
  }
}

function conRecurrente(p: Partial<Recurrente> = {}): EstadoFinanzas {
  return unEstado({
    cuentas: [unaCuenta({ id: 'c1' })],
    recurrentes: [unRecurrente(p)],
  })
}

describe('INV-5: generar dos veces no duplica', () => {
  test('la segunda llamada seguida no crea nada', () => {
    // Esto se ejecuta en cada arranque de la app. Si no fuera idempotente,
    // abrir la aplicación dos veces cobraría la nómina dos veces.
    const estado = conRecurrente()
    const primera = generarPendientes(estado, '2026-03-31')
    expect(primera.movimientos).toHaveLength(3) // enero, febrero, marzo

    // Aplicar el avance, como haría la capa de datos.
    estado.movimientos.push(...primera.movimientos)
    for (const a of primera.avances) {
      const r = estado.recurrentes.find((x) => x.id === a.id)!
      r.ultimaGeneracion = a.ultimaGeneracion
    }

    const segunda = generarPendientes(estado, '2026-03-31')
    expect(segunda.movimientos).toHaveLength(0)
    expect(segunda.avances).toHaveLength(0)
  })

  test('diez arranques seguidos el mismo día dejan tres movimientos, no treinta', () => {
    const estado = conRecurrente()
    for (let i = 0; i < 10; i++) {
      const g = generarPendientes(estado, '2026-03-31')
      estado.movimientos.push(...g.movimientos)
      for (const a of g.avances) {
        estado.recurrentes.find((x) => x.id === a.id)!.ultimaGeneracion = a.ultimaGeneracion
      }
    }
    expect(estado.movimientos).toHaveLength(3)
  })

  test('al pasar un mes más genera exactamente uno nuevo', () => {
    const estado = conRecurrente()
    const g1 = generarPendientes(estado, '2026-03-31')
    estado.movimientos.push(...g1.movimientos)
    estado.recurrentes[0].ultimaGeneracion = g1.avances[0].ultimaGeneracion

    const g2 = generarPendientes(estado, '2026-04-30')
    expect(g2.movimientos).toHaveLength(1)
    expect(g2.movimientos[0].fecha).toBe('2026-04-25')
  })
})

describe('INV-6: el día 31 no se salta febrero', () => {
  test('un recibo a día 31 cae el 28 en febrero de un año normal', () => {
    const fechas = ocurrenciasEntre(unRecurrente({ diaDelMes: 31 }), '2026-02-01', '2026-02-28')
    expect(fechas).toEqual(['2026-02-28'])
  })

  test('y el 29 en un año bisiesto', () => {
    const fechas = ocurrenciasEntre(
      unRecurrente({ diaDelMes: 31, fechaInicio: '2028-01-01' }),
      '2028-02-01',
      '2028-02-29',
    )
    expect(fechas).toEqual(['2028-02-29'])
  })

  test('catorce meses seguidos a día 31 generan catorce movimientos, ninguno perdido', () => {
    const estado = conRecurrente({ diaDelMes: 31, fechaInicio: '2026-01-01', tipo: 'gasto' })
    const g = generarPendientes(estado, '2027-02-28')
    expect(g.movimientos).toHaveLength(14)

    const meses = g.movimientos.map((m) => m.fecha.slice(0, 7))
    expect(new Set(meses).size).toBe(14) // uno por mes, sin repetir ni saltar
    expect(g.movimientos[1].fecha).toBe('2026-02-28')
    expect(g.movimientos[3].fecha).toBe('2026-04-30')
  })

  test('el día 30 también se recorta en febrero', () => {
    const fechas = ocurrenciasEntre(unRecurrente({ diaDelMes: 30 }), '2026-02-01', '2026-02-28')
    expect(fechas).toEqual(['2026-02-28'])
  })
})

describe('no se genera hacia el futuro', () => {
  test('la nómina del 25 no existe todavía el día 20', () => {
    // Apuntarla ya inflaría el saldo con dinero sin cobrar.
    const estado = conRecurrente({ fechaInicio: '2026-01-01', diaDelMes: 25 })
    const g = generarPendientes(estado, '2026-01-20')
    expect(g.movimientos).toHaveLength(0)
  })

  test('el mismo día 25 sí se genera', () => {
    const estado = conRecurrente({ fechaInicio: '2026-01-01', diaDelMes: 25 })
    const g = generarPendientes(estado, '2026-01-25')
    expect(g.movimientos).toHaveLength(1)
  })

  test('nunca antes de la fecha de inicio', () => {
    const estado = conRecurrente({ fechaInicio: '2026-06-01', diaDelMes: 25 })
    const g = generarPendientes(estado, '2026-07-31')
    expect(g.movimientos.map((m) => m.fecha)).toEqual(['2026-06-25', '2026-07-25'])
  })

  test('un recurrente terminado no genera nada más', () => {
    const estado = conRecurrente({ fechaInicio: '2026-01-01', fechaFin: '2026-02-28' })
    const g = generarPendientes(estado, '2026-12-31')
    expect(g.movimientos.map((m) => m.fecha)).toEqual(['2026-01-25', '2026-02-25'])
  })

  test('un recurrente pausado no genera nada', () => {
    const estado = conRecurrente({ activo: false })
    expect(generarPendientes(estado, '2026-12-31').movimientos).toHaveLength(0)
  })
})

describe('el resto de frecuencias', () => {
  test('semanal cae siempre en el mismo día de la semana', () => {
    // 2026-01-01 es jueves; pedimos lunes (1).
    const fechas = ocurrenciasEntre(
      unRecurrente({ frecuencia: 'semanal', diaDeLaSemana: 1, diaDelMes: undefined }),
      '2026-01-01',
      '2026-01-31',
    )
    expect(fechas).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'])
    for (const f of fechas) {
      const [a, m, d] = f.split('-').map(Number)
      expect(new Date(a, m - 1, d).getDay()).toBe(1)
    }
  })

  test('trimestral salta de tres en tres desde el mes de inicio', () => {
    const fechas = ocurrenciasEntre(
      unRecurrente({ frecuencia: 'trimestral', diaDelMes: 15, fechaInicio: '2026-02-01' }),
      '2026-01-01',
      '2026-12-31',
    )
    expect(fechas).toEqual(['2026-02-15', '2026-05-15', '2026-08-15', '2026-11-15'])
  })

  test('anual cae una vez al año en su mes', () => {
    const fechas = ocurrenciasEntre(
      unRecurrente({ frecuencia: 'anual', mesDelAnio: 6, diaDelMes: 30, fechaInicio: '2026-01-01' }),
      '2026-01-01',
      '2028-12-31',
    )
    expect(fechas).toEqual(['2026-06-30', '2027-06-30', '2028-06-30'])
  })
})

describe('previsiones', () => {
  test('las próximas ocurrencias son posteriores a hoy y no tocan saldos', () => {
    const estado = conRecurrente({ fechaInicio: '2026-01-01', diaDelMes: 25 })
    // Ventana del 21 de enero al 19 de febrero: solo cabe la nómina de enero,
    // la de febrero cae el 25 y queda fuera.
    const proximas = proximasOcurrencias(estado, '2026-01-20', 30)
    expect(proximas.map((p) => p.fecha)).toEqual(['2026-01-25'])
    expect(estado.movimientos).toHaveLength(0)
  })

  test('vienen ordenadas por fecha', () => {
    const estado = unEstado({
      cuentas: [unaCuenta({ id: 'c1' })],
      recurrentes: [
        unRecurrente({ id: 'r1', nombre: 'Nómina', diaDelMes: 25 }),
        unRecurrente({ id: 'r2', nombre: 'Alquiler', tipo: 'gasto', diaDelMes: 5, categoriaId: 'k-casa' }),
      ],
    })
    const proximas = proximasOcurrencias(estado, '2026-01-01', 40)
    const fechas = proximas.map((p) => p.fecha)
    expect(fechas).toEqual([...fechas].sort())
  })
})
