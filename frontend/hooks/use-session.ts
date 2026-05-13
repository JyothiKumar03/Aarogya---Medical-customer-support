"use client"

import { useCallback, useEffect, useState } from "react"
import { generateSessionId } from "@/lib/utils"

const KEY = "insureco.session_id"

type TUseSession = {
  sessionId: string
  rotate: () => string
}

/**
 * One UUID per chat. Persists across reloads via localStorage so a refresh
 * mid-conversation doesn't lose continuity, but `rotate()` mints a fresh id
 * whenever the user starts a new chat so backend session-scoped rows
 * (messages, search_results, tickets) don't bleed across conversations.
 */
export function useSession(): TUseSession {
  const [sessionId, setSessionId] = useState<string>("")

  useEffect(() => {
    if (typeof window === "undefined") return
    let id = window.localStorage.getItem(KEY)
    if (!id) {
      id = generateSessionId()
      window.localStorage.setItem(KEY, id)
    }
    setSessionId(id)
  }, [])

  const rotate = useCallback((): string => {
    const id = generateSessionId()
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, id)
    }
    setSessionId(id)
    return id
  }, [])

  return { sessionId, rotate }
}
