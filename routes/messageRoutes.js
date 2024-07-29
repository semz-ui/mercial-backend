import express from "express";
import protectRoute from "../middlewares/protectRoutes.js";
import {
  createGroup,
  getConversations,
  getMessages,
  getUnreadMessages,
  sendMessage,
} from "../controllers/messageController.js";

const router = express.Router();

router.get("/conversations", protectRoute, getConversations);
router.get("/:conversationId", protectRoute, getMessages);
router.get("/unread/:conversationId", protectRoute, getUnreadMessages);
router.post("/", protectRoute, sendMessage);
router.post("/create-group", protectRoute, createGroup);

export default router;
