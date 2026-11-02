const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "course-materials"
);

// Create upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

// =====================================================
// STORAGE
// =====================================================

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

// =====================================================
// ONLY PDF ALLOWED
// =====================================================

const fileFilter = (req, file, cb) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const mimeType = file.mimetype;

  if (
    extension === ".pdf" &&
    mimeType === "application/pdf"
  ) {
    return cb(null, true);
  }

  return cb(
    new Error("Only PDF files are allowed"),
    false
  );
};

// =====================================================
// MULTER
// =====================================================

const upload = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per PDF
    files: 10,
  },
});

module.exports = upload;