const { sql } = require("../../config/database");

const userListBySchool = async (req, res) => {
    try {
        const { SCHOOL_ID, USER_TYPE } = req.body;

        if (!SCHOOL_ID) {
            return res.status(400).json({ status: 0, message: "SCHOOL_ID is required" });
        }

        if (!USER_TYPE || (USER_TYPE !== 'STUDENT' && USER_TYPE !== 'TEACHER')) {
            return res.status(400).json({ status: 0, message: "Invalid or missing USER_TYPE. Must be 'STUDENT' or 'TEACHER'" });
        }

        const result = await sql.query`
            SELECT FIRST_NAME,LAST_NAME,USERNAME,MOBILE,EMAIL,IS_ACTIVE,FORMAT(LAST_LOGIN,'dd/MM/yyyy hh:mm tt') AS LAST_LOGIN
            FROM MST_USERS 
            WHERE SCHOOL_ID = ${SCHOOL_ID} 
              AND USER_TYPE = ${USER_TYPE}
        `;

        res.json({
            status: 1,
            data: result.recordset
        });
    } catch (err) {
        console.error("Reports error:", err);
        res.status(500).json({ status: 0, message: "Error fetching user list", error: err.message });
    }
};

const studentEngagement = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({ status: 0, message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required" });
        }

        const result = await sql.query`
            SELECT 
                U.FIRST_NAME, 
                U.LAST_NAME, 
                U.USERNAME,
                U.MOBILE,
                COUNT(A.USER_ID) AS TOTAL_ACTIVITIES,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'LOGIN' THEN 1 END) AS TOTAL_LOGINS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'READ EBOOK' THEN 1 END) AS EBOOK_READS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'CBT Videos' THEN 1 END) AS CBT_VIDEOS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'Teaching Guide Videos' THEN 1 END) AS TEACHING_GUIDES,
                (SELECT FORMAT(MAX(ACTIVITY_DATE), 'dd/MM/yyyy hh:mm tt') FROM USER_ACTIVITY_LOGS WHERE USER_ID = U.ID) AS LAST_ACTIVITY
            FROM MST_USERS U
            LEFT JOIN USER_ACTIVITY_LOGS A 
                ON U.ID = A.USER_ID 
                AND CAST(A.ACTIVITY_DATE AS DATE) >= CAST(${FROM_DATE} AS DATE)
                AND CAST(A.ACTIVITY_DATE AS DATE) <= CAST(${TO_DATE} AS DATE)
            WHERE U.SCHOOL_ID = ${SCHOOL_ID} 
              AND U.USER_TYPE = 'STUDENT'
            GROUP BY U.ID, U.FIRST_NAME, U.LAST_NAME, U.USERNAME, U.MOBILE
            ORDER BY TOTAL_ACTIVITIES DESC
        `;

        res.json({
            status: 1,
            data: result.recordset
        });
    } catch (err) {
        console.error("Student Engagement error:", err);
        res.status(500).json({ status: 0, message: "Error fetching student engagement", error: err.message });
    }
};

const teacherEngagement = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({ status: 0, message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required" });
        }

        const result = await sql.query`
            SELECT 
                U.FIRST_NAME, 
                U.LAST_NAME, 
                U.USERNAME,
                U.MOBILE,
                COUNT(A.USER_ID) AS TOTAL_ACTIVITIES,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'LOGIN' THEN 1 END) AS TOTAL_LOGINS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'VIEW_CONTENT' THEN 1 END) AS VIEW_CONTENT,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'UPLOAD_MATERIAL' THEN 1 END) AS UPLOAD_MATERIAL,
                (SELECT FORMAT(MAX(ACTIVITY_DATE), 'dd/MM/yyyy hh:mm tt') FROM USER_ACTIVITY_LOGS WHERE USER_ID = U.ID) AS LAST_ACTIVITY
            FROM MST_USERS U
            LEFT JOIN USER_ACTIVITY_LOGS A 
                ON U.ID = A.USER_ID 
                AND CAST(A.ACTIVITY_DATE AS DATE) >= CAST(${FROM_DATE} AS DATE)
                AND CAST(A.ACTIVITY_DATE AS DATE) <= CAST(${TO_DATE} AS DATE)
            WHERE U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.USER_TYPE = 'TEACHER'
            GROUP BY U.ID, U.FIRST_NAME, U.LAST_NAME, U.USERNAME, U.MOBILE
            ORDER BY TOTAL_ACTIVITIES DESC
        `;

        res.json({
            status: 1,
            data: result.recordset
        });
    } catch (err) {
        console.error("Teacher Engagement error:", err);
        res.status(500).json({ status: 0, message: "Error fetching teacher engagement", error: err.message });
    }
};

const contentUsage = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required"
            });
        }

        const result = await sql.query`
      WITH Subjects AS (
          SELECT 'READ EBOOK' AS ACTIVITY_TYPE
          UNION ALL SELECT 'Teaching Guide Videos'
          UNION ALL SELECT 'CBT Videos'
          UNION ALL SELECT 'Practical Templates'
          UNION ALL SELECT 'Softwares'
      ),
      TotalStudents AS (
          SELECT COUNT(*) AS TOTAL_COUNT
          FROM MST_USERS
          WHERE USER_TYPE = 'STUDENT'
            AND SCHOOL_ID = ${SCHOOL_ID}
      )
      SELECT
          S.ACTIVITY_TYPE AS SubjectName,
          CAST(
              ISNULL(
                  COUNT(DISTINCT A.USER_ID) * 100.0 /
                  NULLIF(T.TOTAL_COUNT, 0),
              0)
          AS DECIMAL(5,2)) AS EngagementPercentage
      FROM Subjects S
      CROSS JOIN TotalStudents T
      LEFT JOIN USER_ACTIVITY_LOGS A
          ON A.ACTIVITY_TYPE = S.ACTIVITY_TYPE
         AND A.CREATED_AT >= ${FROM_DATE}
         AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
      LEFT JOIN MST_USERS U
          ON U.ID = A.USER_ID
         AND U.USER_TYPE = 'STUDENT'
         AND U.SCHOOL_ID = ${SCHOOL_ID}
      GROUP BY
          S.ACTIVITY_TYPE,
          T.TOTAL_COUNT
      ORDER BY
          S.ACTIVITY_TYPE;
    `;

        return res.json({
            status: 1,
            data: result.recordset
        });

    } catch (err) {
        console.error("Content Usage error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching content usage",
            error: err.message
        });
    }
};

