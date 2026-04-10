import sqlite3 from 'sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let dbConnection = null;

export async function initializeDatabase() {
  const dbType = process.env.DATABASE_TYPE || 'sqlite';
  
  try {
    if (dbType === 'sqlite') {
      return initSQLite();
    } else if (dbType === 'postgresql') {
      return initPostgreSQL();
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

async function initSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DATABASE_URL || './data/contacts.db';
    const dataDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    dbConnection = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else {
        console.log('✅ SQLite connected');
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

async function initPostgreSQL() {
  const pool = new pg.Pool({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });
  
  dbConnection = pool;
  console.log('✅ PostgreSQL connected');
  await createTables();
}

async function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      company TEXT,
      notes TEXT,
      tags TEXT,
      avatar_url TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS ai_interactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      ai_provider TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      contact_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT,
      status TEXT,
      imported_count INTEGER,
      failed_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts(tags);
    CREATE INDEX IF NOT EXISTS idx_ai_user_id ON ai_interactions(user_id);
  `;
  
  if (process.env.DATABASE_TYPE === 'sqlite') {
    return new Promise((resolve, reject) => {
      dbConnection.exec(schema, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Database tables created');
          resolve();
        }
      });
    });
  } else {
    await dbConnection.query(schema);
    console.log('✅ Database tables created');
  }
}

export function getDB() {
  return dbConnection;
}