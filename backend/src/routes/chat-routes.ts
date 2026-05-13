import { Router } from "express"
import { handle_chat } from "../controllers/chat-controller"

const router = Router()

router.post("/", handle_chat)

export default router
