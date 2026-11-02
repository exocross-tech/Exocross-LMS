export const batchesTableHeading = [
  {
    header: "Batch Code",
    accessor: "BATCH_CODE",
    className: "upperCase",
  },
  {
    header: "Start Date",
    accessor: "START_DATE",
    className: "",
  },
  {
    header: "End Date",
    accessor: "END_DATE",
    className: "",
  },
];

export const academicTableHeading = [
  {
    header: "Academic Name",
    accessor: "ACADEMIC_NAME",
    className: "upperCase",
  },
  {
    header: "Start Date",
    accessor: "START_DATE",
    className: "",
  },
  {
    header: "End Date",
    accessor: "END_DATE",
    className: "",
  },
];
export const seriesTableHeading = [
  {
    header: "Series Name",
    accessor: "SERIES_NAME",
    className: "upperCase",
  },
];
export const booksTableHeading = [
  {
    header: "BooK Id",
    accessor: "ID",
    className: "",
  },
  {
    header: "Book Name",
    accessor: "BOOK_NAME",
    className: "upperCase",
  },
  {
    header: "Version",
    accessor: "VERSION",
    className: "upperCase",
  },
  {
    header: "Series",
    accessor: "SERIES_NAME",
    className: "",
  },
];

export const schoolsTableHeading = [
  {
    header: "ID",
    accessor: "ID",
    className: "",
  },
  {
    header: "School Id",
    accessor: "SCHOOL_ID",
    className: "upperCase",
  },
  {
    header: "School Name",
    accessor: "SCHOOL_NAME",
    className: "upperCase",
  },
  {
    header: "Address",
    accessor: "ADDRESS",
    className: "",
  },
];

export const academicMappingTableHeading = [
  {
    header: "School Name",
    accessor: "SCHOOL_NAME",
    className: "upperCase",
  },
  {
    header: "Address",
    accessor: "ADDRESS",
    className: "",
  },
  {
    header: "Academic Name",
    accessor: "ACADEMIC_NAME",
    className: "",
  },
  {
    header: "Access Start Date",
    accessor: "ACCESS_START_DATE",
    className: "",
  },
  {
    header: "Access End Date",
    accessor: "ACCESS_END_DATE",
    className: "",
  },
  {
    header: "Status",
    accessor: "STATUS",
    className: "",
  },
];

export const subjectTableHeading = [
  {
    header: "Subject Name",
    accessor: "SUBJECT_NAME",
    className: "upperCase",
  },
];

export const chapterTableHeading = [
  {
    header: "Chapter Name",
    accessor: "CHAPTER_NAME",
    className: "upperCase",
  },
];

export const topicTableHeading = [
  {
    header: "Topic Name",
    accessor: "TOPIC_NAME",
    className: "upperCase",
  },
];

export const subTopicTableHeading = [
  {
    header: "Sub Topic Name",
    accessor: "SUB_TOPIC_NAME",
    className: "upperCase",
  },
];

export const questionsTableHeading = [
  {
    header: "ID",
    accessor: "ID",
    className: "",
  },
  {
    header: "Question",
    accessor: "QUESTION_TEXT",
    className: "",
  },
  {
    header: "Mark",
    accessor: "MARK",
    className: "",
  },
  {
    header: "Difficulty Level",
    accessor: "DIFFICULTY_LEVEL",
    className: "",
  },
];

export const questionPaperTableHeadingWithSchool = [
  {
    header: "School Name",
    accessor: "SCHOOL_NAME",
    className: "upperCase",
  },
  {
    header: "Exam Title",
    accessor: "EXAM_TITLE",
    className: "upperCase",
  },
  {
    header: "Class",
    accessor: "CLASS_NAME",
    className: "upperCase",
  },
  {
    header: "Book Name",
    accessor: "BOOK_FULL_NAME",
    className: "upperCase",
  },
  {
    header: "Chapter List",
    accessor: "CHAPTER_LIST",
    className: "upperCase",
  },
  {
    header: "Publish",
    accessor: "PUBLISH",
    className: "",
  },
];

