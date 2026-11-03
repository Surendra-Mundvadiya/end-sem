import { useCallback, useState } from 'react'

/* Small persisted preferences for the tutor (localStorage, keys prefixed "taxlaw-tutor-"). */

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

export function useBoolPref(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => {
    const raw = read(key)
    return raw === null ? fallback : raw === '1'
  })
  const set = useCallback(
    (v: boolean) => {
      setValue(v)
      write(key, v ? '1' : '0')
    },
    [key],
  )
  return [value, set]
}

export function useStringPref(key: string, fallback: string): [string, (v: string) => void] {
  const [value, setValue] = useState(() => read(key) ?? fallback)
  const set = useCallback(
    (v: string) => {
      setValue(v)
      write(key, v)
    },
    [key],
  )
  return [value, set]
}

export const PREF_AUTO_CONTINUE = 'taxlaw-tutor-autocontinue'
export const PREF_QUICK_CHECK = 'taxlaw-tutor-quickcheck'
export const PREF_TRANSCRIPT = 'taxlaw-tutor-transcript'
export const PREF_UNIT = 'taxlaw-tutor-unit'
