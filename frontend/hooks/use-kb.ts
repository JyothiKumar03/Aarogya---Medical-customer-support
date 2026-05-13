"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { kbApi } from "@/lib/api"
import type { TKBEntry } from "@/types"

const KEYS = {
  list: ["kb"] as const,
}

export function useKB() {
  return useQuery({
    queryKey: KEYS.list,
    queryFn: () => kbApi.list(),
  })
}

export function useCreateKB() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      title: string
      content: string
      tags: string[]
    }) => kbApi.create(payload),
    onSuccess: (entry: TKBEntry) => {
      qc.setQueryData<TKBEntry[]>(KEYS.list, (prev) =>
        prev ? [entry, ...prev] : [entry]
      )
    },
  })
}

export function useDeleteKB() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => kbApi.remove(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<TKBEntry[]>(KEYS.list, (prev) =>
        prev ? prev.filter((e) => e.id !== id) : prev
      )
    },
  })
}