const ebookUsage = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required"
            });
        }

        /* ================= SUMMARY ================= */
        const summaryResult = await sql.query`
        WITH TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        ),
        EbookUsers AS (
            SELECT COUNT(DISTINCT A.USER_ID) AS USED_COUNT
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.USER_TYPE = 'STUDENT'
              AND U.SCHOOL_ID = ${SCHOOL_ID}
              AND A.ACTIVITY_TYPE = 'READ EBOOK'
              AND A.CREATED_AT >= ${FROM_DATE}
              AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
        )
        SELECT
            CAST(
                ISNULL(
                    (E.USED_COUNT * 100.0) / NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS EbookUsagePercentage,
            ISNULL(E.USED_COUNT, 0) AS StudentsUsedEbook,
            ISNULL(T.TOTAL_COUNT, 0) AS TotalStudents
        FROM TotalStudents T
        LEFT JOIN EbookUsers E ON 1 = 1;
        `;

        /* ================= LINE CHART ================= */
        const trendResult = await sql.query`
        WITH DateSeries AS (
            SELECT CAST(${FROM_DATE} AS DATE) AS LogDate
            UNION ALL
            SELECT DATEADD(DAY, 1, LogDate)
            FROM DateSeries
            WHERE LogDate < CAST(${TO_DATE} AS DATE)
        ),
        TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        )
        SELECT
            FORMAT(D.LogDate, 'dd/MM') AS DateLabel,
            CAST(
                ISNULL(
                    COUNT(DISTINCT A.USER_ID) * 100.0 /
                    NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS UsagePercentage
        FROM DateSeries D
        CROSS JOIN TotalStudents T
        LEFT JOIN USER_ACTIVITY_LOGS A
            ON CAST(A.CREATED_AT AS DATE) = D.LogDate
           AND A.ACTIVITY_TYPE = 'READ EBOOK'
        LEFT JOIN MST_USERS U
            ON U.ID = A.USER_ID
           AND U.USER_TYPE = 'STUDENT'
           AND U.SCHOOL_ID = ${SCHOOL_ID}
        GROUP BY D.LogDate, T.TOTAL_COUNT
        ORDER BY D.LogDate
        OPTION (MAXRECURSION 1000);
        `;

        /* ================= RESPONSE ================= */
        return res.json({
            status: 1,
            summary: summaryResult.recordset[0],
            lineChart: {
                labels: trendResult.recordset.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "E-Book Usage %",
                        data: trendResult.recordset.map(r => r.UsagePercentage)
                    }
                ]
            }
        });

    } catch (err) {
        console.error("E-Book Usage error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching e-book usage report",
            error: err.message
        });
    }
};

const cbtUsage = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required"
            });
        }

        /* ================= SUMMARY ================= */
        const summaryResult = await sql.query`
        WITH TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        ),
        CBTUsers AS (
            SELECT COUNT(DISTINCT A.USER_ID) AS USED_COUNT
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.USER_TYPE = 'STUDENT'
              AND U.SCHOOL_ID = ${SCHOOL_ID}
              AND A.ACTIVITY_TYPE = 'CBT Videos'
              AND A.CREATED_AT >= ${FROM_DATE}
              AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
        )
        SELECT
            CAST(
                ISNULL(
                    (C.USED_COUNT * 100.0) / NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS CbtUsagePercentage,
            ISNULL(C.USED_COUNT, 0) AS StudentsUsedCbt,
            ISNULL(T.TOTAL_COUNT, 0) AS TotalStudents
        FROM TotalStudents T
        LEFT JOIN CBTUsers C ON 1 = 1;
        `;

        /* ================= LINE CHART ================= */
        const trendResult = await sql.query`
        WITH DateSeries AS (
            SELECT CAST(${FROM_DATE} AS DATE) AS LogDate
            UNION ALL
            SELECT DATEADD(DAY, 1, LogDate)
            FROM DateSeries
            WHERE LogDate < CAST(${TO_DATE} AS DATE)
        ),
        TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        )
        SELECT
            FORMAT(D.LogDate, 'dd/MM') AS DateLabel,
            CAST(
                ISNULL(
                    COUNT(DISTINCT A.USER_ID) * 100.0 /
                    NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS UsagePercentage
        FROM DateSeries D
        CROSS JOIN TotalStudents T
        LEFT JOIN USER_ACTIVITY_LOGS A
            ON CAST(A.CREATED_AT AS DATE) = D.LogDate
           AND A.ACTIVITY_TYPE = 'CBT Videos'
        LEFT JOIN MST_USERS U
            ON U.ID = A.USER_ID
           AND U.USER_TYPE = 'STUDENT'
           AND U.SCHOOL_ID = ${SCHOOL_ID}
        GROUP BY D.LogDate, T.TOTAL_COUNT
        ORDER BY D.LogDate
        OPTION (MAXRECURSION 1000);
        `;

        /* ================= RESPONSE ================= */
        return res.json({
            status: 1,
            summary: summaryResult.recordset[0],
            lineChart: {
                labels: trendResult.recordset.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "CBT Usage %",
                        data: trendResult.recordset.map(r => r.UsagePercentage)
                    }
                ]
            }
        });

    } catch (err) {
        console.error("CBT Usage error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching CBT usage report",
            error: err.message
        });
    }
};


