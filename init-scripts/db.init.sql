-- Database initialization for Five/Futsal V0
-- Creates tables for users, groups, events, and inscriptions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    bio TEXT,
    city VARCHAR(100),
    preferred_position VARCHAR(50),
    self_declared_level INTEGER CHECK (self_declared_level BETWEEN 1 AND 5),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    city VARCHAR(100),
    avatar_url TEXT,
    access_type VARCHAR(20) DEFAULT 'private' CHECK (access_type IN ('private', 'public')),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

-- Group members table (many-to-metween users and groups)
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id));

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    location VARCHAR(255),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    level VARCHAR(50), -- e.g., beginner, intermediate, advanced
    price DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'full', 'completed', 'cancelled')),
    organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    shareable_link_token UUID UNIQUE DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

-- Event inscriptions/waitlist table
CREATE TABLE IF NOT EXISTS event_inscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'waitlist', 'cancelled')),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_date_time ON events(date_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_event_inscriptions_event ON event_inscriptions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_inscriptions_user ON event_inscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_inscriptions_status ON event_inscriptions(status);

-- Insert some sample data for demonstration (optional)
-- Uncomment if you want to start with sample data

-- INSERT INTO users (email, password_hash, first_name, last_name, city, email_verified)
-- VALUES (
--     'organisateur@reims.fr',
--     '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', -- password: secret
--     'Sébastien',
--     'Organisateur',
--     'Reims',
--     TRUE
-- );

-- INSERT INTO groups (name, description, city, owner_id, access_type)
-- SELECT
--     'Groupe Five Reims',
--     'Groupe de five historique de Reims',
--     'Reims',
--     id,
--     'private'
-- FROM users WHERE email = 'organisateur@reims.fr';

-- INSERT INTO events (title, description, date_time, location, capacity, level, price, status, organizer_id, group_id)
-- SELECT
--     'Session Five Hebdomadaire',
--     'Session de five tous les mercredis soir',
--     (CURRENT_TIMESTAMP + INTERVAL '3 days')::timestamp with time zone,
--     'Complexe Sportif Colbert, Reims',
--     12,
--     'intermédiaire',
--     10.00,
--     'open',
--     u.id,
--     g.id
-- FROM users u, groups g
-- WHERE u.email = 'organisateur@reims.fr'
-- AND g.name = 'Groupe Five Reims';