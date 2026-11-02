const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const BASE = "http://localhost:3310";

const endpoints = [
  { method: "GET", path: "/api/dashboard/getDashboardData" },
  { method: "GET", path: "/api/batches" },
  { method: "GET", path: "/api/tutors" },
  { method: "GET", path: "/api/students" },
  { method: "GET", path: "/api/users" },
  { method: "GET", path: "/api/notifications" },
  { method: "GET", path: "/api/tutor-allocation/getTutorAllocation" },
  { method: "GET", path: "/api/student-allocation" },
  { method: "GET", path: "/api/class-schedules/upcoming?userType=ADMIN&userId=1" },
  { method: "GET", path: "/api/class-schedules/upcoming?userType=TUTOR&userId=3" },
  { method: "GET", path: "/api/class-schedules/upcoming?userType=STUDENT&userId=5" },
  { method: "GET", path: "/api/course-material" },
  { method: "GET", path: "/api/chat-rooms/getChatRoomBatches" },
  { method: "GET", path: "/api/batch-announcements/batches?userId=1" },
  { method: "GET", path: "/api/attendance/initial-data" },
];

async function runTests() {
  console.log("🚀 Running Comprehensive Endpoints Verification...\n");
  let passCount = 0;
  let failCount = 0;

  for (const ep of endpoints) {
    try {
      const url = BASE + ep.path;
      const res = await fetch(url, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);

      if (res.status >= 200 && res.status < 400 && data && data.status !== 0) {
        console.log(`✅ [PASS] ${ep.method} ${ep.path} (HTTP ${res.status})`);
        passCount++;
      } else {
        console.log(
          `❌ [FAIL] ${ep.method} ${ep.path} (HTTP ${res.status}):`,
          data ? data.message || JSON.stringify(data) : "No JSON response"
        );
        failCount++;
      }
    } catch (err) {
      console.log(`❌ [ERROR] ${ep.method} ${ep.path}:`, err.message);
      failCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Verification Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log(`========================================\n`);
}

runTests();
