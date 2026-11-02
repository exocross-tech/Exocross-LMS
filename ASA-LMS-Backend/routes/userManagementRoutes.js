const express = require("express");
const router = express.Router();

const {
  getUsers,
  addUser,
  updateUser,
  deleteUser,
  updateUserStatus,
  getStudents,
  bulkAddStudents,
  upload,
  changePassword,
  getTutors,
  getUserProfile,
  updateUserProfile,
  getUserActivityLogs,
} = require("../controllers/userManagementController");

router.get("/", getUsers);
router.get("/activity-logs", getUserActivityLogs);
router.post("/", addUser);

router.put("/change-password", changePassword);

router.get("/getStudents", getStudents);
router.get("/getTutors", getTutors);

router.get("/profile/:id", getUserProfile);
router.put("/profile/:id", updateUserProfile);

// Direct ID routes (for /api/profile/:id)
router.get("/:id", getUserProfile);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.put("/:id/status", updateUserStatus);

router.post(
  "/bulkAddStudents",
  upload.single("file"),
  bulkAddStudents
);

module.exports = router;