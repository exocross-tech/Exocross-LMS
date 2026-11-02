const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(
  __dirname,
  "..",
  "uploads",
  "student-project-kits"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const studentId = req.body.STUDENT_ID || req.body.studentId || "general";
    const studentDir = path.join(uploadDir, String(studentId));
    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir, { recursive: true });
    }
    cb(null, studentDir);
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

const uploadStudentProjectKit = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

module.exports = uploadStudentProjectKit;
