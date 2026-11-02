-- ====================================================================
-- EXOCROSS LMS — SUPABASE POSTGRESQL PRODUCTION SCHEMA
-- ====================================================================
-- Run this entire script in Supabase: Dashboard -> SQL Editor -> New Query -> Run
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email_id VARCHAR(255) UNIQUE,
    mobile_no VARCHAR(50) UNIQUE,
    roll_no VARCHAR(50) UNIQUE,
    user_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT', -- 'ADMIN', 'TUTOR', 'STUDENT'
    password VARCHAR(255) NOT NULL,
    is_active INT NOT NULL DEFAULT 1,
    is_password_changed BOOLEAN NOT NULL DEFAULT FALSE,
    is_certificate INT NOT NULL DEFAULT 0,
    school_id INT DEFAULT 1,
    profile_image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email_id);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_no);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type);

-- 2. BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    batch_name VARCHAR(255) NOT NULL,
    course_id INT,
    start_date DATE,
    end_date DATE,
    is_active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TUTOR ALLOCATIONS (Role 1: HOST, Role 2: SUPPORT)
CREATE TABLE IF NOT EXISTS tutor_allocations (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    tutor_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{"tutorId": 12, "role": 1}]
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES users(user_id)
);

-- 4. STUDENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS student_allocations (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    is_active INT NOT NULL DEFAULT 1,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_batch UNIQUE (student_id, batch_id)
);

