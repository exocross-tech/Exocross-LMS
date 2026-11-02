const express = require("express");
const router = express.Router();

const {
  createModule,
  getModules,
  updateModule,
  updateModuleStatus,
  getActiveModules,
  deleteModule,
} = require("../controllers/moduleController");

router.post("/create", createModule);

router.get("/list", getModules);

router.get("/active", getActiveModules);

router.put("/update/:id", (req, res, next) => {
  req.body.ID = req.params.id;
  updateModule(req, res, next);
});

router.post("/update-status", updateModuleStatus);

router.delete("/:id", deleteModule);

module.exports = router;