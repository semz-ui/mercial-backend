import express from "express";
import {
  createPost,
  deletePost,
  getFeedPosts,
  getPost,
  getUserReplies,
  getUserPosts,
  likeUnlikePost,
  replyToPost,
  getUserLikes,
} from "../controllers/postController.js";
import protectRoute from "../middlewares/protectRoutes.js";

const router = express.Router();

router.get("/feed", protectRoute, getFeedPosts);
router.get("/replies", protectRoute, getUserReplies);
router.get("/likes", protectRoute, getUserLikes);
router.get("/user/:username", protectRoute, getUserPosts);
router.get("/:id", getPost);
router.post("/create", protectRoute, createPost);
router.delete("/delete/:id", protectRoute, deletePost);
router.put("/like/:id", protectRoute, likeUnlikePost);
router.put("/reply/:id", protectRoute, replyToPost);

export default router;