const teachingGuideUsage = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, and TO_DATE are required"
            });
        }

        /* ================= SUMMARY ================= */
        const summaryResult = await sql.query`
        WITH TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        ),
        TeachingGuideUsers AS (
            SELECT COUNT(DISTINCT A.USER_ID) AS USED_COUNT
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.USER_TYPE = 'STUDENT'
              AND U.SCHOOL_ID = ${SCHOOL_ID}
              AND A.ACTIVITY_TYPE = 'Teaching Guide Videos'
              AND A.CREATED_AT >= ${FROM_DATE}
              AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
        )
        SELECT
            CAST(
                ISNULL(
                    (TG.USED_COUNT * 100.0) / NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS TeachingGuideUsagePercentage,
            ISNULL(TG.USED_COUNT, 0) AS StudentsUsedTeachingGuide,
            ISNULL(T.TOTAL_COUNT, 0) AS TotalStudents
        FROM TotalStudents T
        LEFT JOIN TeachingGuideUsers TG ON 1 = 1;
        `;

        /* ================= LINE CHART ================= */
        const trendResult = await sql.query`
        WITH DateSeries AS (
            SELECT CAST(${FROM_DATE} AS DATE) AS LogDate
            UNION ALL
            SELECT DATEADD(DAY, 1, LogDate)
            FROM DateSeries
            WHERE LogDate < CAST(${TO_DATE} AS DATE)
        ),
        TotalStudents AS (
            SELECT COUNT(*) AS TOTAL_COUNT
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${SCHOOL_ID}
        )
        SELECT
            FORMAT(D.LogDate, 'dd/MM') AS DateLabel,
            CAST(
                ISNULL(
                    COUNT(DISTINCT A.USER_ID) * 100.0 /
                    NULLIF(T.TOTAL_COUNT, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS UsagePercentage
        FROM DateSeries D
        CROSS JOIN TotalStudents T
        LEFT JOIN USER_ACTIVITY_LOGS A
            ON CAST(A.CREATED_AT AS DATE) = D.LogDate
           AND A.ACTIVITY_TYPE = 'Teaching Guide Videos'
        LEFT JOIN MST_USERS U
            ON U.ID = A.USER_ID
           AND U.USER_TYPE = 'STUDENT'
           AND U.SCHOOL_ID = ${SCHOOL_ID}
        GROUP BY D.LogDate, T.TOTAL_COUNT
        ORDER BY D.LogDate
        OPTION (MAXRECURSION 1000);
        `;

        /* ================= RESPONSE ================= */
        return res.json({
            status: 1,
            summary: summaryResult.recordset[0],
            lineChart: {
                labels: trendResult.recordset.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "Teaching Guide Usage %",
                        data: trendResult.recordset.map(r => r.UsagePercentage)
                    }
                ]
            }
        });

    } catch (err) {
        console.error("Teaching Guide Usage error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching teaching guide usage report",
            error: err.message
        });
    }
};

const classWiseLmsUsage = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        const classUsageResult = await sql.query`
WITH Classes AS (
    SELECT DISTINCT
        T.SCHOOL_ID,
        JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME
    FROM TRN_SCHOOL_BOOK_ACADEMIC T
    CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
    WHERE T.SCHOOL_ID = ${SCHOOL_ID}
      AND T.IS_ACTIVE = 1
),
ClassBooks AS (
    SELECT
        JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME,
        B.ID AS BOOK_ID
    FROM TRN_SCHOOL_BOOK_ACADEMIC T
    CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
    CROSS APPLY OPENJSON(JSON_QUERY(C.value, '$.BOOK_DETAILS'))
        WITH (ID INT '$.ID') B
    WHERE T.SCHOOL_ID = ${SCHOOL_ID}
      AND T.IS_ACTIVE = 1
),
StudentClassMap AS (
    SELECT DISTINCT
        U.ID AS USER_ID,
        CB.CLASS_NAME
    FROM MST_USERS U
    CROSS APPLY STRING_SPLIT(CAST(U.MAPPED_BOOKS AS NVARCHAR(MAX)), ',') S
    JOIN ClassBooks CB
        ON CAST(S.value AS INT) = CB.BOOK_ID
    WHERE U.USER_TYPE = 'STUDENT'
      AND U.SCHOOL_ID = ${SCHOOL_ID}
      AND U.IS_ACTIVE = 1
),
ActiveStudents AS (
    SELECT DISTINCT
        A.USER_ID
    FROM USER_ACTIVITY_LOGS A
    JOIN MST_USERS U
        ON U.ID = A.USER_ID
    WHERE U.SCHOOL_ID = ${SCHOOL_ID}
      AND U.USER_TYPE = 'STUDENT'
      AND A.ACTIVITY_TYPE IN (
          'READ EBOOK',
          'Teaching Guide Videos',
          'CBT Videos',
          'Practical Templates',
          'Softwares'
      )
      AND A.CREATED_AT >= ${FROM_DATE}
      AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
)
SELECT
    C.CLASS_NAME,
    COUNT(DISTINCT SCM.USER_ID) AS TotalStudents,
    COUNT(DISTINCT ASU.USER_ID) AS ActiveStudents,
    CAST(
        ISNULL(
            COUNT(DISTINCT ASU.USER_ID) * 100.0 /
            NULLIF(COUNT(DISTINCT SCM.USER_ID), 0),
            0
        ) AS DECIMAL(5,2)
    ) AS UsagePercentage
FROM Classes C
LEFT JOIN StudentClassMap SCM
    ON SCM.CLASS_NAME = C.CLASS_NAME
LEFT JOIN ActiveStudents ASU
    ON ASU.USER_ID = SCM.USER_ID
GROUP BY C.CLASS_NAME
ORDER BY C.CLASS_NAME
`;

        return res.json({
            status: 1,
            barChart: {
                labels: classUsageResult.recordset.map(r => r.CLASS_NAME),
                datasets: [
                    {
                        label: "LMS Usage %",
                        data: classUsageResult.recordset.map(r => r.UsagePercentage),
                        backgroundColor: "#6366f1",
                        borderRadius: 6,
                        barThickness: 35
                    }
                ]
            },
            tableData: classUsageResult.recordset
        });

    } catch (err) {
        console.error("Class-wise LMS Usage Error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching class-wise LMS usage",
            error: err.message
        });
    }
};

