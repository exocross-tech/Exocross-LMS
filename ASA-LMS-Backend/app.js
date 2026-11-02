require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { connectDB, closeDB, sql } = require("./config/database");
const allRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const {
  startClassScheduleCleanup,
  stopClassScheduleCleanup,
} = require("./utils/classScheduleCleanup");
const http = require("http");
const { initSocket } = require("./services/socketService");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3310;

// Initialize Socket.io Live Chat Engine
initSocket(server);

connectDB();

app.use(cors());
app.use(
  express.json({
    limit: "2gb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2gb",
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  "/ckeditor-upload-images",
  express.static(path.join(__dirname, "ckeditor-upload-images"))
);
app.use(
  "/api/ckeditor-upload-images",
  express.static(path.join(__dirname, "ckeditor-upload-images"))
);

app.use("/api", allRoutes);
app.use(allRoutes);
app.get("/", (req, res) => {
  res.send("Exocross LMS APIs!");
});

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  try {
    // 1. Connect to MSSQL first (waits/retries indefinitely if DB is not ready)
    await connectDB();

    // 2. Start class schedule cleanup job AFTER DB is ready
    startClassScheduleCleanup();

    // 3. Start express server exactly once on 0.0.0.0
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Server running at http://localhost:${port}`);
      console.log(`🔌 WebSocket Live Chat service ready on port ${port}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`\n❌ Port ${port} is already in use.`);
        console.error(`Another backend/application is currently using this port.`);
        console.error(`Stop the existing process or use a different configured port.\n`);
      } else {
        console.error(`❌ Server error: ${error.message}`);
      }
      process.exit(1);
    });

    // Graceful shutdown on process signals
    const cleanup = async () => {
      try {
        stopClassScheduleCleanup();
        server.close();
        await closeDB();
      } catch (_) { }
    };

    process.once("SIGUSR2", async () => {
      await cleanup();
      process.kill(process.pid, "SIGUSR2");
    });

    process.on("SIGINT", async () => {
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await cleanup();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
