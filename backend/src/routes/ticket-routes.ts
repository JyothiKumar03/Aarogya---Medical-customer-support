import { Router } from "express"
import {
  handle_create_ticket,
  handle_list_tickets,
  handle_get_ticket,
  handle_resolve_ticket,
} from "../controllers/ticket-controller"

const router = Router()

router.post("/", handle_create_ticket)
router.get("/", handle_list_tickets)
router.get("/:id", handle_get_ticket)
router.patch("/:id", handle_resolve_ticket)

export default router
