import { useEffect, type RefObject } from 'react'

/**
 * Hook to detect clicks outside of a referenced element.
 * Replaces the repetitive pattern:
 *   useEffect(() => {
 *     const handleClickOutside = (event: MouseEvent) => {
 *       if (ref.current && !ref.current.contains(event.target as Node)) {
 *         callback()
 *       }
 *     }
 *     document.addEventListener('mousedown', handleClickOutside)
 *     return () => document.removeEventListener('mousedown', handleClickOutside)
 *   }, [])
 *
 * @param ref - React ref to the element to monitor
 * @param callback - Function to call when a click outside is detected
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, callback: () => void): void {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [ref, callback])
}
