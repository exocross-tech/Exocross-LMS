import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
  },
});

export const dashboardApi = {
  getDashboardData: (data) =>
    apiClient.get("api/dashboard/getDashboardData", data),
};

export const loginApi = {
  login: (data) => apiClient.post("api/login/login", data),
  addLog: (data) => apiClient.post("api/login/log-activity", data),
};

export const batchesApi = {
  getBatches: (params) => apiClient.get("api/batches", { params }),
  getBatchDetails: (id, params) => apiClient.get(`api/batches/${id}`, { params }),
  addBatch: (data) => apiClient.post("api/batches", data),
  updateBatch: (data) => apiClient.put(`api/batches/${data.ID}`, data),
  deleteBatch: (id) => apiClient.delete(`api/batches/${id}`),
  updateBatchStatus: (data) =>
    apiClient.put(`api/batches/${data.ID}/status`, {
      isActive: data.IS_ACTIVE,
      force: data.force || false,
    }),
};

export const tutorsApi = {
  getTutors: () => apiClient.get("api/tutors"),
  addTutor: (data) => apiClient.post("api/tutors", data),
  updateTutor: (id, data) => apiClient.put(`api/tutors/${id}`, data),
  updateTutorStatus: (id, data) =>
    apiClient.put(`api/tutors/${id}/status`, data),
};

export const studentsApi = {
  getStudents: (params) => apiClient.get("api/students", { params }),
  getSchools: () => apiClient.get("api/students/schools"),
  getStudentById: (data) => apiClient.post("api/students/getStudentById", data),
  updateStudent: (data) => apiClient.post("api/students/updateStudent", data),
  deleteStudent: (data) => apiClient.post("api/students/deleteStudent", data),
  addStudent: (data) => apiClient.post("api/students/addStudent", data),
  getBatchesByStudentId: (data) =>
    apiClient.post("api/students/getBatchesByStudentId", data),
  updateStudentStatus: (id, data) =>
    apiClient.put(`api/students/${id}/status`, data),
};

export const batchCreationApi = {
  getBatchCreation: (data) =>
    apiClient.post("api/batchCreation/getBatchCreation", data),
  getBatchCreationById: (data) =>
    apiClient.post("api/batchCreation/getBatchCreationById", data),
  updateBatchCreation: (data) =>
    apiClient.post("api/batchCreation/updateBatchCreation", data),
  deleteBatchCreation: (data) =>
    apiClient.post("api/batchCreation/deleteBatchCreation", data),
  addBatchCreation: (data) =>
    apiClient.post("api/batchCreation/addBatchCreation", data),
  getBatchesByBatchCreationId: (data) =>
    apiClient.post("api/batchCreation/getBatchesByBatchCreationId", data),
};

