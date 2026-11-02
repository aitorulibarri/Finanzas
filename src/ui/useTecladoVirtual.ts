import { useEffect, useState } from 'react'

/**
 * Zona realmente visible de la pantalla cuando hay teclado virtual.
 *
 * En Android (Chrome desde la 108 y los navegadores basados en él, como el
 * de los Xiaomi) el teclado se pinta ENCIMA de la página sin reducir el
 * viewport de diseño. Un elemento `fixed` pegado abajo queda entonces detrás
 * del teclado y no se ve lo que se escribe. `visualViewport` sí refleja el
 * hueco que deja el teclado, así que de ahí sale la altura y el desplazamiento.
 *
 * Devuelve null si el navegador no lo soporta: se queda el comportamiento normal.
 */
export function useZonaVisible(activo: boolean): { top: number; height: number } | null {
  const [zona, setZona] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!activo || !vv) return

    const medir = () => setZona({ top: vv.offsetTop, height: vv.height })
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
      setZona(null)
    }
  }, [activo])

  return zona
}

/**
 * Al enfocar un campo, lo centra en pantalla cuando termina de salir el
 * teclado. Sin esto, en algunos móviles el campo queda justo debajo.
 */
export function useCentrarCampoEnfocado(): void {
  useEffect(() => {
    let temporizador: number | undefined
    const alEnfocar = (e: FocusEvent) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !el.matches('input, select, textarea')) return
      window.clearTimeout(temporizador)
      // El teclado tarda en animarse; medir antes da una posición vieja.
      temporizador = window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
    }
    document.addEventListener('focusin', alEnfocar)
    return () => {
      document.removeEventListener('focusin', alEnfocar)
      window.clearTimeout(temporizador)
    }
  }, [])
}
