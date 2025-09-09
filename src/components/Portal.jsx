import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export default function Portal({ children, containerId = 'portal-root' }) {
  const elRef = useRef(null)
  if (!elRef.current) {
    elRef.current = document.createElement('div')
  }
  useEffect(() => {
    let container = document.getElementById(containerId)
    if (!container) {
      container = document.createElement('div')
      container.id = containerId
      document.body.appendChild(container)
    }
    container.appendChild(elRef.current)
    return () => {
      try { container.removeChild(elRef.current) } catch (_) {}
    }
  }, [containerId])
  return createPortal(children, elRef.current)
}