const lowEngagementStudents = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE required"
            });
        }

        const result = await sql.query`
        DECLARE @SCHOOL_ID INT = ${SCHOOL_ID};
        DECLARE @FROM_DATE DATE = ${FROM_DATE};
        DECLARE @TO_DATE DATE = ${TO_DATE};

        WITH DateRange AS (
    SELECT DATEDIFF(DAY, @FROM_DATE, @TO_DATE) + 1 AS TOTAL_DAYS
),
StudentActivity AS (
    SELECT
        U.ID AS USER_ID,
        U.FIRST_NAME,
        U.LAST_NAME,
        U.MOBILE,
        COUNT(DISTINCT CAST(A.CREATED_AT AS DATE)) AS ActiveDays,
        COUNT(DISTINCT CASE 
            WHEN A.ACTIVITY_TYPE IN (
                'READ EBOOK',
                'Teaching Guide Videos',
                'CBT Videos',
                'Practical Templates',
                'Softwares'
            )
            THEN CAST(A.CREATED_AT AS DATE)
        END) AS ContentDays
    FROM MST_USERS U
    LEFT JOIN USER_ACTIVITY_LOGS A
        ON A.USER_ID = U.ID
       AND A.CREATED_AT >= @FROM_DATE
       AND A.CREATED_AT < DATEADD(DAY, 1, @TO_DATE)
    WHERE U.USER_TYPE = 'STUDENT'
      AND U.SCHOOL_ID = @SCHOOL_ID
      AND U.IS_ACTIVE = 1
    GROUP BY
        U.ID, U.FIRST_NAME, U.LAST_NAME, U.MOBILE
)
SELECT
    USER_ID,
    FIRST_NAME,
    LAST_NAME,
    MOBILE,
    ActiveDays,
    ContentDays,
    CAST(
        ISNULL(ContentDays * 100.0 / NULLIF(D.TOTAL_DAYS, 0), 0)
        AS DECIMAL(5,2)
    ) AS EngagementPercentage
FROM StudentActivity
CROSS JOIN DateRange D
WHERE
    ISNULL(ContentDays * 100.0 / NULLIF(D.TOTAL_DAYS, 0), 0) < 30
ORDER BY EngagementPercentage ASC;
        `;

        return res.json({
            status: 1,
            totalLowEngagement: result.recordset.length,
            data: result.recordset
        });

    } catch (err) {
        console.error("Low Engagement Error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching low engagement students",
            error: err.message
        });
    }
};

const loginHistoryReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE required"
            });
        }

        const result = await sql.query`
            SELECT
                A.ID AS LOG_ID,
                U.ID AS USER_ID,
                U.FIRST_NAME,
                U.LAST_NAME,
                U.USERNAME,
                U.MOBILE,
                FORMAT(A.ACTIVITY_DATE, 'dd/MM/yyyy hh:mm tt') AS LOGIN_DATE_TIME
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U
                ON U.ID = A.USER_ID
            WHERE A.ACTIVITY_TYPE = 'LOGIN'
              AND U.USER_TYPE = 'STUDENT'
              AND U.SCHOOL_ID = ${SCHOOL_ID}
              AND CAST(A.ACTIVITY_DATE AS DATE)
                  BETWEEN CAST(${FROM_DATE} AS DATE)
                      AND CAST(${TO_DATE} AS DATE)
            ORDER BY A.ACTIVITY_DATE DESC;
        `;

        res.json({
            status: 1,
            data: result.recordset
        });

    } catch (err) {
        console.error("Login History Error:", err);
        res.status(500).json({
            status: 0,
            message: "Error fetching login history",
            error: err.message
        });
    }
};

const contentAccessLog = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        const result = await sql.query`
            SELECT
                A.ID AS LOG_ID,
                U.ID AS USER_ID,
                U.FIRST_NAME,
                U.LAST_NAME,
                U.USERNAME,
                U.MOBILE,

                A.ACTIVITY_TYPE AS CONTENT_TYPE,
                A.BOOK_ID,

                FORMAT(A.CREATED_AT, 'dd/MM/yyyy hh:mm tt') AS ACCESS_DATE_TIME

            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U
                ON U.ID = A.USER_ID

            WHERE U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.USER_TYPE = 'STUDENT'
              AND A.ACTIVITY_TYPE IN (
                    'READ EBOOK',
                    'CBT Videos',
                    'Teaching Guide Videos',
                    'Practical Templates',
                    'Softwares'
              )
              AND CAST(A.CREATED_AT AS DATE) >= CAST(${FROM_DATE} AS DATE)
              AND CAST(A.CREATED_AT AS DATE) <= CAST(${TO_DATE} AS DATE)

            ORDER BY A.CREATED_AT DESC;
        `;

        return res.json({
            status: 1,
            totalRecords: result.recordset.length,
            data: result.recordset
        });

    } catch (err) {
        console.error("Content Access Log Error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching content access log",
            error: err.message
        });
    }
};

const schoolAdoptionReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "FROM_DATE and TO_DATE are required"
            });
        }

        // ✅ Normalize SCHOOL_ID (string-based)
        const schoolId = SCHOOL_ID && SCHOOL_ID !== "" ? SCHOOL_ID : null;

        /* =====================================================
           SCHOOL ADOPTION SUMMARY
        ===================================================== */
        const summaryResult = await sql.query`
        WITH SchoolStudents AS (
            SELECT SCHOOL_ID, COUNT(*) AS TotalStudents
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
            GROUP BY SCHOOL_ID
        ),
        ActiveStudents AS (
            SELECT
                U.SCHOOL_ID,
                COUNT(DISTINCT A.USER_ID) AS ActiveStudents,
                MAX(A.CREATED_AT) AS LastActivityDate
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.USER_TYPE = 'STUDENT'
              AND A.CREATED_AT >= ${FROM_DATE}
              AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
            GROUP BY U.SCHOOL_ID
        )
        SELECT
            SL.ID,
            SL.SCHOOL_NAME,
            FORMAT(SL.CREATED_ON, 'dd/MM/yyyy') AS OnboardDate,

            ISNULL(SS.TotalStudents, 0) AS TotalStudents,
            ISNULL(ASD.ActiveStudents, 0) AS ActiveStudents,

            CAST(
                ISNULL(
                    ASD.ActiveStudents * 100.0 /
                    NULLIF(SS.TotalStudents, 0),
                0)
            AS DECIMAL(5,2)) AS AdoptionPercentage,

            FORMAT(ASD.LastActivityDate, 'dd/MM/yyyy hh:mm tt') AS LastLogin,

            CASE
                WHEN ISNULL(ASD.ActiveStudents, 0) > 0 THEN 'Active'
                ELSE 'Inactive'
            END AS SchoolStatus

        FROM MST_SCHOOLS_LMS SL
        LEFT JOIN SchoolStudents SS ON SS.SCHOOL_ID = SL.ID
        LEFT JOIN ActiveStudents ASD ON ASD.SCHOOL_ID = SL.ID
        WHERE (${schoolId} IS NULL OR SL.ID = ${schoolId})
        ORDER BY AdoptionPercentage DESC;
        `;

        /* =====================================================
           ALL SCHOOLS
        ===================================================== */
        if (!schoolId) {
            return res.json({
                status: 1,
                mode: "ALL_SCHOOLS",
                data: summaryResult.recordset
            });
        }

        /* =====================================================
           LINE CHART – SINGLE SCHOOL
        ===================================================== */
        const trendResult = await sql.query`
        WITH DateSeries AS (
            SELECT CAST(${FROM_DATE} AS DATE) AS LogDate
            UNION ALL
            SELECT DATEADD(DAY, 1, LogDate)
            FROM DateSeries
            WHERE LogDate < CAST(${TO_DATE} AS DATE)
        ),
        TotalStudents AS (
            SELECT COUNT(*) AS TotalCount
            FROM MST_USERS
            WHERE USER_TYPE = 'STUDENT'
              AND SCHOOL_ID = ${schoolId}
        )
        SELECT
            FORMAT(D.LogDate, 'dd/MM') AS DateLabel,
            CAST(
                ISNULL(
                    COUNT(DISTINCT A.USER_ID) * 100.0 /
                    NULLIF(T.TotalCount, 0),
                0)
            AS DECIMAL(5,2)) AS AdoptionPercentage
        FROM DateSeries D
        CROSS JOIN TotalStudents T
        LEFT JOIN USER_ACTIVITY_LOGS A
            ON CAST(A.CREATED_AT AS DATE) = D.LogDate
           AND A.USER_ID IN (
                SELECT ID FROM MST_USERS
                WHERE USER_TYPE = 'STUDENT'
                  AND SCHOOL_ID = ${schoolId}
           )
        GROUP BY D.LogDate, T.TotalCount
        ORDER BY D.LogDate
        OPTION (MAXRECURSION 1000);
        `;

        return res.json({
            status: 1,
            mode: "SINGLE_SCHOOL",
            data: summaryResult.recordset[0],
            lineChart: {
                labels: trendResult.recordset.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "Adoption %",
                        data: trendResult.recordset.map(r => r.AdoptionPercentage),
                        fill: true,
                        tension: 0.4
                    }
                ]
            }
        });

    } catch (err) {
        console.error("School Adoption Report error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching school adoption report",
            error: err.message
        });
    }
};

const classAdoptionReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        const result = await sql.query`
WITH Classes AS (
    SELECT DISTINCT
        T.SCHOOL_ID,
        JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME
    FROM TRN_SCHOOL_BOOK_ACADEMIC T
    CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
    WHERE T.SCHOOL_ID = ${SCHOOL_ID}
      AND T.IS_ACTIVE = 1
),

ClassBookMap AS (
    SELECT
        JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME,
        B.ID AS BOOK_ID
    FROM TRN_SCHOOL_BOOK_ACADEMIC T
    CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
    CROSS APPLY OPENJSON(JSON_QUERY(C.value, '$.BOOK_DETAILS'))
        WITH (ID INT '$.ID') B
    WHERE T.SCHOOL_ID = ${SCHOOL_ID}
      AND T.IS_ACTIVE = 1
),

UserBookMap AS (
    SELECT
        U.ID AS USER_ID,
        CAST(S.value AS INT) AS BOOK_ID
    FROM MST_USERS U
    CROSS APPLY STRING_SPLIT(CAST(U.MAPPED_BOOKS AS NVARCHAR(MAX)), ',') S
    WHERE U.USER_TYPE = 'STUDENT'
      AND U.IS_ACTIVE = 1
      AND U.SCHOOL_ID = ${SCHOOL_ID}
),

UserClassMap AS (
    SELECT DISTINCT
        UBM.USER_ID,
        CBM.CLASS_NAME
    FROM UserBookMap UBM
    INNER JOIN ClassBookMap CBM
        ON UBM.BOOK_ID = CBM.BOOK_ID
),

ActiveStudents AS (
    SELECT DISTINCT USER_ID
    FROM USER_ACTIVITY_LOGS
    WHERE CREATED_AT >= ${FROM_DATE}
      AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
)

SELECT
    C.CLASS_NAME,

    ISNULL(COUNT(DISTINCT UCM.USER_ID), 0) AS TOTAL_STUDENTS,

    ISNULL(
        COUNT(DISTINCT CASE 
            WHEN ASU.USER_ID IS NOT NULL THEN UCM.USER_ID 
        END),
    0) AS ACTIVE_STUDENTS,

    CAST(
        ISNULL(
            COUNT(DISTINCT CASE 
                WHEN ASU.USER_ID IS NOT NULL THEN UCM.USER_ID 
            END) * 100.0 /
            NULLIF(COUNT(DISTINCT UCM.USER_ID), 0),
        0)
    AS DECIMAL(5,2)) AS ADOPTION_PERCENTAGE

FROM Classes C
LEFT JOIN UserClassMap UCM ON UCM.CLASS_NAME = C.CLASS_NAME
LEFT JOIN ActiveStudents ASU ON ASU.USER_ID = UCM.USER_ID
GROUP BY C.CLASS_NAME
ORDER BY C.CLASS_NAME;
`;

        res.json({
            status: 1,
            data: result.recordset,
            barChart: {
                labels: result.recordset.map(r => r.CLASS_NAME),
                datasets: [
                    {
                        label: "Class Adoption %",
                        data: result.recordset.map(r => r.ADOPTION_PERCENTAGE),
                        backgroundColor: "#6366f1",
                        borderRadius: 6
                    }
                ]
            }
        });

    } catch (err) {
        console.error("Class Adoption Report error:", err);
        res.status(500).json({
            status: 0,
            message: "Error fetching class adoption report",
            error: err.message
        });
    }
};

