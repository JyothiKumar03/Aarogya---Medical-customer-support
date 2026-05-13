import type { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import prisma from "../db/client"
import { stream_agent_response } from "../services/agent-service"
import { build_providers } from "../services/ai-service"
import { create_logger } from "../services/logger-service"
import { MAX_USER_MESSAGES_PER_CHAT } from "../constants/thresholds"
import type { TMessage, TResponseMetadata } from "../types/agent-types"
import type { CoreMessage } from "ai"

const log = create_logger("chat-controller")

type TChatRequest = {
  session_id: string
  message: string
  conversation_history?: TMessage[]
}

export async function handle_chat(req: Request, res: Response): Promise<void> {
  try {
    const { session_id, message, conversation_history } = req.body as TChatRequest

    if (!session_id || !message) {
      res.status(400).json({ error: "session_id and message are required" })
      return
    }

    const prior_user_count = (conversation_history ?? []).filter(
      (m) => m.role === "user"
    ).length
    if (prior_user_count >= MAX_USER_MESSAGES_PER_CHAT) {
      res.status(429).json({
        error: "chat_limit_reached",
        message: `This chat has reached the ${MAX_USER_MESSAGES_PER_CHAT}-message limit. Start a new chat or raise a support ticket.`,
        limit: MAX_USER_MESSAGES_PER_CHAT,
      })
      return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    res.setHeader("X-Accel-Buffering", "no")

    const user_message_id = uuidv4()

    await prisma.message.create({
      data: {
        id: user_message_id,
        session_id,
        role: "user",
        content: message,
      },
    })

    const history: CoreMessage[] = (conversation_history ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

    history.push({ role: "user", content: message })

    const providers = build_providers()
    const { textStream, metadata: metadata_promise } = await stream_agent_response(
      providers[0],
      history,
      session_id
    )

    let full_content = ""

    try {
      for await (const chunk of textStream) {
        full_content += chunk
        res.write(`event: delta\ndata: ${JSON.stringify(chunk)}\n\n`)
      }
    } catch (stream_err) {
      const err_msg = stream_err instanceof Error ? stream_err.message : String(stream_err)
      log.error("Stream error", err_msg)
      full_content =
        "I'm sorry, I encountered an error processing your request. Please try again or create a support ticket."
      res.write(
        `event: delta\ndata: ${JSON.stringify(full_content)}\n\n`
      )
    }

    let metadata: TResponseMetadata
    try {
      metadata = await metadata_promise
    } catch {
      metadata = { source: "ai", confidence_score: 0 }
    }

    if (!metadata.search_result_id && metadata.source !== "ai") {
      const sr = await prisma.searchResult.findFirst({
        where: { session_id },
        orderBy: { created_at: "desc" },
      })
      if (sr) {
        metadata.search_result_id = sr.id
      }
    }

    const assistant_message_id = uuidv4()
    await prisma.message.create({
      data: {
        id: assistant_message_id,
        session_id,
        role: "assistant",
        content: full_content,
        source: metadata.source,
        confidence_score: metadata.confidence_score ?? null,
        kb_entry_id: metadata.kb_entry_id ?? null,
        search_result_id: metadata.search_result_id ?? null,
      },
    })

    if (metadata.search_result_id) {
      await prisma.searchResult.update({
        where: { id: metadata.search_result_id },
        data: { used: true },
      })
    }

    res.write(`event: metadata\ndata: ${JSON.stringify(metadata)}\n\n`)
    res.write(`event: done\ndata: {}\n\n`)
    res.end()
  } catch (err) {
    log.error("Fatal error", err)
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" })
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Internal server error" })}\n\n`)
      res.end()
    }
  }
}