export const questionPaperTableHeadingWithoutSchool = [
  {
    header: "Exam Title",
    accessor: "EXAM_TITLE",
    className: "upperCase",
  },
  {
    header: "Class",
    accessor: "CLASS_NAME",
    className: "upperCase",
  },
  {
    header: "Book Name",
    accessor: "BOOK_FULL_NAME",
    className: "upperCase",
  },
  {
    header: "Chapter List",
    accessor: "CHAPTER_LIST",
    className: "upperCase",
  },
  {
    header: "Publish",
    accessor: "PUBLISH",
    className: "",
  },
];

export const examResultTableHeading = [
  {
    header: "Register Number",
    accessor: "REGISTER_NUMBER",
    className: "",
  },
  {
    header: "Student Name",
    accessor: "STUDENT_NAME",
    className: "upperCase",
  },
  {
    header: "Exam Name",
    accessor: "EXAM_TITLE",
    className: "upperCase",
  },
  {
    header: "Exam Date",
    accessor: "EXAM_DATE",
    className: "",
  },
  {
    header: "Mark",
    accessor: "STUDENT_MARK",
    className: "",
  },
  {
    header: "Result",
    accessor: "EXAM_RESULT",
    className: "upperCase",
  },
];

export const applicationTableHeading = [
  {
    header: "Application Title",
    accessor: "APPLICATION_TITLE",
    className: "upperCase",
  },
  {
    header: "Course Name",
    accessor: "BOOK_FULLNAME",
    className: "",
  },
];

export const studentsTableHeading = [
  {
    header: "User Name",
    accessor: "USERNAME",
    className: "upperCase",
  },
  {
    header: "School Name",
    accessor: "SCHOOL_NAME",
    className: "",
  },
  {
    header: "Email",
    accessor: "EMAIL_ID",
    className: "",
  },
  {
    header: "Mobile No",
    accessor: "MOBILE_NO",
    className: "",
  },
  {
    header: "Last Login",
    accessor: "LAST_LOGIN",
    className: "",
  },
];

export const usersTableHeading = [
  {
    header: "User Name",
    accessor: "USERNAME",
    className: "upperCase",
  },
  {
    header: "Email",
    accessor: "EMAIL_ID",
    className: "",
  },
  {
    header: "Mobile No",
    accessor: "MOBILE_NO",
    className: "",
  },
  {
    header: "User Type",
    accessor: "USER_TYPE",
    className: "upperCase",
  },
  {
    header: "Last Login",
    accessor: "LAST_LOGIN",
    className: "",
  },
];

export const notificationsTableHeading = [
  { header: "Title", accessor: "TITLE", className: "upperCase" },
  { header: "Message", accessor: "MESSAGE", className: "" },
  { header: "Audience", accessor: "AUDIENCE", className: "upperCase" },
  { header: "Created At", accessor: "CREATED_AT", className: "" },
];

export const tutorsTableHeading = [
  {
    header: "Name",
    accessor: "NAME",
    className: "upperCase",
  },
  {
    header: "Designation",
    accessor: "DESIGNATION",
    className: "upperCase",
  },
  {
    header: "Phone Number",
    accessor: "PHONE",
    className: "",
  },
  {
    header: "Mail ID",
    accessor: "EMAIL",
    className: "",
  },
];

export const classDetailsTableHeading = [
  {
    header: "Day",
    accessor: "DAY",
    className: "class-details-day-column",
  },
  {
    header: "Time",
    accessor: "TIME",
    className: "class-details-time-column",
  },
  {
    header: "Topic",
    accessor: "TOPIC",
    className: "class-details-topic-column",
  },
  {
    header: "Tutor",
    accessor: "TUTOR",
    className: "class-details-tutor-column",
  },
  {
    header: "Join",
    accessor: "JOIN",
    className: "class-details-join-column",
  },
];

export const userLogsTableHeading = [
  {
    header: "Username",
    accessor: "USERNAME",
    className: "upperCase",
  },
  {
    header: "Date",
    accessor: "LOGIN_DATE",
    className: "",
  },
  {
    header: "Time",
    accessor: "LOGIN_TIME",
    className: "",
  },
];