const contentUsageSummary = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        /* =====================================================
           1️⃣ CONTENT USAGE SUMMARY
        ===================================================== */
        const contentResult = await sql.query`
            SELECT
                A.ACTIVITY_TYPE AS LABEL,
                COUNT(*) AS VALUE
            FROM USER_ACTIVITY_LOGS A
            INNER JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.USER_TYPE = 'STUDENT'
              AND CAST(A.ACTIVITY_DATE AS DATE) >= CAST(${FROM_DATE} AS DATE)
              AND CAST(A.ACTIVITY_DATE AS DATE) <= CAST(${TO_DATE} AS DATE)
            GROUP BY A.ACTIVITY_TYPE
        `;

        const contentTypes = [
            "LOGIN",
            "READ EBOOK",
            "CBT Videos",
            "Teaching Guide Videos"
        ];

        const usageMap = {};
        contentResult.recordset.forEach(r => {
            usageMap[r.LABEL] = r.VALUE;
        });

        const contentValues = contentTypes.map(t => usageMap[t] || 0);

        /* =====================================================
           2️⃣ CLASS-WISE LMS ADOPTION (CORRECT SOURCE)
        ===================================================== */
        const classResult = await sql.query`
        WITH Classes AS (
            SELECT DISTINCT
                JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME
            FROM TRN_SCHOOL_BOOK_ACADEMIC T
            CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
            WHERE T.SCHOOL_ID = ${SCHOOL_ID}
              AND T.IS_ACTIVE = 1
        ),
        ClassBooks AS (
            SELECT
                JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME,
                B.ID AS BOOK_ID
            FROM TRN_SCHOOL_BOOK_ACADEMIC T
            CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
            CROSS APPLY OPENJSON(JSON_QUERY(C.value, '$.BOOK_DETAILS'))
                WITH (ID INT '$.ID') B
            WHERE T.SCHOOL_ID = ${SCHOOL_ID}
              AND T.IS_ACTIVE = 1
        ),
        StudentClassMap AS (
            SELECT DISTINCT
                U.ID AS USER_ID,
                CB.CLASS_NAME
            FROM MST_USERS U
            CROSS APPLY STRING_SPLIT(CAST(U.MAPPED_BOOKS AS NVARCHAR(MAX)), ',') S
            JOIN ClassBooks CB
                ON CAST(S.value AS INT) = CB.BOOK_ID
            WHERE U.USER_TYPE = 'STUDENT'
              AND U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.IS_ACTIVE = 1
        ),
        ActiveStudents AS (
            SELECT DISTINCT
                A.USER_ID
            FROM USER_ACTIVITY_LOGS A
            JOIN MST_USERS U ON U.ID = A.USER_ID
            WHERE U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.USER_TYPE = 'STUDENT'
              AND A.ACTIVITY_TYPE IN (
                  'READ EBOOK',
                  'Teaching Guide Videos',
                  'CBT Videos',
                  'Practical Templates',
                  'Softwares'
              )
              AND A.CREATED_AT >= ${FROM_DATE}
              AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
        )
        SELECT
            C.CLASS_NAME,
            COUNT(DISTINCT SCM.USER_ID) AS TOTAL_STUDENTS,
            COUNT(DISTINCT ASU.USER_ID) AS ACTIVE_STUDENTS,
            CAST(
                ISNULL(
                    COUNT(DISTINCT ASU.USER_ID) * 100.0 /
                    NULLIF(COUNT(DISTINCT SCM.USER_ID), 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS ADOPTION_PERCENTAGE
        FROM Classes C
        LEFT JOIN StudentClassMap SCM
            ON SCM.CLASS_NAME = C.CLASS_NAME
        LEFT JOIN ActiveStudents ASU
            ON ASU.USER_ID = SCM.USER_ID
        GROUP BY C.CLASS_NAME
        ORDER BY C.CLASS_NAME;
        `;

        return res.json({
            status: 1,

            /* ===== CONTENT USAGE ===== */
            summary: {
                totalViews: contentValues.reduce((a, b) => a + b, 0)
            },
            contentUsage: contentTypes.map(type => ({
                LABEL: type,
                VALUE: usageMap[type] || 0
            })),
            contentBarChart: {
                labels: contentTypes,
                datasets: [
                    {
                        label: "Content Usage",
                        data: contentValues
                    }
                ]
            },

            /* ===== CLASS ADOPTION ===== */
            classUsage: classResult.recordset,
            classBarChart: {
                labels: classResult.recordset.map(r => r.CLASS_NAME),
                datasets: [
                    {
                        label: "Class Adoption %",
                        data: classResult.recordset.map(r => r.ADOPTION_PERCENTAGE),
                        backgroundColor: "#6366f1"
                    }
                ]
            }
        });

    } catch (err) {
        console.error("Content Usage Summary error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching content usage summary",
            error: err.message
        });
    }
};

const studentLearningDepthReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.status(400).json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        const result = await sql.query`
        WITH StudentActivity AS (
            SELECT
                U.ID AS USER_ID,
                U.FIRST_NAME,
                U.LAST_NAME,
                U.USERNAME,
                U.MOBILE,

                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'READ EBOOK' THEN 1 END) AS EBOOK_READS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'CBT Videos' THEN 1 END) AS CBT_VIDEOS,
                COUNT(CASE WHEN A.ACTIVITY_TYPE = 'Teaching Guide Videos' THEN 1 END) AS TEACHING_GUIDES,
                COUNT(DISTINCT CAST(A.CREATED_AT AS DATE)) AS ACTIVE_DAYS

            FROM MST_USERS U
            LEFT JOIN USER_ACTIVITY_LOGS A
                ON A.USER_ID = U.ID
               AND A.CREATED_AT >= ${FROM_DATE}
               AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})

            WHERE U.SCHOOL_ID = ${SCHOOL_ID}
              AND U.USER_TYPE = 'STUDENT'

            GROUP BY
                U.ID, U.FIRST_NAME, U.LAST_NAME, U.USERNAME, U.MOBILE
        ),
        ScoredData AS (
            SELECT *,
                (EBOOK_READS * 2) +
                (CBT_VIDEOS * 3) +
                (TEACHING_GUIDES * 2) +
                (ACTIVE_DAYS * 1) AS DEPTH_SCORE
            FROM StudentActivity
        ),
        MaxScore AS (
            SELECT MAX(DEPTH_SCORE) AS MAX_SCORE FROM ScoredData
        )
        SELECT
            S.USER_ID,
            S.FIRST_NAME,
            S.LAST_NAME,
            S.USERNAME,
            S.MOBILE,
            S.EBOOK_READS,
            S.CBT_VIDEOS,
            S.TEACHING_GUIDES,
            S.ACTIVE_DAYS,
            S.DEPTH_SCORE,

            CAST(
                ISNULL(
                    S.DEPTH_SCORE * 100.0 /
                    NULLIF(M.MAX_SCORE, 0),
                    0
                ) AS DECIMAL(5,2)
            ) AS DEPTH_PERCENTAGE,

            CASE
                WHEN S.DEPTH_SCORE >= (M.MAX_SCORE * 0.7) THEN 'High'
                WHEN S.DEPTH_SCORE >= (M.MAX_SCORE * 0.4) THEN 'Medium'
                ELSE 'Low'
            END AS DEPTH_LEVEL

        FROM ScoredData S
        CROSS JOIN MaxScore M
        ORDER BY DEPTH_PERCENTAGE DESC;
        `;

        return res.json({
            status: 1,
            summary: {
                totalStudents: result.recordset.length,
                highDepth: result.recordset.filter(r => r.DEPTH_LEVEL === 'High').length,
                mediumDepth: result.recordset.filter(r => r.DEPTH_LEVEL === 'Medium').length,
                lowDepth: result.recordset.filter(r => r.DEPTH_LEVEL === 'Low').length
            },
            data: result.recordset
        });

    } catch (err) {
        console.error("Student Learning Depth error:", err);
        return res.status(500).json({
            status: 0,
            message: "Error fetching student learning depth report",
            error: err.message
        });
    }
};

const engagementTrends = async (req, res) => {
    try {
        const { FROM_DATE, TO_DATE, SCHOOL_ID } = req.body;

        // ✅ Validation
        if (!FROM_DATE || !TO_DATE || !SCHOOL_ID) {
            return res.json({
                status: 0,
                message: "FROM_DATE, TO_DATE and SCHOOL_ID are required"
            });
        }

        const result = await sql.query`
      SELECT
        CAST(A.CREATED_AT AS DATE) AS label,

        -- Active users (who logged in)
        COUNT(DISTINCT CASE 
          WHEN A.ACTIVITY_TYPE = 'LOGIN' 
          THEN A.USER_ID 
        END) AS active_users,

        -- Total login count
        COUNT(CASE 
          WHEN A.ACTIVITY_TYPE = 'LOGIN' 
          THEN 1 
        END) AS logins,

        -- Content usage count
        COUNT(CASE 
          WHEN A.ACTIVITY_TYPE <> 'LOGIN' 
          THEN 1 
        END) AS content_views,

        -- Avg learning actions per active user
        CAST(
          ISNULL(
            COUNT(CASE WHEN A.ACTIVITY_TYPE <> 'LOGIN' THEN 1 END) * 1.0 /
            NULLIF(COUNT(DISTINCT CASE WHEN A.ACTIVITY_TYPE = 'LOGIN' THEN A.USER_ID END), 0),
            0
          ) AS DECIMAL(10,2)
        ) AS avg_actions_per_user

      FROM USER_ACTIVITY_LOGS A
      WHERE
        A.SCHOOL_ID = ${SCHOOL_ID}
        AND A.CREATED_AT >= ${FROM_DATE}
        AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})

      GROUP BY CAST(A.CREATED_AT AS DATE)
      ORDER BY label
    `;

        return res.json({
            status: 1,
            data: result.recordset || []
        });

    } catch (error) {
        console.error("Engagement Trends Error:", error);
        return res.json({
            status: 0,
            message: "Error fetching engagement trends",
            error: error.message
        });
    }
};

const loginFrequencyReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        const result = await sql.query`
      SELECT
        CAST(A.CREATED_AT AS DATE) AS login_date,
        COUNT(*) AS total_logins,
        COUNT(DISTINCT A.USER_ID) AS unique_users
      FROM USER_ACTIVITY_LOGS A
      WHERE
        A.SCHOOL_ID = ${SCHOOL_ID}
        AND A.ACTIVITY_TYPE = 'LOGIN'
        AND A.CREATED_AT >= ${FROM_DATE}
        AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
      GROUP BY CAST(A.CREATED_AT AS DATE)
      ORDER BY login_date
    `;

        return res.json({
            status: 1,
            data: result.recordset || []
        });

    } catch (error) {
        console.error("Login Frequency Report Error:", error);
        return res.json({
            status: 0,
            message: "Error fetching login frequency report",
            error: error.message
        });
    }
};

const schoolPerformanceReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        /* ================================
           1️⃣ TOTAL & ACTIVE STUDENTS
        ================================= */
        const studentStats = await sql.query`
      SELECT
        COUNT(DISTINCT U.ID) AS totalStudents,
        COUNT(DISTINCT A.USER_ID) AS activeStudents
      FROM MST_USERS U
      LEFT JOIN USER_ACTIVITY_LOGS A
        ON A.USER_ID = U.ID
        AND A.ACTIVITY_TYPE <> 'LOGIN'
        AND A.CREATED_AT >= ${FROM_DATE}
        AND A.CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
      WHERE
        U.SCHOOL_ID = ${SCHOOL_ID}
        AND U.USER_TYPE = 'STUDENT'
        AND U.IS_ACTIVE = 1
    `;

        const totalStudents = studentStats.recordset[0].totalStudents || 0;
        const activeStudents = studentStats.recordset[0].activeStudents || 0;

        /* ================================
           2️⃣ LOGIN METRICS
        ================================= */
        const loginStats = await sql.query`
      SELECT
        COUNT(*) AS totalLogins
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND ACTIVITY_TYPE = 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
    `;

        const totalLogins = loginStats.recordset[0].totalLogins || 0;

        /* ================================
           3️⃣ CONTENT USAGE SPLIT
        ================================= */
        const contentUsage = await sql.query`
      SELECT
        ACTIVITY_TYPE AS label,
        COUNT(*) AS value
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND ACTIVITY_TYPE <> 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
      GROUP BY ACTIVITY_TYPE
    `;

        /* ================================
           4️⃣ DAILY ENGAGEMENT TREND
        ================================= */
        const dailyTrend = await sql.query`
      SELECT
        CAST(CREATED_AT AS DATE) AS date,
        COUNT(DISTINCT USER_ID) AS activeUsers,
        COUNT(*) AS logins
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND ACTIVITY_TYPE = 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
      GROUP BY CAST(CREATED_AT AS DATE)
      ORDER BY date
    `;

        /* ================================
           FINAL RESPONSE
        ================================= */
        return res.json({
            status: 1,
            schoolPerformance: {
                totalStudents,
                activeStudents,
                adoptionPercentage: totalStudents
                    ? ((activeStudents * 100) / totalStudents).toFixed(2)
                    : 0,
                totalLogins,
                avgLoginsPerStudent: activeStudents
                    ? (totalLogins / activeStudents).toFixed(2)
                    : 0
            },
            contentUsage: contentUsage.recordset || [],
            dailyTrend: dailyTrend.recordset || []
        });

    } catch (error) {
        console.error("School Performance Error:", error);
        return res.json({
            status: 0,
            message: "Error fetching school performance report",
            error: error.message
        });
    }
};

const licenseUtilizationReport = async (req, res) => {
    try {
        const { SCHOOL_ID, FROM_DATE, TO_DATE } = req.body;

        if (!SCHOOL_ID || !FROM_DATE || !TO_DATE) {
            return res.json({
                status: 0,
                message: "SCHOOL_ID, FROM_DATE, TO_DATE are required"
            });
        }

        /* =====================================
           1️⃣ TOTAL LICENSES (Student Accounts)
           👉 Replace this if license table exists
        ====================================== */
        const totalLicensesResult = await sql.query`
      SELECT COUNT(*) AS totalLicenses
      FROM MST_USERS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND IS_ACTIVE = 1
    `;

        const totalLicenses =
            totalLicensesResult.recordset[0].totalLicenses || 0;

        /* =====================================
           2️⃣ USED LICENSES (Login at least once)
        ====================================== */
        const usedLicensesResult = await sql.query`
      SELECT COUNT(DISTINCT USER_ID) AS usedLicenses
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND ACTIVITY_TYPE = 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
    `;

        const usedLicenses =
            usedLicensesResult.recordset[0].usedLicenses || 0;

        /* =====================================
           3️⃣ ACTIVE LEARNING STUDENTS
        ====================================== */
        const activeStudentsResult = await sql.query`
      SELECT COUNT(DISTINCT USER_ID) AS activeStudents
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND ACTIVITY_TYPE <> 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
    `;

        const activeStudents =
            activeStudentsResult.recordset[0].activeStudents || 0;

        /* =====================================
           4️⃣ TOTAL LOGINS
        ====================================== */
        const loginCountResult = await sql.query`
      SELECT COUNT(*) AS totalLogins
      FROM USER_ACTIVITY_LOGS
      WHERE
        SCHOOL_ID = ${SCHOOL_ID}
        AND USER_TYPE = 'STUDENT'
        AND ACTIVITY_TYPE = 'LOGIN'
        AND CREATED_AT >= ${FROM_DATE}
        AND CREATED_AT < DATEADD(DAY, 1, ${TO_DATE})
    `;

        const totalLogins =
            loginCountResult.recordset[0].totalLogins || 0;

        /* =====================================
           FINAL RESPONSE
        ====================================== */
        return res.json({
            status: 1,
            licenseSummary: {
                totalLicenses,
                usedLicenses,
                unusedLicenses: totalLicenses - usedLicenses,
                utilizationPercentage: totalLicenses
                    ? ((usedLicenses * 100) / totalLicenses).toFixed(2)
                    : 0
            },
            activity: {
                activeStudents,
                totalLogins
            }
        });

    } catch (error) {
        console.error("License Utilization Error:", error);
        return res.json({
            status: 0,
            message: "Error fetching license utilization report",
            error: error.message
        });
    }
};

module.exports = {
    userListBySchool,
    studentEngagement,
    teacherEngagement,
    contentUsage,
    ebookUsage,
    cbtUsage,
    teachingGuideUsage,
    classWiseLmsUsage,
    lowEngagementStudents,
    loginHistoryReport,
    contentAccessLog,
    schoolAdoptionReport,
    classAdoptionReport,
    contentUsageSummary,
    studentLearningDepthReport,
    engagementTrends,
    loginFrequencyReport,
    schoolPerformanceReport,
    licenseUtilizationReport
};
