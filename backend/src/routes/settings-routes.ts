import { Router } from "express"
import { handle_get_settings, handle_update_settings } from "../controllers/settings-controller"

const router = Router()

router.get("/", handle_get_settings)
router.put("/", handle_update_settings)

export default router
