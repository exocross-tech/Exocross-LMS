const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "project-kits"
);

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const unique =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9);

    cb(
      null,
      unique + path.extname(file.originalname).toLowerCase()
    );
  },
});

// Allowed Image Formats: JPG, JPEG, PNG, WEBP
const fileFilter = (req, file, cb) => {
  const allowedExts = [".jpg", ".jpeg", ".png", ".webp"];
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedExts.includes(extension) && allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }

  return cb(
    new Error("Only image files (JPG, JPEG, PNG, WEBP) are allowed"),
    false
  );
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});

module.exports = upload;