export const usermananagementApi = {
  getUsers: () => apiClient.get("api/users"),
  getStudents: () => apiClient.get("api/users/getStudents"),
  getTutors: () => apiClient.get("api/users/getTutors"),
  getUserById: (id) => apiClient.get(`api/users/${id}`),
  addUser: (data) => apiClient.post("api/users", data),
  bulkAddStudents: (data) => {
    if (data instanceof FormData) {
      return apiClient.post("api/users/bulkAddStudents", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    }
    return apiClient.post("api/users/bulkAddStudents", data);
  },
  updateUser: (data) => apiClient.put(`api/users/${data.USER_ID}`, data),
  deleteUser: (id) => apiClient.delete(`api/users/${id}`),
  updateUserStatus: (data) =>
    apiClient.put(`api/users/${data.USER_ID}/status`, {
      isActive: data.IS_ACTIVE,
    }),
  getUserActivityLogs: (params) =>
    apiClient.get("api/users/activity-logs", { params }),
};

export const notificationsApi = {
  getNotifications: (params) => apiClient.get("api/notifications", { params }),
  sendNotification: (data) => apiClient.post("api/notifications", data),
};

export const tutorAllocationApi = {
  getTutorAllocation: (params) =>
    apiClient.get(
      "api/tutorAllocation/getTutorAllocation",
      { params }
    ),

  getActiveBatches: () =>
    apiClient.get(
      "api/tutorAllocation/getActiveBatches"
    ),

  assignTutors: (data) =>
    apiClient.post(
      "api/tutorAllocation/assignBatch",
      data
    ),
  
  updateTutorRole: (data) =>
    apiClient.put(
      "api/tutorAllocation/updateTutorRole",
      data
    ),

  deleteTutorAllocation: (data) =>
    apiClient.post(
      "api/tutorAllocation/deleteTutorAllocation",
      data
    ),
};

export const studentAllocationApi = {
  getStudents: () => apiClient.get("api/student-allocation"),
  getBatches: (params) => apiClient.get("api/student-allocation/batches", { params }),
  assignStudents: (data) =>
    apiClient.post("api/student-allocation/assign", data),
};
export const chatRoomApi = {
  getStudentChatRooms: (studentId) =>
    apiClient.get(`api/chat-rooms/student/${studentId}`, {
      params: { studentId },
      headers: studentId ? { "x-user-id": studentId } : {},
    }),
  getChatRoom: (roomId, userId) =>
    apiClient.get(`api/chat-rooms/rooms/${roomId}`, {
      params: userId ? { userId, studentId: userId } : {},
      headers: userId ? { "x-user-id": userId } : {},
    }),
  getChatRoomBatches: (params) =>
    apiClient.get(`api/chat-rooms/getChatRoomBatches`, { params }),
  sendMessage: (data) => apiClient.post(`api/chat-rooms/messages`, data),
};

export const courseMaterialApi = {

  upload: (data) =>
    apiClient.post("api/course-material/", data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),

  getAll: (params) =>
    apiClient.get("api/course-material/", { params }),

  getById: (id) =>
    apiClient.get(`api/course-material/${id}`),

  // =====================================================

  getStudentMaterials: (userId) =>
    apiClient.get(`api/course-material/student?USER_ID=${userId}`),

  update: (id, data) =>
    apiClient.put(`api/course-material/${id}`, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),

  deleteFile: (id, filePath) =>
    apiClient.delete(`api/course-material/${id}/file`, {
      data: {
        filePath,
      },
    }),

  deleteMaterial: (id) =>
    apiClient.delete(`api/course-material/${id}`),

  downloadZip: (id) =>
    apiClient.get(`api/course-material/${id}/download`, {
      responseType: "blob",
    }),
};

export const batchAnnouncementsApi = {
  getAll: (params) => apiClient.get("api/batch-announcements/recent", { params }),
  getBatches: (params) => apiClient.get("api/batch-announcements/batches", { params }),
  create: (data) => apiClient.post("api/batch-announcements/send", data),
};

export const classScheduleApi = {
  getUpcoming: (userId, batchId = null) =>
    apiClient.get("api/class-schedules/upcoming", {
      params: {
        userId,
        ...(batchId ? { batchId } : {}),
      },
    }),
  
  getLiveClasses: (userId, batchId) =>
    apiClient.get("api/class-schedules/live/upcoming", {
      params: {
        userId,
        ...(batchId ? { batchId } : {}),
      },
    }),

  create: (data) =>
    apiClient.post("api/class-schedules/create", data),

  update: (id, data) =>
    apiClient.put(`api/class-schedules/update/${id}`, data),

  getTutorBatches: (userId) =>
    apiClient.get(`api/class-schedules/tutor/${userId}/batches`),

  getCalendarSchedule: (userId, params = {}) =>
    apiClient.get("api/class-schedules/calendar", {
      params: {
        userId,
        ...params,
      },
    }),
};

export const classDetailsApi = {
  getByStudentId: (studentId) =>
    apiClient.get(`api/class-details/student/${studentId}`),
};

export const sessionReviewApi = {
  getByStudentId: (studentId) =>
    apiClient.get(`api/session-reviews/student/${studentId}`),
  create: (data) => apiClient.post("api/session-reviews", data),
  getReviews: (params) => apiClient.get("api/session-reviews", { params }),
  getBatches: (params) => apiClient.get("api/session-reviews/batches", { params }),
};

export const attendanceApi = {
  getInitialData: (batchId, classId, userId, userType) =>
    apiClient.get("api/attendance/initial-data", {
      params: {
        batchId,
        classId,
        ...(userId ? { userId } : {}),
        ...(userType ? { userType } : {}),
      },
    }),
  getBatchDateAttendance: (batchId, params) => {
    let queryParams = { batchId };
    if (typeof params === "string") {
      queryParams.date = params;
    } else if (typeof params === "number") {
      queryParams.classId = params;
    } else if (params && typeof params === "object") {
      queryParams = { batchId, ...params };
    }
    return apiClient.get("api/attendance/batch-date-attendance", {
      params: queryParams,
    });
  },
  getSessionAttendance: (batchId, classId) =>
    apiClient.get("api/attendance/batch-date-attendance", {
      params: { batchId, classId },
    }),
  submit: (data) => apiClient.post("api/attendance/submit", data),
  getStudentAttendance: (studentId) =>
    apiClient.get(`api/attendance/get-student-attendance/${studentId}`),
  getStudentAttendanceByBatch: (studentId, batchId) =>
    apiClient.get(`api/attendance/student/${studentId}/batch/${batchId}`),
};

export const booksApi = {
  getBooksBySchool: (data) =>
    apiClient.post("api/questions/getBooksBySchool", data),
};

export const questionTypeApi = {
  listActiveQuestionType: () =>
    apiClient.get("api/questions/listActiveQuestionType"),
};

export const questionsApi = {
  addQuestion: (data) => apiClient.post("api/questions/createQuestion", data),
  getQuestions: (data) => apiClient.post("api/questions/getQuestions", data),
  updateQuestion: (data) =>
    apiClient.put("api/questions/updateQuestion/" + data.ID, data),
  deleteQuestion: (id, userId) =>
    apiClient.delete(
      "api/questions/deleteQuestion?id=" + id + "&userId=" + userId,
    ),
  updateQuestionStatus: (data) =>
    apiClient.post("api/questions/updateQuestionStatus", data),
  getQuestionByType: (data) =>
    apiClient.post("api/questions/getQuestionByType", data),
  getBooksBySchool: (data) =>
    apiClient.post("api/questions/getBooksBySchool", data),
  uploadImage: (data) => apiClient.post("api/questions/uploadImage", data),
  deleteCkeditorImage: (data) => apiClient.post("api/questions/deleteCkeditorImage", data)
};

export const templateApi = {
  create: (data) => apiClient.post("api/question/createTemplate", data),

  getAll: (params) => apiClient.post("api/question/getTemplates", params || {}),

  getById: (id) => apiClient.get(`api/question/getTemplate/${id}`),

  update: (id, data) =>
    apiClient.put(`api/question/updateTemplate/${id}`, data),

  updateStatus: (data) =>
    apiClient.post("api/question/updateTemplateStatus", data),

  delete: (id) => apiClient.delete(`api/question/deleteTemplate/${id}`),
};

export const moduleApi = {
  create: (data) => apiClient.post("api/modules/create", data),

  getAll: () => apiClient.get("api/modules/list"),

  getActive: () => apiClient.get("api/modules/active"),

  update: (id, data) => apiClient.put(`api/modules/update/${id}`, data),

  updateStatus: (data) => apiClient.post("api/modules/update-status", data),

  delete: (id) => apiClient.delete(`api/modules/${id}`),
};

export const assignmentAlertApi = {
  // =====================================================
  // GET AVAILABLE QUESTION SETS
  // =====================================================
  getModules: (params) => {
    const queryParams = typeof params === "object" ? params : (params ? { batchId: params } : undefined);
    return apiClient.get("api/assignment-alert/modules", { params: queryParams });
  },

  // =====================================================
  // GET HOST BATCHES + SCHEDULED CLASSES
  // =====================================================
  getTutorBatch: (userId) =>
    apiClient.get(
      `api/assignment-alert/tutor/${userId}/batch`
    ),

  // =====================================================
  // CREATE ASSIGNMENT ALERT
  // =====================================================
  create: (data) =>
    apiClient.post(
      "api/assignment-alert/create",
      data
    ),

  // =====================================================
  // GET AVAILABLE PROJECT KITS
  // =====================================================
  getAvailableProjectKits: (params) => {
    const queryParams = typeof params === "object" ? params : (params ? { batchId: params } : undefined);
    return apiClient.get("api/assignment-alert/available-project-kits", { params: queryParams });
  },

  // =====================================================
  // GET TUTOR ASSIGNMENT ALERTS
  // =====================================================
  getTutorAlerts: (userId) =>
    apiClient.get(
      `api/assignment-alert/tutor/${userId}`
    ),
};

export const studentAssignmentApi = {
  getStudentAssignments: (userId) =>
    apiClient.get(`api/student-assignment/student/${userId}`),
  getAssessmentResults: (userId) =>
    apiClient.get(`api/student-assignment/assessment-results/${userId}`),
};

export const assessmentResultsApi = {
  getResults: (userId) =>
    apiClient.get(`api/student-assignment/assessment-results/${userId}`),
};

export const practiceExamApi = {
  getAssignmentExam: (params) =>
    apiClient.get(
      "api/student-assignment/practice-exam/assignment-exam",
      {
        params,
      }
    ),

  savePracticeExamAttempt: (data) =>
    apiClient.post(
      "api/student-assignment/save-attempt",
      data,
      data instanceof FormData
        ? {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        : undefined
    ),
};

export const finalAssessmentApi = {
  // Batches & Assignment
  getTutorBatches: (userId) =>
    apiClient.get(`api/final-assessment/tutor/${userId}/batches`),
  getTheoryTemplates: () =>
    apiClient.get("api/final-assessment/theory-templates"),
  getPracticalKits: () =>
    apiClient.get("api/final-assessment/practical-kits"),
  assignFinalAssessment: (data) =>
    apiClient.post("api/final-assessment/assign", data),

  // Unified
  getAllByTutor: (userId) =>
    apiClient.get(`api/final-assessment/all/tutor/${userId}`),

  // Theory
  createTheory: (data) =>
    apiClient.post("api/final-assessment/theory/create", data),
  getTheoryByTutor: (userId) =>
    apiClient.get(`api/final-assessment/theory/tutor/${userId}`),
  getTheoryById: (id) =>
    apiClient.get(`api/final-assessment/theory/${id}`),
  updateTheory: (id, data) =>
    apiClient.put(`api/final-assessment/theory/${id}`, data),
  updateTheoryStatus: (data) =>
    apiClient.put("api/final-assessment/theory/status", data),
  deleteTheory: (id) =>
    apiClient.delete(`api/final-assessment/theory/${id}`),

  // Practical
  createPractical: (data) =>
    apiClient.post("api/final-assessment/practical/create", data),
  getPracticalByTutor: (userId) =>
    apiClient.get(`api/final-assessment/practical/tutor/${userId}`),
  updatePractical: (id, data) =>
    apiClient.put(`api/final-assessment/practical/${id}`, data),
  updatePracticalStatus: (data) =>
    apiClient.put("api/final-assessment/practical/status", data),
  deletePractical: (id) =>
    apiClient.delete(`api/final-assessment/practical/${id}`),

  // Student
  getStudentAssigned: (studentId) =>
    apiClient.get(`api/final-assessment/student/${studentId}`),
  submitProject: (formData) =>
    apiClient.post("api/final-assessment/submission", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // Tutor Evaluation
  getEvaluationSubmissions: (batchId, tutorId, assessmentType = "THEORY") =>
    apiClient.get(`api/final-assessment/evaluation/batch/${batchId}`, {
      params: {
        ...(tutorId ? { tutorId } : {}),
        ...(assessmentType ? { assessmentType, type: assessmentType } : {}),
      },
    }),
  getSubmissionPreview: (submissionId, tutorId, assessmentType = "THEORY", studentId = null) =>
    apiClient.get(`api/final-assessment/evaluation/submission/${submissionId}`, {
      params: {
        ...(tutorId ? { tutorId } : {}),
        ...(assessmentType ? { assessmentType, type: assessmentType } : {}),
        ...(studentId ? { studentId } : {}),
      },
    }),
  submitEvaluation: (data) =>
    apiClient.post("api/final-assessment/evaluation/submit", data),

  // Student Certificate
  getCertificate: (studentId) =>
    apiClient.get(`api/final-assessment/student/${studentId}/certificate`),

  // Certificate Publishing
  getPublishStudents: (batchId, tutorId) =>
    apiClient.get(`api/final-assessment/publish-students/${batchId}`, {
      params: {
        ...(tutorId ? { tutorId } : {}),
      },
    }),
  publishCertificates: (data) =>
    apiClient.post("api/final-assessment/publish-certificates", data),
};

export const projectKitsApi = {
  getAll: () => apiClient.get("api/project-kits"),
  getAvailable: (params) => {
    const queryParams = typeof params === "object" ? params : (params ? { batchId: params } : undefined);
    return apiClient.get("api/project-kits/available", { params: queryParams });
  },
  getById: (id) => apiClient.get(`api/project-kits/${id}`),
  create: (data) =>
    apiClient.post("api/project-kits", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id, data) =>
    apiClient.put(`api/project-kits/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  delete: (id, params = {}) =>
    apiClient.delete(`api/project-kits/${id}`, { params }),
};

export const projectKitEvaluationApi = {
  getTutorBatches: (userId) =>
    apiClient.get(`api/project-kit-evaluation/tutor/${userId}/batches`),
  getSubmissions: (params) =>
    apiClient.get("api/project-kit-evaluation/submissions", { params }),
  getSubmissionPreview: (submissionId, tutorId) =>
    apiClient.get(`api/project-kit-evaluation/submission/${submissionId}`, {
      params: tutorId ? { tutorId } : {},
    }),
  submitEvaluation: (data) =>
    apiClient.post("api/project-kit-evaluation/evaluate", data),
};

export const usersApi = {
  getProfile: (userId) => apiClient.get(`api/users/profile/${userId}`),
  updateProfile: (userId, data) =>
    apiClient.put(`api/users/profile/${userId}`, data),
  changePassword: (data) => apiClient.put("api/users/change-password", data),
};

export const practiceTestAnalysisApi = {
  getTutorBatches: (tutorId) =>
    apiClient.get("api/practice-test-analysis/batches", {
      params: { tutorId },
    }),
  getBatchStudents: (batchId, tutorId, params = {}) =>
    apiClient.get(`api/practice-test-analysis/batch/${batchId}/students`, {
      params: { tutorId, ...params },
    }),
  getStudentAssessments: (studentId, batchId, tutorId, params = {}) =>
    apiClient.get(
      `api/practice-test-analysis/student/${studentId}/assessments`,
      {
        params: { batchId, tutorId, ...params },
      }
    ),
  sendReminder: (data) =>
    apiClient.post("api/practice-test-analysis/send-reminder", data),
};

export const profileApi = usersApi;
