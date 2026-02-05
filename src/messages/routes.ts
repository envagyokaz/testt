import { Router } from "express"
import { saveMessage, getMessages } from "./messagesController"
import verifyToken from "../middleware/auth"

const router: Router = Router()

// Save a chat message (user must be authenticated)
router.post('/message/save', verifyToken, saveMessage)

// Get messages (supports ?withUser=ID or ?groupId=ID, optional ?limit and ?beforeId for pagination)
router.get('/messages', verifyToken, getMessages)

export default router
