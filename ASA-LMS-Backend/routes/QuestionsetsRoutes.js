const express = require("express");

const router = express.Router();

const templateController = require("../controllers/QuestionsetsController");

router.post("/createTemplate", templateController.createTemplate);

router.post("/getTemplates", templateController.getTemplates);
router.get("/getTemplates", templateController.getTemplates);
router.get("/list", templateController.getTemplates);

router.get("/getTemplate/:id", templateController.getTemplateById);

router.put("/updateTemplate/:id", templateController.updateTemplate);

router.post("/updateTemplateStatus", templateController.updateTemplateStatus);

router.delete("/deleteTemplate/:id", templateController.deleteTemplate);

module.exports = router;
