"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ticketApi } from "@/lib/api"
import type { TTicket } from "@/types"

const KEYS = {
  list: (page: number, limit: number) => ["tickets", { page, limit }] as const,
  detail: (id: string) => ["tickets", id] as const,
}

export function useTickets(page = 1, limit = 50) {
  return useQuery({
    queryKey: KEYS.list(page, limit),
    queryFn: () => ticketApi.list(page, limit),
    refetchInterval: 30_000,
  })
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ""),
    queryFn: () => ticketApi.get(id as string),
    enabled: !!id,
  })
}

export function useResolveTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      id: string
      resolution_notes: string
      add_to_kb: boolean
    }) =>
      ticketApi.resolve(args.id, {
        resolution_notes: args.resolution_notes,
        add_to_kb: args.add_to_kb,
      }),
    onSuccess: (ticket: TTicket) => {
      qc.invalidateQueries({ queryKey: ["tickets"] })
      qc.setQueryData(KEYS.detail(ticket.id), ticket)
      if (ticket.kb_entry_id) {
        qc.invalidateQueries({ queryKey: ["kb"] })
      }
    },
  })
}
