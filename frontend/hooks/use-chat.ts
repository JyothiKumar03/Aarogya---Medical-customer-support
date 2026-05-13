"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { ticketApi, streamChat } from "@/lib/api"
import { generateSessionId } from "@/lib/utils"
import { MAX_USER_MESSAGES_PER_CHAT } from "@/lib/limits"
import type { TMessage, TResponseMetadata } from "@/types"

type TUseChat = {
  messages: TMessage[]
  isStreaming: boolean
  userMessageCount: number
  atLimit: boolean
  send: (text: string) => Promise<void>
  stop: () => void
  reset: () => void
  createTicket: () => Promise<{ ticket_id: string } | null>
  isCreatingTicket: boolean
}

export function useChat(sessionId: string): TUseChat {
  const [messages, setMessages] = useState<TMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const updateAssistant = useCallback(
    (id: string, patch: Partial<TMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
      )
    },
    []
  )

  const userMessageCount = useMemo(
    () => messages.filter((m) => m.role === "user").length,
    [messages]
  )
  const atLimit = userMessageCount >= MAX_USER_MESSAGES_PER_CHAT

  const send = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim() || isStreaming) return
      if (atLimit) return

      const userMessage: TMessage = {
        id: generateSessionId(),
        role: "user",
        content: text.trim(),
        created_at: new Date().toISOString(),
      }

      const assistantId = generateSessionId()
      const assistantStub: TMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
        created_at: new Date().toISOString(),
      }

      // Backend appends the new user message itself, so only send prior turns
      // (and exclude any in-flight / errored stubs from earlier sends).
      const conversation_history = messages.filter(
        (m) => !m.pending && !m.errored
      )

      setMessages((prev) => [...prev, userMessage, assistantStub])
      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      let accumulated = ""
      let metadata: TResponseMetadata | undefined

      await streamChat(
        { session_id: sessionId, message: text.trim(), conversation_history },
        {
          signal: controller.signal,
          onDelta: (chunk) => {
            accumulated += chunk
            updateAssistant(assistantId, {
              content: accumulated,
              pending: true,
            })
          },
          onMetadata: ({ metadata: meta }) => {
            metadata = meta
            updateAssistant(assistantId, {
              metadata: meta,
              source: meta.source,
              confidence_score: meta.confidence_score,
            })
          },
          onDone: () => {
            updateAssistant(assistantId, {
              pending: false,
              content:
                accumulated || "I couldn't generate a response. Please try again.",
              metadata,
              source: metadata?.source,
              confidence_score: metadata?.confidence_score,
            })
            setIsStreaming(false)
            abortRef.current = null
          },
          onError: (err) => {
            console.error("[useChat] stream error", err)
            updateAssistant(assistantId, {
              pending: false,
              errored: true,
              content:
                accumulated ||
                "Sorry something went wrong while answering. Please try again, or raise a support ticket.",
            })
            setIsStreaming(false)
            abortRef.current = null
          },
        }
      )
    },
    [sessionId, isStreaming, atLimit, messages, updateAssistant]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setIsStreaming(false)
  }, [])

  const ticketMutation = useMutation({
    mutationFn: () =>
      ticketApi.create(
        sessionId,
        messages.filter((m) => !m.pending && !m.errored)
      ),
  })

  const createTicket = useCallback(async () => {
    if (!sessionId) return null
    const result = await ticketMutation.mutateAsync()
    return { ticket_id: result.ticket_id }
  }, [sessionId, ticketMutation])

  return useMemo(
    () => ({
      messages,
      isStreaming,
      userMessageCount,
      atLimit,
      send,
      stop,
      reset,
      createTicket,
      isCreatingTicket: ticketMutation.isPending,
    }),
    [
      messages,
      isStreaming,
      userMessageCount,
      atLimit,
      send,
      stop,
      reset,
      createTicket,
      ticketMutation.isPending,
    ]
  )
}
