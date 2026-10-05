import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { register, login, me, updateProfile } from "../controllers/authController.js";

const router = express.Router();

router.post("/", register);
router.post("/login", login);
router.get("/me", protect, me);
router.put("/profile", protect, updateProfile);

export default router;  
