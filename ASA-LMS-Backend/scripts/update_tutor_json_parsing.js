const fs = require("fs");
const path = require("path");

// 1. Update loginController.js
const loginPath = path.join(__dirname, "../controllers/loginController.js");
let loginCode = fs.readFileSync(loginPath, "utf8");

loginCode = loginCode.replace(
  `        try {
          tutorAssignments = JSON.parse(allocation.TUTOR_IDS || "[]");
          if (!Array.isArray(tutorAssignments)) {
            tutorAssignments = [];
          }
        } catch (error) {
          console.error("Invalid TUTOR_IDS JSON:", allocation.TUTOR_IDS);
          continue;
        }

        const tutorAssignment = tutorAssignments.find(
          (item) => Number(item.tutorId) === Number(user.USER_ID)
        );`,
  `        try {
          if (Array.isArray(allocation.TUTOR_IDS)) {
            tutorAssignments = allocation.TUTOR_IDS;
          } else {
            tutorAssignments = JSON.parse(allocation.TUTOR_IDS || "[]");
          }
          if (!Array.isArray(tutorAssignments)) {
            tutorAssignments = [];
          }
        } catch (error) {
          tutorAssignments = [];
        }

        const tutorAssignment = tutorAssignments.find(
          (item) => Number(item.tutorId || item.TUTOR_ID) === Number(user.USER_ID)
        );`
);

fs.writeFileSync(loginPath, loginCode, "utf8");
console.log("Updated loginController.js");

// 2. Update tutorAllocationController.js
const tutorPath = path.join(__dirname, "../controllers/tutorAllocationController.js");
let tutorCode = fs.readFileSync(tutorPath, "utf8");

tutorCode = tutorCode.replace(
  `      try {
        tutorAssignments = JSON.parse(row.TUTOR_IDS);

        if (!Array.isArray(tutorAssignments)) {
          tutorAssignments = [];
        }
      } catch (error) {
        console.error("Invalid TUTOR_IDS JSON:", row.TUTOR_IDS);

        return;
      }

      // =================================================
      // FIND CURRENT TUTOR
      // =================================================

      const assignment = tutorAssignments.find(
        (item) => Number(item.tutorId) === Number(row.USER_ID),
      );`,
  `      try {
        if (Array.isArray(row.TUTOR_IDS)) {
          tutorAssignments = row.TUTOR_IDS;
        } else {
          tutorAssignments = JSON.parse(row.TUTOR_IDS || "[]");
        }

        if (!Array.isArray(tutorAssignments)) {
          tutorAssignments = [];
        }
      } catch (error) {
        tutorAssignments = [];
      }

      // =================================================
      // FIND CURRENT TUTOR
      // =================================================

      const assignment = tutorAssignments.find(
        (item) => Number(item.tutorId || item.TUTOR_ID) === Number(row.USER_ID),
      );`
);

fs.writeFileSync(tutorPath, tutorCode, "utf8");
console.log("Updated tutorAllocationController.js");
