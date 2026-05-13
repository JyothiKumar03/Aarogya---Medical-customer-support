import { Router } from "express"
import {
  handle_list_kb,
  handle_create_kb,
  handle_delete_kb,
} from "../controllers/kb-controller"

const router = Router()

router.get("/", handle_list_kb)
router.post("/", handle_create_kb)
router.delete("/:id", handle_delete_kb)

export default router
