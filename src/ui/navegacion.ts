import { useEffect, useState } from 'react'

/**
 * Enrutado por hash.
 *
 * GitHub Pages sirve ficheros estáticos y no sabe reescribir /movimientos al
 * index.html, así que una ruta con barra daría 404 al recargar o al abrir un
 * enlace directo. Con hash funciona sin configurar nada en el servidor, y de
 * paso ahorra una dependencia de router para seis pantallas.
 */

export const PAGINAS = {
  resumen: { titulo: 'Resumen', icono: '📊' },
  movimientos: { titulo: 'Movimientos', icono: '📝' },
  cuentas: { titulo: 'Cuentas', icono: '🏦' },
  presupuestos: { titulo: 'Presupuestos', icono: '🎯' },
  objetivos: { titulo: 'Objetivos', icono: '🐖' },
  ajustes: { titulo: 'Ajustes', icono: '⚙️' },
} as const

export type Pagina = keyof typeof PAGINAS

function leerHash(): Pagina {
  const valor = window.location.hash.replace(/^#\/?/, '')
  return valor in PAGINAS ? (valor as Pagina) : 'resumen'
}

export function useNavegacion(): [Pagina, (p: Pagina) => void] {
  const [pagina, setPagina] = useState<Pagina>(leerHash)

  useEffect(() => {
    const alCambiar = () => setPagina(leerHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  const ir = (p: Pagina) => {
    window.location.hash = `/${p}`
    setPagina(p)
  }

  return [pagina, ir]
}
