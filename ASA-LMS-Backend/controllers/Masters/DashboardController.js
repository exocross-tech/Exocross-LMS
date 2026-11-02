const { sql } = require("../../config/database");

const getDashboardData = async (req, res) => {
    try {
        const USER_TYPE = req.body.USER_TYPE || req.query.USER_TYPE;

        if (USER_TYPE === 'TECHNO') {
            const result = await sql.query`
SELECT 
    /* ================= SCHOOLS ================= */
    (SELECT COUNT(*) FROM MST_SCHOOLS_LMS) AS TotalSchools,
    (SELECT COUNT(*) FROM MST_SCHOOLS_LMS WHERE IS_ACTIVE = 'True') AS ActiveSchools,
    (SELECT COUNT(*) FROM MST_SCHOOLS_LMS WHERE IS_ACTIVE = 'False') AS InactiveSchools,

    (SELECT COUNT(*) 
     FROM MST_SCHOOLS_LMS
     WHERE CREATED_ON >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
       AND CREATED_ON < DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()) + 1, 0)
    ) AS ThisMonthOnboardSchools,

    /* ================= STUDENTS ================= */
    (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'STUDENT') AS TotalStudents,

    (SELECT COUNT(DISTINCT u.ID)
     FROM MST_USERS u
     JOIN USER_ACTIVITY_LOGS a ON a.USER_ID = u.ID
     WHERE u.USER_TYPE = 'STUDENT'
       AND a.ACTIVITY_DATE >= CAST(GETDATE() AS DATE)
       AND a.ACTIVITY_DATE < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) AS EngagedStudents,

    /* ================= TEACHERS ================= */
    (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'TEACHER') AS TotalTeachers,

    (SELECT COUNT(DISTINCT u.ID)
     FROM MST_USERS u
     JOIN USER_ACTIVITY_LOGS a ON a.USER_ID = u.ID
     WHERE u.USER_TYPE = 'TEACHER'
       AND a.ACTIVITY_DATE >= CAST(GETDATE() AS DATE)
       AND a.ACTIVITY_DATE < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) AS EngagedTeachers,

    /* ================= DAILY ACTIVE USERS ================= */
    (SELECT COUNT(DISTINCT USER_ID)
     FROM USER_ACTIVITY_LOGS
     WHERE ACTIVITY_TYPE = 'LOGIN'
       AND ACTIVITY_DATE >= CAST(GETDATE() AS DATE)
       AND ACTIVITY_DATE < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) AS DailyActiveUsers,

    /* ================= LMS ADOPTION RATES ================= */

    /* School Adoption */
    CAST(
    (
        SELECT COUNT(DISTINCT SCHOOL_ID)
        FROM USER_ACTIVITY_LOGS
        WHERE ACTIVITY_TYPE = 'LOGIN'
          AND created_at >= CAST(GETDATE() AS DATE)
          AND created_at < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) * 100.0 /
    NULLIF(
        (SELECT COUNT(*) FROM MST_SCHOOLS_LMS WHERE IS_ACTIVE = 'True'),
        0
    )
AS DECIMAL(5,2)) AS SchoolAdoptionRate,

    /* Student Engagement Rate */
CAST(
    (
        SELECT COUNT(DISTINCT u.ID)
        FROM MST_USERS u
        WHERE u.USER_TYPE = 'STUDENT'
          AND EXISTS (
              SELECT 1
              FROM USER_ACTIVITY_LOGS a
              WHERE a.USER_ID = u.ID
                AND a.ACTIVITY_TYPE IN (
                    'READ EBOOK',
                    'Teaching Guide Videos',
                    'CBT Videos',
                    'Practical Templates',
                    'Softwares'
                )
                AND a.CREATED_AT >= CAST(GETDATE() AS DATE)
                AND a.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
          )
    ) * 100.0 /
    NULLIF(
        (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'STUDENT'),
        0
    )
AS DECIMAL(5,2)) AS StudentEngagementRate,

    /* Teacher Engagement Rate */
  CAST(
    (
        SELECT COUNT(DISTINCT u.ID)
        FROM MST_USERS u
        WHERE u.USER_TYPE = 'TEACHER'
          AND EXISTS (
              SELECT 1
              FROM USER_ACTIVITY_LOGS a
              WHERE a.USER_ID = u.ID
                AND a.ACTIVITY_TYPE IN (
                    'VIEW_CONTENT',
                    'UPLOAD_MATERIAL',
                    'ASSIGN_HOMEWORK',
                    'CREATE_TEST',
                    'GRADE_ASSIGNMENT'
                )
                AND a.CREATED_AT >= CAST(GETDATE() AS DATE)
                AND a.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
          )
    ) * 100.0 /
    NULLIF(
        (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'TEACHER'),
        0
    )
AS DECIMAL(5,2)) AS TeacherEngagementRate
`;

            const schoolActivityResult = await sql.query`
SELECT TOP 15
    S.ID,
    S.SCHOOL_NAME,
    S.ADDRESS,
    S.IS_ACTIVE,

    /* Total Students */
    (
        SELECT COUNT(*)
        FROM MST_USERS U
        WHERE U.SCHOOL_ID = S.ID
          AND U.USER_TYPE = 'STUDENT'
    ) AS TotalStudents,

    /* Active Students */
    (
        SELECT COUNT(*)
        FROM MST_USERS U
        WHERE U.SCHOOL_ID = S.ID
          AND U.USER_TYPE = 'STUDENT'
          AND U.IS_ACTIVE = 'True'
    ) AS ActiveUsers,

    /* Content Usage % */
    ISNULL(
        CAST(
            (
                SELECT COUNT(DISTINCT A.USER_ID)
                FROM USER_ACTIVITY_LOGS A
                INNER JOIN MST_USERS U2 ON U2.ID = A.USER_ID
                WHERE U2.SCHOOL_ID = S.ID
                  AND U2.USER_TYPE = 'STUDENT'
                  AND A.ACTIVITY_TYPE IN (
                      'READ EBOOK',
                      'Teaching Guide Videos',
                      'CBT Videos',
                      'Practical Templates',
                      'Softwares'
                  )
                  AND A.CREATED_AT >= CAST(GETDATE() AS DATE)
                  AND A.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
            ) * 100.0 /
            NULLIF(
                (
                    SELECT COUNT(*)
                    FROM MST_USERS U3
                    WHERE U3.SCHOOL_ID = S.ID
                      AND U3.USER_TYPE = 'STUDENT'
                ),
                0
            )
        AS DECIMAL(5,2)),
    0
    ) AS UsagePercentage,

    /* Last Login (formatted) */
    (
        SELECT TOP 1 
            FORMAT(U4.LAST_LOGIN, 'dd/MM/yyyy hh:mm tt')
        FROM MST_USERS U4
        WHERE U4.SCHOOL_ID = S.ID
          AND U4.USER_TYPE = 'SCHOOL'
        ORDER BY U4.LAST_LOGIN DESC
    ) AS LastLogin

FROM MST_SCHOOLS_LMS S
ORDER BY TotalStudents DESC
`;

            const contentEngagementResult = await sql.query`
SELECT
    SUM(CASE WHEN ACTIVITY_TYPE = 'Teaching Guide Videos' THEN 1 ELSE 0 END) AS TeachingGuideCount,
    SUM(CASE WHEN ACTIVITY_TYPE = 'READ EBOOK' THEN 1 ELSE 0 END) AS EBooksCount,
    SUM(CASE WHEN ACTIVITY_TYPE = 'CBT Videos' THEN 1 ELSE 0 END) AS CBTCount,
    SUM(CASE WHEN ACTIVITY_TYPE IN ('Teaching Guide Videos', 'READ EBOOK', 'CBT Videos') THEN 1 ELSE 0 END) AS TotalCount
FROM USER_ACTIVITY_LOGS
WHERE ACTIVITY_TYPE IN ('Teaching Guide Videos', 'READ EBOOK', 'CBT Videos')
`;

            const eng = contentEngagementResult.recordset[0];
            const total = eng.TotalCount || 1;
            const contentEngagement = {
                labels: ["Teaching Guide", "E-Books", "CBT"],
                data: [
                    parseFloat(((eng.TeachingGuideCount / total) * 100).toFixed(2)),
                    parseFloat(((eng.EBooksCount / total) * 100).toFixed(2)),
                    parseFloat(((eng.CBTCount / total) * 100).toFixed(2))
                ],
                counts: {
                    TeachingGuide: eng.TeachingGuideCount,
                    EBooks: eng.EBooksCount,
                    CBT: eng.CBTCount
                }
            };

            const barChartResult = await sql.query`
SELECT
    /* Students */
    (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'STUDENT') AS TotalStudents,
    (SELECT COUNT(DISTINCT USER_ID)
     FROM USER_ACTIVITY_LOGS
     WHERE USER_TYPE = 'STUDENT'
       AND CREATED_AT >= CAST(GETDATE() AS DATE)
       AND CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) AS ActiveStudents,

    /* Teachers */
    (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'TEACHER') AS TotalTeachers,
    (SELECT COUNT(DISTINCT USER_ID)
     FROM USER_ACTIVITY_LOGS
     WHERE USER_TYPE = 'TEACHER'
       AND CREATED_AT >= CAST(GETDATE() AS DATE)
       AND CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
    ) AS ActiveTeachers
`;

            const bar = barChartResult.recordset[0];
            const userActivityBarChart = {
                labels: ["Students", "Teachers"],
                datasets: [
                    {
                        label: "Active Users",
                        data: [bar.ActiveStudents, bar.ActiveTeachers]
                    },
                    {
                        label: "Total Users",
                        data: [bar.TotalStudents, bar.TotalTeachers]
                    }
                ]
            };

            const trendResult = await sql.query`
SELECT
    CONVERT(VARCHAR(10), CAST(CREATED_AT AS DATE), 105) AS DateLabel,
    COUNT(DISTINCT SCHOOL_ID) AS ActiveSchools,
    COUNT(DISTINCT USER_ID) AS ActiveUsers
FROM USER_ACTIVITY_LOGS
WHERE CREATED_AT >= DATEADD(DAY, -4, CAST(GETDATE() AS DATE))
  AND CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
  AND SCHOOL_ID > 0
GROUP BY CAST(CREATED_AT AS DATE)
ORDER BY CAST(CREATED_AT AS DATE) ASC
`;

            const trendRows = trendResult.recordset;
            const trendChart = {
                labels: trendRows.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "Active Schools",
                        data: trendRows.map(r => r.ActiveSchools)
                    },
                    {
                        label: "Active Users",
                        data: trendRows.map(r => r.ActiveUsers)
                    }
                ]
            };

            res.json({
                status: 1,
                data: result.recordset[0],
                schoolActivity: schoolActivityResult.recordset,
                contentEngagement,
                userActivityBarChart,
                trendChart
            });
        } else if (USER_TYPE === 'SCHOOL') {
            const SCHOOL_ID = req.body.SCHOOL_ID || req.query.SCHOOL_ID;
            if (!SCHOOL_ID) {
                return res.status(400).json({ status: 0, message: "SCHOOL_ID is required for School Dashboard" });
            }

            const schoolResult = await sql.query`
            SELECT 
                /* ================= STUDENTS ================= */
                (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'STUDENT' AND SCHOOL_ID = ${SCHOOL_ID}) AS TotalStudents,
                
                (SELECT COUNT(DISTINCT u.ID)
                 FROM MST_USERS u
                 JOIN USER_ACTIVITY_LOGS a ON a.USER_ID = u.ID
                 WHERE u.USER_TYPE = 'STUDENT'
                   AND u.SCHOOL_ID = ${SCHOOL_ID}
                   AND a.CREATED_AT >= CAST(GETDATE() AS DATE)
                   AND a.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
                ) AS TodayActiveStudents,

                /* ================= TEACHERS ================= */
                (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'TEACHER' AND SCHOOL_ID = ${SCHOOL_ID}) AS TotalTeachers,

                /* Content Usage % */
                ISNULL(
                    CAST(
                        (
                            SELECT COUNT(DISTINCT A.USER_ID)
                            FROM USER_ACTIVITY_LOGS A
                            INNER JOIN MST_USERS U2 ON U2.ID = A.USER_ID
                            WHERE U2.SCHOOL_ID = ${SCHOOL_ID}
                              AND U2.USER_TYPE = 'STUDENT'
                              AND A.ACTIVITY_TYPE IN (
                                  'READ EBOOK',
                                  'Teaching Guide Videos',
                                  'CBT Videos',
                                  'Practical Templates',
                                  'Softwares'
                              )
                              AND A.CREATED_AT >= CAST(GETDATE() AS DATE)
                              AND A.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
                        ) * 100.0 /
                        NULLIF(
                            (
                                SELECT COUNT(*)
                                FROM MST_USERS U3
                                WHERE U3.SCHOOL_ID = ${SCHOOL_ID}
                                  AND U3.USER_TYPE = 'STUDENT'
                            ),
                            0
                        )
                    AS DECIMAL(5,2)),
                0
                ) AS ContentCompletionPercentage
            `;

            let ActiveClassesCount = 0;
            const classesResult = await sql.query`
                SELECT BOOK_DETAILS
                FROM TRN_SCHOOL_BOOK_ACADEMIC
                WHERE SCHOOL_ID = ${SCHOOL_ID}
                  AND IS_ACTIVE = 1
                  AND CAST(GETDATE() AS DATE) BETWEEN ACCESS_START_DATE AND ACCESS_END_DATE
            `;

            if (classesResult.recordset.length > 0 && classesResult.recordset[0].BOOK_DETAILS) {
                try {
                    const bookDetailsArr = JSON.parse(classesResult.recordset[0].BOOK_DETAILS);
                    if (Array.isArray(bookDetailsArr)) {
                        ActiveClassesCount = bookDetailsArr.length;
                    }
                } catch (e) {
                    console.error("Error parsing BOOK_DETAILS JSON:", e);
                }
            }

            const classUsageResult = await sql.query`
                                            WITH ClassBookMap AS (
                                                SELECT
                                                    T.SCHOOL_ID,
                                                    JSON_VALUE(C.value, '$.CLASS_NAME') AS CLASS_NAME,
                                                    B.ID AS BOOK_ID
                                                FROM TRN_SCHOOL_BOOK_ACADEMIC T
                                                CROSS APPLY OPENJSON(T.BOOK_DETAILS) C
                                                CROSS APPLY OPENJSON(JSON_QUERY(C.value, '$.BOOK_DETAILS'))
                                                    WITH (ID INT '$.ID') B
                                                WHERE T.IS_ACTIVE = 1
                                            ),
                                            UserBookMap AS (
                                                SELECT
                                                    U.ID AS USER_ID,
                                                    U.SCHOOL_ID,
                                                    CAST(S.value AS INT) AS BOOK_ID,
                                                    U.LAST_LOGIN
                                                FROM MST_USERS U
                                                CROSS APPLY STRING_SPLIT(CAST(U.MAPPED_BOOKS AS NVARCHAR(MAX)), ',') S
                                                WHERE U.USER_TYPE = 'STUDENT'
                                                AND U.IS_ACTIVE = 1
                                            ),
                                            UserClassMap AS (
                                                SELECT DISTINCT
                                                    U.USER_ID,
                                                    C.CLASS_NAME,
                                                    U.LAST_LOGIN
                                                FROM UserBookMap U
                                                JOIN ClassBookMap C
                                                    ON U.BOOK_ID = C.BOOK_ID
                                                AND U.SCHOOL_ID = C.SCHOOL_ID
                                            )
                                            SELECT
                                                CLASS_NAME,
                                                COUNT(DISTINCT USER_ID) AS TotalStudents,
                                                COUNT(DISTINCT CASE WHEN LAST_LOGIN IS NOT NULL THEN USER_ID END) AS ActiveStudents,
                                                CAST(
                                                    COUNT(DISTINCT CASE WHEN LAST_LOGIN IS NOT NULL THEN USER_ID END) * 100.0
                                                    / NULLIF(COUNT(DISTINCT USER_ID), 0)
                                                    AS DECIMAL(5,2)
                                                ) AS UsagePercentage
                                            FROM UserClassMap
                                            GROUP BY CLASS_NAME
                                            ORDER BY CLASS_NAME;
                                                        `;

            const classRows = classUsageResult.recordset;

            const classUsageChart = {
                labels: classRows.map(r => r.CLASS_NAME),
                data: classRows.map(r => r.UsagePercentage),
                meta: classRows,

            };

            const studentLoginTrendResult = await sql.query`
                SELECT
                    CONVERT(VARCHAR(10), CAST(CREATED_AT AS DATE), 105) AS DateLabel,
                    COUNT(DISTINCT USER_ID) AS Logins
                FROM USER_ACTIVITY_LOGS
                WHERE USER_TYPE = 'STUDENT'
                  AND SCHOOL_ID = ${SCHOOL_ID}
                  AND CREATED_AT >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
                  AND CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
                GROUP BY CAST(CREATED_AT AS DATE)
                ORDER BY CAST(CREATED_AT AS DATE) ASC
            `;

            const loginTrendRows = studentLoginTrendResult.recordset;
            const studentLoginChart = {
                labels: loginTrendRows.map(r => r.DateLabel),
                datasets: [
                    {
                        label: "Logins",
                        data: loginTrendRows.map(r => r.Logins),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59,130,246,0.1)",
                        pointBackgroundColor: "#fff",
                        pointBorderColor: "#3b82f6",
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        tension: 0.4,
                        fill: true,
                    }
                ]
            };

            const subjectResult = await sql.query`
   WITH Subjects AS (
    SELECT 'READ EBOOK' AS SubjectName
    UNION ALL SELECT 'Teaching Guide Videos'
    UNION ALL SELECT 'CBT Videos'
    UNION ALL SELECT 'Practical Templates'
    UNION ALL SELECT 'Softwares'
)
SELECT
    S.SubjectName,
    ISNULL(
        CAST(
            COUNT(DISTINCT A.USER_ID) * 100.0 /
            NULLIF(
                (SELECT COUNT(*) FROM MST_USERS WHERE USER_TYPE = 'STUDENT'),
                0
            )
        AS DECIMAL(5,2)),
    0
    ) AS EngagementPercentage
FROM Subjects S
LEFT JOIN USER_ACTIVITY_LOGS A
    ON A.ACTIVITY_TYPE = S.SubjectName
   AND A.CREATED_AT >= CAST(GETDATE() AS DATE)
   AND A.CREATED_AT < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
LEFT JOIN MST_USERS U
    ON U.ID = A.USER_ID
   AND U.USER_TYPE = 'STUDENT'
GROUP BY S.SubjectName
ORDER BY EngagementPercentage DESC;
`;

            const subjectBarChart = {
                labels: subjectResult.recordset.map(r => r.SubjectName),
                datasets: [
                    {
                        label: "Engagement %",
                        data: subjectResult.recordset.map(r => Number(r.EngagementPercentage)),
                        backgroundColor: "#8b5cf6",
                        borderRadius: 4,
                        barThickness: 30
                    }
                ]
            };

            res.json({
                status: 1,
                data: {
                    ...schoolResult.recordset[0],
                    ActiveClassesCount
                },
                classUsageChart,
                studentLoginChart,
                subjectBarChart
            });
        } else {
            res.json({
                status: 0,
                message: "Dashboard data not available for this user type"
            });
        }
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ status: 0, error: err.message });
    }
};

module.exports = {
    getDashboardData
};
