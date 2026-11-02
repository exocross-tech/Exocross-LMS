const { sql } = require("../../config/database");
const bcrypt = require("bcrypt");

const bulkInsertUsers = async (req, res) => {
    const userData = req.body;
    const users = Array.isArray(userData) ? userData : (userData.data || []);

    if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ status: 0, message: "Invalid data format. Expected a non-empty array of objects." });
    }

    const existingData = [];
    const insertedCount = 0;

    try {
        let count = 0;
        for (const user of users) {
            const {
                SCHOOL_ID,
                FIRST_NAME,
                LAST_NAME,
                USER_NAME,
                PASSWORD,
                MOBILE,
                EMAIL,
                USER_TYPE,
                MAPPED_BOOKS,
                IS_ACTIVE,
                LAST_LOGIN
            } = user;

            const checkQuery = await sql.query`
                SELECT ID FROM MST_USERS 
                WHERE (MOBILE = ${MOBILE} AND MOBILE != '' AND MOBILE IS NOT NULL) 
                   OR (EMAIL = ${EMAIL} AND EMAIL != '' AND EMAIL IS NOT NULL)
            `;

            if (checkQuery.recordset.length > 0) {
                existingData.push(user);
                continue;
            }

            const hashedPassword = await bcrypt.hash(PASSWORD || "123456", 10);
            const finalUsername = USER_NAME;
            const finalUserType = USER_TYPE || "STUDENT";
            const finalIsActive = IS_ACTIVE !== undefined ? IS_ACTIVE : 1;
            const finalLastLogin = LAST_LOGIN || null;

            await sql.query`
                INSERT INTO MST_USERS (
                    SCHOOL_ID,
                    FIRST_NAME,
                    LAST_NAME,
                    USERNAME,
                    PASSWORD_HASH,
                    MOBILE,
                    EMAIL,
                    USER_TYPE,
                    MAPPED_BOOKS,
                    IS_ACTIVE,
                    CREATED_AT,
                    LAST_LOGIN
                ) VALUES (
                    ${SCHOOL_ID},
                    ${FIRST_NAME},
                    ${LAST_NAME},
                    ${finalUsername},
                    ${hashedPassword},
                    ${MOBILE},
                    ${EMAIL},
                    ${finalUserType},
                    ${MAPPED_BOOKS},
                    ${finalIsActive},
                    GETDATE(),
                    ${finalLastLogin}
                )
            `;
            count++;
        }
        if (count === 0) {
            return res.status(200).json({
                status: 2,
                message: "Duplicate data cannot insert",
                existingData
            });
        }
        res.status(200).json({
            status: 1,
            message: `${count} users inserted successfully.`,
            existingData: existingData
        });

    } catch (err) {
        console.error("Bulk insert error:", err);
        res.status(500).json({ status: 0, message: "Internal server error", error: err.message });
    }
};

const getUsers = async (req, res) => {
    try {
        const { schoolId } = req.query;

        let query = `
            SELECT 
                U.*,
                S.SCHOOL_NAME,
                S.ADDRESS
            FROM MST_USERS U
            LEFT JOIN MST_SCHOOLS_LMS S
                ON U.SCHOOL_ID = S.ID
            WHERE U.USER_TYPE IN ('STUDENT', 'TEACHER')
        `;

        const request = new sql.Request();

        if (schoolId) {
            query += ` AND U.SCHOOL_ID = @schoolId`;
            request.input("schoolId", sql.Int, parseInt(schoolId, 10));
        }

        const result = await request.query(query);

        res.status(200).json({
            status: 1,
            data: result.recordset
        });

    } catch (err) {
        console.error("Get users error:", err);
        res.status(500).json({
            status: 0,
            message: "Internal server error",
            error: err.message
        });
    }
};
/**
 * Update User in MST_USERS
 */
