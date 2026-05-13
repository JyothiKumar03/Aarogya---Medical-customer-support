import express from "express"
import cors from "cors"
import { ENV } from "./utils/env"
import { create_logger } from "./services/logger-service"
import chat_routes from "./routes/chat-routes"
import ticket_routes from "./routes/ticket-routes"
import kb_routes from "./routes/kb-routes"

const log = create_logger("server")
const app = express()

app.use(cors({ origin: "*" }))
app.use(express.json())

app.get("/", (_req, res) => res.json({ ok: true, service: "Heyya!" }))

app.get("/api", (_req, res) => res.json({ ok: true, service: "InsureCo Support API" }))

app.use("/api/chat", chat_routes)
app.use("/api/tickets", ticket_routes)
app.use("/api/kb", kb_routes)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error("Unhandled error", err)
  res.status(500).json({ error: "Internal server error" })
})

const PORT = Number(ENV.PORT)
app.listen(PORT, () => {
  log.info(`InsureCo Support API listening on http://localhost:${PORT}`)
})