-- 5. CLASS SCHEDULES
CREATE TABLE IF NOT EXISTS class_schedules (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    class_time TIME NOT NULL,
    topic VARCHAR(255),
    meet_link TEXT,
    meet_code VARCHAR(100),
    is_active INT NOT NULL DEFAULT 1,
    created_by INT REFERENCES users(user_id),
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. CLASS ATTENDANCE
CREATE TABLE IF NOT EXISTS class_attendance (
    id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES class_schedules(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- 'PRESENT', 'ABSENT', 'LATE'
    attendance_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    marked_by INT REFERENCES users(user_id),
    CONSTRAINT uq_attendance_student_schedule UNIQUE (student_id, schedule_id)
);

-- 7. MODULES TABLE
CREATE TABLE IF NOT EXISTS modules (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(255) NOT NULL,
    module_code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. COURSE MATERIALS TABLE
CREATE TABLE IF NOT EXISTS course_materials (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    module_id INT REFERENCES modules(id),
    is_active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. COURSE MATERIAL BATCH MAPPINGS
CREATE TABLE IF NOT EXISTS course_material_batches (
    id SERIAL PRIMARY KEY,
    course_material_id INT NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_material_batch UNIQUE (course_material_id, batch_id)
);

-- 10. QUESTION BANK
CREATE TABLE IF NOT EXISTS question_bank (
    id SERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'MCQ', -- 'MCQ', 'MATCHING', 'SUBJECTIVE'
    options JSONB DEFAULT '[]'::jsonb,
    correct_answer TEXT,
    marks INT DEFAULT 1,
    module_code VARCHAR(50),
    difficulty_level VARCHAR(50) DEFAULT 'MEDIUM',
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. QUESTION TEMPLATES & SETS
CREATE TABLE IF NOT EXISTS question_templates (
    id SERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    set_type VARCHAR(50) NOT NULL DEFAULT 'ASSESSMENT',
    difficulty_level VARCHAR(50),
    question_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. PROJECT KITS
CREATE TABLE IF NOT EXISTS project_kits (
    id SERIAL PRIMARY KEY,
    kit_name VARCHAR(255) NOT NULL,
    description TEXT,
    assets JSONB DEFAULT '[]'::jsonb,
    is_active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. STUDENT ASSESSMENT & PROJECT SUBMISSIONS
CREATE TABLE IF NOT EXISTS student_assessment_submissions (
    id SERIAL PRIMARY KEY,
    assessment_id INT NOT NULL,
    student_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    image_1 TEXT,
    video_1 TEXT,
    given_marks NUMERIC(5,2),
    comment TEXT,
    given_by INT REFERENCES users(user_id),
    reviewed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. ASSESSMENT EXAM EVALUATIONS
CREATE TABLE IF NOT EXISTS assesment_exam (
    id SERIAL PRIMARY KEY,
    exam_name VARCHAR(255),
    batch_id INT REFERENCES batches(id),
    project_kit_mark NUMERIC(5,2),
    project_kit_comment TEXT,
    project_kit_evaluated_by INT REFERENCES users(user_id),
    project_kit_reviewed_date TIMESTAMP WITH TIME ZONE,
    is_project_kit_evaluated BOOLEAN NOT NULL DEFAULT FALSE
);

-- 15. FINAL ASSESSMENTS (REPORT CARD SCORES)
CREATE TABLE IF NOT EXISTS final_assessments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    theory_marks NUMERIC(5,2) DEFAULT 0,
    practical_marks NUMERIC(5,2) DEFAULT 0,
    total_marks NUMERIC(5,2) DEFAULT 0,
    grade VARCHAR(10),
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_final_assessment_student_batch UNIQUE (student_id, batch_id)
);

-- 16. SESSION REVIEWS (TUTOR TO STUDENT FEEDBACK)
CREATE TABLE IF NOT EXISTS session_reviews (
    id SERIAL PRIMARY KEY,
    tutor_id INT NOT NULL REFERENCES users(user_id),
    batch_id INT NOT NULL REFERENCES batches(id),
    student_id INT NOT NULL REFERENCES users(user_id),
    feedback TEXT NOT NULL,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_reviews UNIQUE (student_id, tutor_id, batch_id)
);

-- 17. CHAT ROOMS
CREATE TABLE IF NOT EXISTS chat_rooms (
    room_id SERIAL PRIMARY KEY,
    batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
    room_name VARCHAR(255) NOT NULL,
    created_by INT REFERENCES users(user_id),
    is_active INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. CHAT ROOM MEMBERS
CREATE TABLE IF NOT EXISTS chat_room_members (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

-- 19. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
    message_id SERIAL PRIMARY KEY,
    room_id INT NOT NULL REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_text TEXT,
    message_type VARCHAR(50) DEFAULT 'TEXT',
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. USER ACTIVITY LOGS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    user_type VARCHAR(50),
    school_id INT,
    book_id INT,
    activity_type VARCHAR(100),
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 22. BATCH ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS batch_announcements (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_by INT REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. ASSIGNMENT ALERTS
CREATE TABLE IF NOT EXISTS assignment_alerts (
    id SERIAL PRIMARY KEY,
    batch_id INT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_kit_id INT REFERENCES project_kits(id),
    assessment_type VARCHAR(50),
    due_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- SEED DATA: DEFAULT EXOCROSS LMS USERS (ADMIN, TUTOR, STUDENT)
-- ====================================================================
INSERT INTO users (username, email_id, mobile_no, roll_no, user_type, password, is_active)
VALUES
    ('isravel', 'isravel@gmail.com', '8124412345', NULL, 'ADMIN', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1),
    ('rajesh', 'rajesh@gmail.com', '6789543210', NULL, 'ADMIN', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1),
    ('israel210904', 'israel210904@gmail.com', '8124473373', NULL, 'TUTOR', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1),
    ('logan', 'logan@gmail.com', '8124412346', NULL, 'TUTOR', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1),
    ('arunk', 'arun.kumar01@gmail.com', '9876543210', '01-EXO-26', 'STUDENT', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1),
    ('divyas', 'divya.selvi02@gmail.com', '9123456780', '02-EXO-26', 'STUDENT', '$2b$10$w1qVn9E3YQzNfZ/6N3rBgeuH.8fK2kG4L4XvP0bQjE0G.8O4.t0Gy', 1)
ON CONFLICT (email_id) DO NOTHING;

-- SEED BATCH
INSERT INTO batches (id, batch_name, start_date, end_date, is_active)
VALUES (1, 'Exocross Aerospace Batch Alpha', CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days', 1)
ON CONFLICT (id) DO NOTHING;
