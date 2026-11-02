const sql = require("mssql");
const { getPool } = require("../config/database");

const getStudentClassDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // =====================================================
    // Validate student ID
    // =====================================================

    const parsedStudentId = Number(studentId);

    if (!Number.isInteger(parsedStudentId) || parsedStudentId <= 0) {
      return res.status(400).json({
        status: 0,
        message: "Valid Student ID is required",
      });
    }

    const pool = getPool();

    // =====================================================
    // Get student class details
    // =====================================================

const result = await pool
  .request()
  .input("STUDENT_ID", sql.Int, parsedStudentId)
  .query(`
    SELECT
      CS.ID,
      CS.TOPIC,
      CS.BATCH_ID,
      FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE,
      FORMAT(CS.CLASS_DATE, 'yyyy-MM-dd') AS CLASS_DATE_STR,
      FORMAT(CS.CLASS_DATE, 'dd MMM yyyy') AS CLASS_DATE_FORMATTED,

      CONVERT(
        VARCHAR(5),
        CS.CLASS_TIME,
        108
      ) AS CLASS_TIME,

      CS.MEET_ID,
      CS.MEET_CODE,
      CS.MEET_LINK,

      T.tutorId AS TUTOR_ID,

      U.USERNAME AS TUTOR_NAME

    FROM STUDENT_ALLOCATIONS SA

    INNER JOIN CLASS_SCHEDULES CS
      ON SA.BATCH_ID = CS.BATCH_ID

    LEFT JOIN TUTOR_ALLOCATIONS TA
      ON SA.BATCH_ID = TA.BATCH_ID

    OUTER APPLY (
      SELECT TOP 1
        tutorId,
        role
      FROM OPENJSON(
        ISNULL(TA.TUTOR_IDS, '[]')
      )
      WITH (
        tutorId INT '$.tutorId',
        role NVARCHAR(50) '$.role'
      )
      WHERE
        TRY_CONVERT(INT, role) = 1
        OR UPPER(LTRIM(RTRIM(role))) = 'HOST'
      ORDER BY tutorId
    ) T

    LEFT JOIN USERS U
      ON U.USER_ID = T.tutorId

    WHERE
      SA.STUDENT_ID = @STUDENT_ID
      AND CS.IS_ACTIVE = 1

    ORDER BY
      CS.CLASS_DATE ASC,
      CS.CLASS_TIME ASC
  `);

    console.log(
      `Student ${parsedStudentId} class records:`,
      result.recordset
    );

    // =====================================================
    // Format response
    // =====================================================

    const classes = result.recordset.map((item) => {
      let day = "-";

      if (item.CLASS_DATE) {
        const date = new Date(item.CLASS_DATE);

        if (!isNaN(date.getTime())) {
          day = date.toLocaleDateString("en-US", {
            weekday: "short",
          });
        }
      }

      return {
        ID: item.ID,

        BATCH_ID: item.BATCH_ID,

        TUTOR_ID: item.TUTOR_ID || null,

        CLASS_DATE: item.CLASS_DATE || null,

        CLASS_DATE_STR: item.CLASS_DATE_STR || null,

        CLASS_DATE_FORMATTED: item.CLASS_DATE_FORMATTED || null,

        DAY: day,

        TIME: item.CLASS_TIME
          ? String(item.CLASS_TIME).substring(0, 5)
          : "-",

        TOPIC: item.TOPIC || "-",

        TUTOR: item.TUTOR_NAME || "-",

        JOIN_LINK: item.MEET_LINK || null,

        MEET_ID: item.MEET_ID || null,

        MEET_CODE: item.MEET_CODE || null,
      };
    });

    return res.status(200).json({
      status: 1,
      message: "Student class details fetched successfully.",
      data: classes,
    });

  } catch (error) {
    console.error(
      "Get student class details error:",
      error
    );

    return res.status(500).json({
      status: 0,
      message: "Failed to fetch student class details.",
      error: error.message,
    });
  }
};

module.exports = {
  getStudentClassDetails,
};
