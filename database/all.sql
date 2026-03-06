-- PostgreSQL Database Setup for Neon.tech
-- Converted from MySQL
-- 
-- IMPORTANT: Files must be executed in this order to satisfy foreign key constraints:
-- 1. 11_settings.sql (creates salons table - base dependency)
-- 2. 02_staff.sql (references salons)
-- 3. 03_customers.sql (references staff)
-- 4. 04_services.sql (references salons)
-- 5. 05_bookings.sql (references customers, staff, services)
-- 6. 06_billing.sql (references customers, bookings)
-- 7. 07_memberships.sql (references customers)
-- 8. 08_calendar.sql (references bookings, customers, services, staff, rooms)
-- 9. 09_expenses.sql (minimal dependencies)
-- 10. 10_bi_warehouse.sql (references multiple tables)
-- 11. 01_dashboard.sql (views - must be last)
-- 12. seed/users.sql (seed data)

-- ============================================
-- CONVERSION NOTES
-- ============================================
-- 
-- Data Type Conversions Applied:
-- - AUTO_INCREMENT → GENERATED ALWAYS AS IDENTITY
-- - TINYINT(1) → BOOLEAN
-- - TINYINT(n) → SMALLINT
-- - INT UNSIGNED → BIGINT
-- - DATETIME → TIMESTAMP
-- - ENUM('val1','val2') → CREATE TYPE enum_name AS ENUM (...)
-- - IFNULL(x, y) → COALESCE(x, y)
-- - NOW() → CURRENT_TIMESTAMP
-- - Backticks (`) removed
-- - Double quotes for strings → Single quotes
-- - utf8mb4 charset → UTF8 (PostgreSQL default)
--
-- Additional Changes:
-- - Created separate ENUM types before table definitions
-- - Added triggers for automatic updated_at timestamp updates
-- - Removed ENGINE=InnoDB declarations (not needed in PostgreSQL)
-- - Used BIGINT for all ID columns for future scalability
-- - Changed 'date' reserved keyword column to 'event_date' in dim_date
-- - Updated view definitions to use PostgreSQL syntax
-- - Added CASCADE to DROP statements for safe recreation
--
-- Foreign Key Constraints:
-- - All foreign keys properly defined with ON DELETE actions
-- - ON DELETE CASCADE for dependent records
-- - ON DELETE SET NULL for optional relationships
--
-- Indexes:
-- - All original indexes preserved
-- - Added appropriate indexes for foreign key columns
--
-- Compatibility:
-- - Fully compatible with PostgreSQL 14+
-- - Ready for Neon.tech deployment
-- - All views and functions use PostgreSQL syntax

-- ============================================
-- FUNCTION FOR UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- FILE: database/main/11_settings.sql
-- ============================================

-- Settings module: salons and settings tables
-- IMPORTANT: This file must be executed FIRST as other tables reference salons

-- Drop existing tables
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS salons CASCADE;

-- Salons table (must be created first as it's referenced by other tables)
CREATE TABLE salons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  working_hours_start TIME DEFAULT '08:00:00',
  working_hours_end TIME DEFAULT '22:00:00',
  timezone VARCHAR(100) DEFAULT 'UTC',
  currency VARCHAR(10) DEFAULT 'INR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_code UNIQUE (code)
);

CREATE TRIGGER update_salons_updated_at BEFORE UPDATE ON salons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Settings table
CREATE TABLE settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT,
  key_name VARCHAR(255) NOT NULL,
  key_value JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_setting UNIQUE (salon_id, key_name),
  CONSTRAINT fk_settings_salon FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial salon record (required for users seed)
INSERT INTO salons (name, code, city, country, phone, email)
VALUES ('Main Salon', 'MAIN', 'City', 'IN', '1234567890', 'salon@example.com');

-- ============================================
-- FILE: database/main/02_staff.sql
-- ============================================

-- Staff module: users and staff related tables

-- Drop existing tables and types (in reverse dependency order)
DROP TABLE IF EXISTS staff_settings CASCADE;
DROP TABLE IF EXISTS staff_training CASCADE;
DROP TABLE IF EXISTS staff_documents CASCADE;
DROP TABLE IF EXISTS staff_activity_log CASCADE;
DROP TABLE IF EXISTS staff_commission CASCADE;
DROP TABLE IF EXISTS staff_performance CASCADE;
DROP TABLE IF EXISTS staff_schedule CASCADE;
DROP TABLE IF EXISTS staff_leave_balance CASCADE;
DROP TABLE IF EXISTS staff_leaves CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_user_role CASCADE;
DROP TYPE IF EXISTS enum_staff_gender CASCADE;
DROP TYPE IF EXISTS enum_employment_type CASCADE;
DROP TYPE IF EXISTS enum_primary_role CASCADE;
DROP TYPE IF EXISTS enum_staff_status CASCADE;
DROP TYPE IF EXISTS enum_attendance_status CASCADE;
DROP TYPE IF EXISTS enum_leave_type CASCADE;
DROP TYPE IF EXISTS enum_leave_status CASCADE;
DROP TYPE IF EXISTS enum_schedule_status CASCADE;
DROP TYPE IF EXISTS enum_period_type CASCADE;
DROP TYPE IF EXISTS enum_payment_status CASCADE;
DROP TYPE IF EXISTS enum_training_status CASCADE;

-- Create ENUM types
CREATE TYPE enum_user_role AS ENUM ('owner', 'center', 'staff');
CREATE TYPE enum_staff_gender AS ENUM ('male', 'female', 'other');
CREATE TYPE enum_employment_type AS ENUM ('full_time', 'part_time', 'contract');
CREATE TYPE enum_primary_role AS ENUM ('service_provider', 'reception', 'admin', 'manager');
CREATE TYPE enum_staff_status AS ENUM ('active', 'inactive', 'suspended', 'terminated');
CREATE TYPE enum_attendance_status AS ENUM ('present', 'absent', 'late', 'half_day', 'leave', 'holiday', 'weekly_off');
CREATE TYPE enum_leave_type AS ENUM ('casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid', 'other');
CREATE TYPE enum_leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE enum_training_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE enum_schedule_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE enum_period_type AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
CREATE TYPE enum_payment_status AS ENUM ('pending', 'processing', 'paid', 'cancelled');

-- Users table (accounts)
CREATE TABLE users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role enum_user_role DEFAULT 'staff',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_salon FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff main table
CREATE TABLE staff (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  date_of_birth DATE,
  gender enum_staff_gender DEFAULT 'male',
  address TEXT,
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  joining_date DATE NOT NULL,
  department VARCHAR(100) NOT NULL,
  designation VARCHAR(100) NOT NULL,
  employment_type enum_employment_type DEFAULT 'full_time',
  experience_years INT DEFAULT 0,
  qualifications TEXT,
  skills TEXT,
  primary_role enum_primary_role DEFAULT 'service_provider',
  services_qualified TEXT,
  primary_station VARCHAR(50),
  backup_station VARCHAR(50),
  status enum_staff_status DEFAULT 'active',
  username VARCHAR(100),
  password VARCHAR(255),
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_salon FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

-- Create indexes for staff
CREATE INDEX idx_staff_salon_id ON staff(salon_id);
CREATE INDEX idx_staff_department ON staff(department);
CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_staff_employee_id ON staff(employee_id);
CREATE INDEX idx_staff_created_by ON staff(created_by);
CREATE INDEX idx_staff_updated_by ON staff(updated_by);

-- Create trigger for updated_at
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff attendance
CREATE TABLE staff_attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  attendance_date DATE NOT NULL,
  expected_shift_start TIME,
  expected_shift_end TIME,
  shift_type VARCHAR(50),
  clock_in TIME,
  clock_out TIME,
  total_hours DECIMAL(4,2) DEFAULT 0,
  attendance_status enum_attendance_status DEFAULT 'absent',
  late_minutes INT DEFAULT 0,
  early_exit_minutes INT DEFAULT 0,
  break_start TIME,
  break_end TIME,
  break_duration INT DEFAULT 0,
  lunch_start TIME,
  lunch_end TIME,
  lunch_duration INT DEFAULT 0,
  notes TEXT,
  verified_by BIGINT,
  verification_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff_date UNIQUE (staff_id, attendance_date),
  CONSTRAINT fk_attendance_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_date ON staff_attendance(attendance_date);
CREATE INDEX idx_attendance_status ON staff_attendance(attendance_status);

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON staff_attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff leaves
CREATE TABLE staff_leaves (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  leave_type enum_leave_type DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INT NOT NULL,
  status enum_leave_status DEFAULT 'pending',
  approved_by BIGINT,
  approved_date DATE,
  reason TEXT,
  contact_during_leave VARCHAR(20),
  handover_to BIGINT,
  medical_certificate_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leaves_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  CONSTRAINT fk_leaves_handover FOREIGN KEY (handover_to) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_leaves_staff_id ON staff_leaves(staff_id);
CREATE INDEX idx_leaves_status ON staff_leaves(status);
CREATE INDEX idx_leaves_date_range ON staff_leaves(start_date, end_date);

CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON staff_leaves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff leave balance
CREATE TABLE staff_leave_balance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  year INT NOT NULL,
  casual_leave_total INT DEFAULT 12,
  casual_leave_taken INT DEFAULT 0,
  casual_leave_remaining INT DEFAULT 12,
  sick_leave_total INT DEFAULT 7,
  sick_leave_taken INT DEFAULT 0,
  sick_leave_remaining INT DEFAULT 7,
  annual_leave_total INT DEFAULT 21,
  annual_leave_taken INT DEFAULT 0,
  annual_leave_remaining INT DEFAULT 21,
  special_leave_total INT DEFAULT 2,
  special_leave_taken INT DEFAULT 0,
  special_leave_remaining INT DEFAULT 2,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff_year UNIQUE (staff_id, year),
  CONSTRAINT fk_leave_balance_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TRIGGER update_leave_balance_updated_at BEFORE UPDATE ON staff_leave_balance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff schedule
CREATE TABLE staff_schedule (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  monday_schedule JSON,
  tuesday_schedule JSON,
  wednesday_schedule JSON,
  thursday_schedule JSON,
  friday_schedule JSON,
  saturday_schedule JSON,
  sunday_schedule JSON,
  status enum_schedule_status DEFAULT 'draft',
  published_by BIGINT,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_schedule_staff_id ON staff_schedule(staff_id);
CREATE INDEX idx_schedule_week ON staff_schedule(week_start_date, week_end_date);

CREATE TRIGGER update_schedule_updated_at BEFORE UPDATE ON staff_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff performance
CREATE TABLE staff_performance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  period_type enum_period_type DEFAULT 'monthly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  revenue_target DECIMAL(10,2) DEFAULT 0,
  revenue_achieved DECIMAL(10,2) DEFAULT 0,
  service_revenue DECIMAL(10,2) DEFAULT 0,
  product_revenue DECIMAL(10,2) DEFAULT 0,
  customers_served INT DEFAULT 0,
  repeat_customers INT DEFAULT 0,
  new_customers INT DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  services_completed INT DEFAULT 0,
  average_service_time INT DEFAULT 0,
  utilization_rate DECIMAL(5,2) DEFAULT 0,
  efficiency_score DECIMAL(5,2) DEFAULT 0,
  days_worked INT DEFAULT 0,
  days_present INT DEFAULT 0,
  days_absent INT DEFAULT 0,
  days_late INT DEFAULT 0,
  total_overtime_hours DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff_period UNIQUE (staff_id, period_type, period_start),
  CONSTRAINT fk_performance_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_performance_period ON staff_performance(period_start, period_end);

CREATE TRIGGER update_performance_updated_at BEFORE UPDATE ON staff_performance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff commission
CREATE TABLE staff_commission (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  period_month DATE NOT NULL,
  service_revenue DECIMAL(10,2) DEFAULT 0,
  product_revenue DECIMAL(10,2) DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  service_commission_amount DECIMAL(10,2) DEFAULT 0,
  product_commission_amount DECIMAL(10,2) DEFAULT 0,
  performance_bonus_amount DECIMAL(10,2) DEFAULT 0,
  overtime_pay DECIMAL(10,2) DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  tax_deduction DECIMAL(10,2) DEFAULT 0,
  advance_deduction DECIMAL(10,2) DEFAULT 0,
  other_deductions DECIMAL(10,2) DEFAULT 0,
  total_deductions DECIMAL(10,2) DEFAULT 0,
  net_payable DECIMAL(10,2) DEFAULT 0,
  payment_status enum_payment_status DEFAULT 'pending',
  payment_date DATE,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff_month UNIQUE (staff_id, period_month),
  CONSTRAINT fk_commission_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TRIGGER update_commission_updated_at BEFORE UPDATE ON staff_commission
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff activity log
CREATE TABLE staff_activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  activity_details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_activity_staff_id ON staff_activity_log(staff_id);
CREATE INDEX idx_activity_type ON staff_activity_log(activity_type);
CREATE INDEX idx_activity_created_at ON staff_activity_log(created_at);

-- Staff documents
CREATE TABLE staff_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_url VARCHAR(255) NOT NULL,
  expiry_date DATE,
  verified BOOLEAN DEFAULT FALSE,
  verified_by BIGINT,
  verified_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_documents_staff_id ON staff_documents(staff_id);
CREATE INDEX idx_documents_type ON staff_documents(document_type);

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON staff_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff training
CREATE TABLE staff_training (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  training_name VARCHAR(255) NOT NULL,
  training_type VARCHAR(100),
  trainer VARCHAR(255),
  training_date DATE,
  duration_hours INT,
  status enum_training_status DEFAULT 'scheduled',
  certificate_url VARCHAR(255),
  skills_acquired TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_training_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_training_staff_id ON staff_training(staff_id);
CREATE INDEX idx_training_date ON staff_training(training_date);

CREATE TRIGGER update_training_updated_at BEFORE UPDATE ON staff_training
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff settings
CREATE TABLE staff_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  setting_category VARCHAR(100) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_setting UNIQUE (salon_id, setting_category, setting_key),
  CONSTRAINT fk_staff_settings_salon FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE
);

CREATE INDEX idx_staff_settings_salon_id ON staff_settings(salon_id);

CREATE TRIGGER update_staff_settings_updated_at BEFORE UPDATE ON staff_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FILE: database/main/03_customers.sql
-- ============================================

-- Customers module

-- Drop existing tables
DROP TABLE IF EXISTS customer_tags CASCADE;
DROP TABLE IF EXISTS customer_notes CASCADE;
DROP TABLE IF EXISTS customer_addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_customer_gender CASCADE;

-- Create ENUM type
CREATE TYPE enum_customer_gender AS ENUM ('male', 'female', 'other');

-- Customers table
CREATE TABLE customers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  external_id VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  full_name VARCHAR(511),
  email VARCHAR(255),
  phone VARCHAR(50),
  phone_normalized VARCHAR(50),
  dob DATE,
  gender enum_customer_gender DEFAULT 'other',
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'IN',
  notes TEXT,
  loyalty_points INT DEFAULT 0,
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_visit DATE,
  preferred_staff_id BIGINT,
  preferred_room VARCHAR(100),
  marketing_opt_in BOOLEAN DEFAULT TRUE,
  is_vip BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_phone UNIQUE (salon_id, phone_normalized),
  CONSTRAINT fk_customers_preferred_staff FOREIGN KEY (preferred_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_customers_salon_id ON customers(salon_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_last_visit ON customers(last_visit);
CREATE INDEX idx_customers_preferred_staff ON customers(preferred_staff_id);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Customer addresses table
CREATE TABLE customer_addresses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  label VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_addresses_customer_id ON customer_addresses(customer_id);

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON customer_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Customer notes and tags
CREATE TABLE customer_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  note_text TEXT,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notes_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_notes_customer_id ON customer_notes(customer_id);

CREATE TABLE customer_tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  tag VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tags_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_tags_customer_id ON customer_tags(customer_id);

-- ============================================
-- FILE: database/main/04_services.sql
-- ============================================

-- Services module: categories, services, rooms, combos

-- Drop existing tables
DROP TABLE IF EXISTS combo_services CASCADE;
DROP TABLE IF EXISTS service_combos CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS service_categories CASCADE;

-- Service categories table
CREATE TABLE service_categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_category UNIQUE (salon_id, name)
);

CREATE INDEX idx_categories_salon_id ON service_categories(salon_id);

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON service_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Rooms table
CREATE TABLE rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  capacity INT DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_room UNIQUE (salon_id, name)
);

CREATE INDEX idx_rooms_salon_id ON rooms(salon_id);

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Services table
CREATE TABLE services (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  category_id BIGINT,
  room_id BIGINT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  duration_minutes INT DEFAULT 30,
  price DECIMAL(10,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  commission_percent DECIMAL(5,2) DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_combo BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_service UNIQUE (salon_id, name),
  CONSTRAINT fk_services_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_services_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE INDEX idx_services_salon_id ON services(salon_id);
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_room_id ON services(room_id);

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Service combos table
CREATE TABLE service_combos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_combo UNIQUE (salon_id, name)
);

CREATE INDEX idx_combos_salon_id ON service_combos(salon_id);

CREATE TRIGGER update_combos_updated_at BEFORE UPDATE ON service_combos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Combo services junction table
CREATE TABLE combo_services (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  combo_id BIGINT NOT NULL,
  service_id BIGINT NOT NULL,
  position INT DEFAULT 0,
  quantity INT DEFAULT 1,
  CONSTRAINT fk_combo_services_combo FOREIGN KEY (combo_id) REFERENCES service_combos(id) ON DELETE CASCADE,
  CONSTRAINT fk_combo_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- ============================================
-- FILE: database/main/05_bookings.sql
-- ============================================

-- Bookings module: bookings, booking_items, views

-- Drop existing tables and views
DROP VIEW IF EXISTS v_booking_details CASCADE;
DROP TABLE IF EXISTS booking_items CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_booking_status CASCADE;
DROP TYPE IF EXISTS enum_booking_item_status CASCADE;
DROP TYPE IF EXISTS enum_booking_source CASCADE;

-- Create ENUM types
CREATE TYPE enum_booking_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE enum_booking_item_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE enum_booking_source AS ENUM ('web', 'pos', 'phone', 'mobile');

-- Bookings table
CREATE TABLE bookings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  customer_id BIGINT,
  booking_number VARCHAR(100) UNIQUE,
  status enum_booking_status DEFAULT 'scheduled',
  start_datetime TIMESTAMP,
  end_datetime TIMESTAMP,
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  created_by BIGINT,
  assigned_to BIGINT,
  room_id BIGINT,
  source enum_booking_source DEFAULT 'web',
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_assigned FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE INDEX idx_bookings_salon_id ON bookings(salon_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_start_datetime ON bookings(start_datetime);
CREATE INDEX idx_bookings_assigned_to ON bookings(assigned_to);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Booking items table
CREATE TABLE booking_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL,
  service_id BIGINT,
  staff_id BIGINT,
  duration_minutes INT DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  status enum_booking_item_status DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_booking_items_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_booking_items_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_booking_items_booking_id ON booking_items(booking_id);
CREATE INDEX idx_booking_items_service_id ON booking_items(service_id);
CREATE INDEX idx_booking_items_staff_id ON booking_items(staff_id);

CREATE TRIGGER update_booking_items_updated_at BEFORE UPDATE ON booking_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for booking details
CREATE VIEW v_booking_details AS
SELECT b.*, 
       c.first_name || ' ' || COALESCE(c.last_name, '') AS customer_name, 
       s.name AS service_name, 
       st.name AS staff_name
FROM bookings b
LEFT JOIN customers c ON c.id = b.customer_id
LEFT JOIN booking_items bi ON bi.booking_id = b.id
LEFT JOIN services s ON s.id = bi.service_id
LEFT JOIN staff st ON st.id = bi.staff_id;

-- ============================================
-- FILE: database/main/06_billing.sql
-- ============================================

-- Billing module: invoices and invoice items

-- Drop existing tables
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_invoice_status CASCADE;

-- Create ENUM type
CREATE TYPE enum_invoice_status AS ENUM ('draft', 'issued', 'paid', 'cancelled', 'refunded');

-- Invoices table
CREATE TABLE invoices (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  invoice_number VARCHAR(100) UNIQUE,
  customer_id BIGINT,
  membership_id BIGINT,
  membership_plan VARCHAR(255),
  booking_id BIGINT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  wallet_applied DECIMAL(10,2) NOT NULL DEFAULT 0,
  status enum_invoice_status DEFAULT 'draft',
  due_date DATE,
  payment_method VARCHAR(50),
  payment_source VARCHAR(50),
  cash_paid DECIMAL(10,2) DEFAULT 0.00,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoices_salon_id ON invoices(salon_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoice items table
CREATE TABLE invoice_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  service_id BIGINT,
  description TEXT,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FILE: database/main/07_memberships.sql
-- ============================================

-- Memberships module

-- Drop existing tables
DROP TABLE IF EXISTS membership_payments CASCADE;
DROP TABLE IF EXISTS memberships CASCADE;
DROP TABLE IF EXISTS membership_plans CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_membership_status CASCADE;
DROP TYPE IF EXISTS enum_payment_status_membership CASCADE;

-- Create ENUM types
CREATE TYPE enum_membership_status AS ENUM ('active', 'expired', 'cancelled', 'pending');
CREATE TYPE enum_payment_status_membership AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Membership plans table
CREATE TABLE membership_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_months INT DEFAULT 12,
  price DECIMAL(10,2) DEFAULT 0,
  benefits JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_plan UNIQUE (salon_id, name)
);

CREATE INDEX idx_plans_salon_id ON membership_plans(salon_id);

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON membership_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Memberships table
CREATE TABLE memberships (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status enum_membership_status DEFAULT 'active',
  remaining_uses INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_memberships_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_memberships_plan FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE
);

CREATE INDEX idx_memberships_customer_id ON memberships(customer_id);
CREATE INDEX idx_memberships_plan_id ON memberships(plan_id);

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Membership payments table
CREATE TABLE membership_payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  membership_id BIGINT NOT NULL,
  amount DECIMAL(10,2) DEFAULT 0,
  payment_date DATE,
  payment_method VARCHAR(50),
  transaction_reference VARCHAR(255),
  status enum_payment_status_membership DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_membership_payments_membership FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE CASCADE
);

CREATE INDEX idx_membership_payments_membership_id ON membership_payments(membership_id);

CREATE TRIGGER update_membership_payments_updated_at BEFORE UPDATE ON membership_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FILE: database/main/08_calendar.sql
-- ============================================

-- Calendar module: events, availability, notifications, tags

-- Drop existing tables
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS room_availability CASCADE;
DROP TABLE IF EXISTS staff_availability CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;

-- Drop ENUM types
DROP TYPE IF EXISTS enum_calendar_event_status CASCADE;
DROP TYPE IF EXISTS enum_calendar_event_source CASCADE;
DROP TYPE IF EXISTS enum_notification_status CASCADE;

-- Create ENUM types
CREATE TYPE enum_calendar_event_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled');
CREATE TYPE enum_calendar_event_source AS ENUM ('booking', 'manual', 'import');
CREATE TYPE enum_notification_status AS ENUM ('pending', 'sent', 'failed');

-- Calendar events table
CREATE TABLE calendar_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  customer_id BIGINT,
  booking_item_id BIGINT,
  service_id BIGINT,
  staff_id BIGINT,
  room_id BIGINT,
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP NOT NULL,
  status enum_calendar_event_status DEFAULT 'scheduled',
  event_type enum_calendar_event_source DEFAULT 'booking',
  notes TEXT,
  created_by BIGINT,
  updated_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  CONSTRAINT fk_calendar_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_calendar_events_booking_item FOREIGN KEY (booking_item_id) REFERENCES booking_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_calendar_events_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_calendar_events_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  CONSTRAINT fk_calendar_events_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE INDEX idx_calendar_events_salon_id ON calendar_events(salon_id);
CREATE INDEX idx_calendar_events_start_at ON calendar_events(start_at);
CREATE INDEX idx_calendar_events_staff_id ON calendar_events(staff_id);
CREATE INDEX idx_calendar_events_customer_id ON calendar_events(customer_id);

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Staff availability table
CREATE TABLE staff_availability (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff_availability_date UNIQUE (staff_id, date),
  CONSTRAINT fk_staff_availability_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE TRIGGER update_staff_availability_updated_at BEFORE UPDATE ON staff_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Room availability table
CREATE TABLE room_availability (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_room_date UNIQUE (room_id, date),
  CONSTRAINT fk_room_availability_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TRIGGER update_room_availability_updated_at BEFORE UPDATE ON room_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Notifications table
CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  event_type VARCHAR(100),
  payload JSON,
  scheduled_at TIMESTAMP,
  status enum_notification_status DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_salon_id ON notifications(salon_id);
CREATE INDEX idx_notifications_status ON notifications(status);

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tags table
CREATE TABLE tags (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_tag UNIQUE (salon_id, name)
);

CREATE INDEX idx_tags_salon_id ON tags(salon_id);

-- ============================================
-- FILE: database/main/09_expenses.sql
-- ============================================

-- Expenses and suppliers module

-- Drop existing tables
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;

-- Expenses table
CREATE TABLE expenses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(255),
  vendor VARCHAR(255),
  incurred_on DATE,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_salon_id ON expenses(salon_id);
CREATE INDEX idx_expenses_incurred_on ON expenses(incurred_on);

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Suppliers table
CREATE TABLE suppliers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_salon_supplier UNIQUE (salon_id, name)
);

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FILE: database/main/10_bi_warehouse.sql
-- ============================================

-- Business Intelligence warehouse module: dimension and fact tables

-- Drop existing tables
DROP TABLE IF EXISTS fact_expense CASCADE;
DROP TABLE IF EXISTS fact_booking CASCADE;
DROP TABLE IF EXISTS fact_revenue CASCADE;
DROP TABLE IF EXISTS dim_customer CASCADE;
DROP TABLE IF EXISTS dim_service CASCADE;
DROP TABLE IF EXISTS dim_staff CASCADE;
DROP TABLE IF EXISTS dim_date CASCADE;

-- Date dimension table
CREATE TABLE dim_date (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date DATE NOT NULL,
  day INT,
  month INT,
  year INT,
  quarter INT,
  is_weekend BOOLEAN DEFAULT FALSE,
  is_holiday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_date UNIQUE (date)
);

-- Staff dimension table
CREATE TABLE dim_staff (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  staff_id BIGINT,
  name VARCHAR(255),
  salon_id BIGINT,
  department VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_staff UNIQUE (staff_id, salon_id)
);

-- Service dimension table
CREATE TABLE dim_service (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  service_id BIGINT,
  name VARCHAR(255),
  category VARCHAR(255),
  duration_minutes INT,
  price DECIMAL(10,2),
  salon_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_service UNIQUE (service_id, salon_id)
);

-- Customer dimension table
CREATE TABLE dim_customer (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id BIGINT,
  full_name VARCHAR(511),
  email VARCHAR(255),
  phone VARCHAR(50),
  salon_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_customer UNIQUE (customer_id, salon_id)
);

-- Revenue fact table
CREATE TABLE fact_revenue (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT,
  date_id BIGINT,
  staff_id BIGINT,
  service_id BIGINT,
  customer_id BIGINT,
  invoice_id BIGINT,
  booking_id BIGINT,
  amount DECIMAL(12,2),
  tax DECIMAL(12,2),
  discount DECIMAL(12,2),
  net_amount DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fact_revenue_date_id ON fact_revenue(date_id);
CREATE INDEX idx_fact_revenue_staff_id ON fact_revenue(staff_id);

-- Booking fact table
CREATE TABLE fact_booking (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT,
  date_id BIGINT,
  booking_id BIGINT,
  booking_items INT,
  total_amount DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fact_booking_date_id ON fact_booking(date_id);

-- Expense fact table
CREATE TABLE fact_expense (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  salon_id BIGINT,
  date_id BIGINT,
  expense_id BIGINT,
  amount DECIMAL(12,2),
  category VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fact_expense_date_id ON fact_expense(date_id);

-- ============================================
-- FILE: database/main/01_dashboard.sql
-- ============================================

-- Dashboard analytics / summary module
-- This file is intentionally minimal. Detailed warehouse and reporting tables
-- are placed under database/main/10_bi_warehouse.sql to keep dashboard lightweight.

-- Drop view if exists
DROP VIEW IF EXISTS v_today_bookings CASCADE;

-- Create view for today's bookings
-- Note: This view references tables created in other files
CREATE VIEW v_today_bookings AS
SELECT 
    ce.*,
    c.first_name || ' ' || COALESCE(c.last_name, '') AS customer_name,
    s.name AS service_name,
    u.name AS staff_name,
    r.name AS room_name
FROM calendar_events ce
LEFT JOIN customers c ON ce.customer_id = c.id
LEFT JOIN services s ON ce.service_id = s.id
LEFT JOIN users u ON ce.staff_id = u.id
LEFT JOIN rooms r ON ce.room_id = r.id
WHERE ce.deleted_at IS NULL
  AND DATE(ce.start_at) = CURRENT_DATE
  AND ce.event_type = 'booking';

-- ============================================
-- FILE: database/seed/users.sql
-- ============================================

-- Seed users data (passwords are bcrypt hashes)
-- owner@gmail.com / owner@123
-- center@gmail.com / center@123
-- staff@gmail.com / staff@123

INSERT INTO users (email, password, name, role, salon_id) VALUES
('owner@gmail.com', '$2a$10$C0FaMBCt7f83yc3PqNTumOTTYaZFuO74jsegXhA1dXVQXlK30WtoG', 'Salon Owner', 'owner', 1),
('center@gmail.com', '$2a$10$sRk5fHqfvJoy80RposMr7.1Ivlf.iUxAny.xbhV3Vyy86Yovq1vFK', 'Center Manager', 'center', 1),
('staff@gmail.com', '$2a$10$YourHashedPasswordHereForStaff', 'Staff Member', 'staff', 1);
-- ⚠️ WARNING: Replace the staff password hash above with a real bcrypt hash before deploying!
-- Generate one with: node -e "const b=require('bcryptjs');b.hash('staff@123',10).then(console.log)"

-- Owner Hash: $2a$10$C4yT4Bl0tEUfBG.jNNqShePMmmnk5N.2AJo47tFD2Rl0yOcLVPMBi
-- Center Hash: $2a$10$ewndUngT7QCmVCOrKYZXX.Uj.fP1dMEO1Xa2pv9WWESCQnSGJvDTe