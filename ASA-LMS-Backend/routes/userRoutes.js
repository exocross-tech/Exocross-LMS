const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const authMiddleware = require('../middleware/authMiddleware');
const { insertSuperAdmin, create, view, list, update, remove, orgAndRoleBasedList } = require("../controllers/userController");

const router = express.Router();

const openRoutes = [
  { method: "post", path: "/insert-super-admin", handler: insertSuperAdmin },
];

const protectedRoutes = [
  { method: "post", path: "/create", handler: create },
  { method: "get", path: "/view/:id", handler: view },
  { method: "post", path: "/list", handler: list },
  { method: "put", path: "/update/:id", handler: update },
  { method: "delete", path: "/remove/:id", handler: remove },
  { method: "post", path: "/list-with-org-role", handler: orgAndRoleBasedList },
];

openRoutes.forEach((route) => {
  router[route.method](route.path, asyncHandler(route.handler));
});

protectedRoutes.forEach((route) => {
  router[route.method](route.path, authMiddleware, asyncHandler(route.handler));
});

module.exports = router;