const updateUser = async (req, res) => {
    const id = req.params.id;
    const {
        SCHOOL_ID,
        FIRST_NAME,
        LAST_NAME,
        USERNAME,
        PASSWORD,
        MOBILE,
        EMAIL,
        USER_TYPE,
        MAPPED_BOOKS,
        IS_ACTIVE,
        USER_ID
    } = req.body;

    try {
        // 1. Check if user exists
        const checkUser = await sql.query`SELECT * FROM MST_USERS WHERE ID = ${id}`;
        if (checkUser.recordset.length === 0) {
            return res.status(200).json({ status: 0, message: "User not found" });
        }
        const oldRecord = checkUser.recordset[0];

        // 2. Check for duplicate MOBILE or EMAIL
        const checkDuplicate = await sql.query`
            SELECT ID FROM MST_USERS 
            WHERE ((MOBILE = ${MOBILE} AND MOBILE != '' AND MOBILE IS NOT NULL) 
               OR (EMAIL = ${EMAIL} AND EMAIL != '' AND EMAIL IS NOT NULL))
               AND ID != ${id}
        `;
        if (checkDuplicate.recordset.length > 0) {
            return res.status(200).json({ status: 0, message: "Mobile or Email already exists for another user" });
        }

        // 3. Prepare fields for update and logging
        const fields = {
            SCHOOL_ID,
            FIRST_NAME,
            LAST_NAME,
            USERNAME,
            MOBILE,
            EMAIL,
            USER_TYPE,
            MAPPED_BOOKS,
            IS_ACTIVE
        };

        const oldValues = {};
        const newValues = {};

        for (let field in fields) {
            if (fields[field] !== undefined) {
                let oldValue = oldRecord[field];
                let newValue = fields[field];
                oldValue = oldValue != null ? String(oldValue) : null;
                newValue = newValue != null ? String(newValue) : null;

                if (oldValue !== newValue) {
                    oldValues[field] = oldValue;
                    newValues[field] = newValue;
                }
            }
        }

        // 4. Log changes if any
        if (Object.keys(oldValues).length > 0) {
            await sql.query`
                INSERT INTO update_logs (TABLE_NAME, OLD_VALUE, NEW_VALUE, UPDATED_BY, UPDATED_ON)
                VALUES (
                    'MST_USERS',
                    ${JSON.stringify(oldValues)},
                    ${JSON.stringify(newValues)},
                    ${USER_ID || 0},
                    GETDATE()
                )
            `;
        }

        // 5. Update password if provided
        let finalPasswordHash = oldRecord.PASSWORD_HASH;
        if (PASSWORD) {
            finalPasswordHash = await bcrypt.hash(PASSWORD, 10);
        }

        // 6. Execute update
        await sql.query`
            UPDATE MST_USERS SET
                SCHOOL_ID = ${SCHOOL_ID || oldRecord.SCHOOL_ID},
                FIRST_NAME = ${FIRST_NAME || oldRecord.FIRST_NAME},
                LAST_NAME = ${LAST_NAME || oldRecord.LAST_NAME},
                USERNAME = ${USERNAME || oldRecord.USERNAME},
                MOBILE = ${MOBILE || oldRecord.MOBILE},
                EMAIL = ${EMAIL || oldRecord.EMAIL},
                USER_TYPE = ${USER_TYPE || oldRecord.USER_TYPE},
                MAPPED_BOOKS = ${MAPPED_BOOKS},
                IS_ACTIVE = ${IS_ACTIVE !== undefined ? IS_ACTIVE : oldRecord.IS_ACTIVE},
                PASSWORD_HASH = ${finalPasswordHash}
            WHERE ID = ${id}
        `;

        res.status(200).json({ status: 1, message: "User updated successfully" });

    } catch (err) {
        console.error("Update user error:", err);
        res.status(500).json({ status: 0, message: "Internal server error", error: err.message });
    }
};

const deleteUsers = async (req, res) => {
    const { ids, userId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
            status: 0,
            message: "User IDs are required"
        });
    }

    try {
        // 1️⃣ Get users before delete
        const usersResult = await sql.query`
      SELECT * FROM MST_USERS WHERE ID IN (${ids})
    `;

        if (usersResult.recordset.length === 0) {
            return res.status(200).json({
                status: 0,
                message: "No users found"
            });
        }

        // 2️⃣ Insert delete logs
        for (const user of usersResult.recordset) {
            await sql.query`
        INSERT INTO DELETE_LOGS
          (TABLE_NAME, DELETED_DATA, DELETED_BY, DELETED_ON)
        VALUES
          ('MST_USERS', ${JSON.stringify(user)}, ${userId || "System"}, GETDATE())
      `;
        }

        // 3️⃣ Delete users
        await sql.query`
      DELETE FROM MST_USERS WHERE ID IN (${ids})
    `;

        res.status(200).json({
            status: 1,
            message: `${usersResult.recordset.length} users deleted successfully`
        });

    } catch (err) {
        console.error("Bulk delete error:", err);
        res.status(500).json({
            status: 0,
            message: "Internal server error",
            error: err.message
        });
    }
};

const updateSingleUser = async (req, res) => {
    const id = req.params.id;
    const {
        FIRST_NAME,
        LAST_NAME,
        USERNAME,
        USER_ID
    } = req.body;

    try {
        // 1. Check user exists
        const checkUser = await sql.query`
            SELECT * FROM MST_USERS WHERE ID = ${id}
        `;

        if (checkUser.recordset.length === 0) {
            return res.status(200).json({
                status: 0,
                message: "User not found"
            });
        }

        const oldRecord = checkUser.recordset[0];

        // 3. Change tracking
        const fields = {
            FIRST_NAME,
            LAST_NAME,
            USERNAME
        };

        const oldValues = {};
        const newValues = {};

        for (const field in fields) {
            if (fields[field] !== undefined) {
                const oldVal = oldRecord[field] != null ? String(oldRecord[field]) : null;
                const newVal = fields[field] != null ? String(fields[field]) : null;

                if (oldVal !== newVal) {
                    oldValues[field] = oldVal;
                    newValues[field] = newVal;
                }
            }
        }

        if (Object.keys(oldValues).length > 0) {
            await sql.query`
                INSERT INTO update_logs (
                    TABLE_NAME,
                    OLD_VALUE,
                    NEW_VALUE,
                    UPDATED_BY,
                    UPDATED_ON
                )
                VALUES (
                    'MST_USERS',
                    ${JSON.stringify(oldValues)},
                    ${JSON.stringify(newValues)},
                    ${USER_ID || 0},
                    GETDATE()
                )
            `;
        }

        await sql.query`
            UPDATE MST_USERS SET
                FIRST_NAME = ${FIRST_NAME !== undefined ? FIRST_NAME : oldRecord.FIRST_NAME},
                LAST_NAME = ${LAST_NAME !== undefined ? LAST_NAME : oldRecord.LAST_NAME},
                USERNAME = ${USERNAME !== undefined ? USERNAME : oldRecord.USERNAME}
            WHERE ID = ${id}
        `;

        res.status(200).json({
            status: 1,
            message: "User updated successfully"
        });

    } catch (err) {
        console.error("Update user error:", err);
        res.status(500).json({
            status: 0,
            message: "Internal server error",
            error: err.message
        });
    }
};

module.exports = {
    bulkInsertUsers,
    getUsers,
    updateUser,
    deleteUsers,
    updateSingleUser
};
