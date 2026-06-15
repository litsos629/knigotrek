import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

let db = null

function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const userDataPath = app.getPath('userData')
      const dbPath = path.join(userDataPath, 'knigotrek.db')
      
      // Создаём папку если нет
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true })
      }
      
      // Открываем или создаём БД
      db = new Database(dbPath)
      
      // Включаем foreign keys
      db.pragma('foreign_keys = ON')
      
      // Создаём таблицы
      db.exec(`
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          symbols INTEGER NOT NULL,
          deleted INTEGER DEFAULT 0,
          projectId TEXT,
          syncId TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          genre TEXT,
          targetSymbols INTEGER,
          deadline TEXT,
          status TEXT,
          phase TEXT DEFAULT 'draft',
          startDate TEXT,
          completedDate TEXT,
          description TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chapters (
          id TEXT PRIMARY KEY,
          projectId TEXT,
          title TEXT NOT NULL,
          status TEXT DEFAULT 'planned',
          position INTEGER DEFAULT 0,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          duration INTEGER,
          plannedDuration INTEGER,
          symbols INTEGER,
          speed INTEGER,
          mood TEXT,
          tags TEXT,
          note TEXT,
          projectId TEXT,
          createdAt TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT,
          date TEXT DEFAULT (datetime('now')),
          updatedAt TEXT DEFAULT (datetime('now'))
        );
        
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(projectId);
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_entries_project ON entries(projectId);
        CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
      `)
      
      // Миграция данных из localStorage (если есть)
      migrateFromLocalStorage()

      // Синхронизационные миграции
      runSyncMigrations()

      console.log('Database initialized at:', dbPath)
      resolve(db)
    } catch (error) {
      console.error('Database initialization error:', error)
      reject(error)
    }
  })
}

function migrateFromLocalStorage() {
  try {
    // Проверяем, была ли уже миграция
    const migrationCheck = db.prepare('SELECT value FROM settings WHERE key = ?').get('migration_completed')
    if (migrationCheck) {
      console.log('Migration already completed')
      return
    }

    // Пытаемся прочитать данные из localStorage через файл
    // В Electron мы можем получить доступ к localStorage через сессию
    // Но проще просто импортировать через настройки приложения
    
    // Помечаем миграцию как выполненную
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('migration_completed', 'true')
    console.log('Migration check completed')
  } catch (error) {
    console.error('Migration error:', error)
  }
}

function runSyncMigrations() {
  // ВАЖНО: SQLite запрещает ALTER TABLE ADD COLUMN с неконстантным DEFAULT
  // (например datetime('now')) — такие миграции молча падали, и колонок updatedAt
  // в старых базах не было вовсе. Добавляем колонки без DEFAULT и бэкфиллим UPDATE'ом.
  const migrations = [
    `ALTER TABLE entries ADD COLUMN syncId TEXT`,
    `ALTER TABLE entries ADD COLUMN updatedAt TEXT`,
    `ALTER TABLE projects ADD COLUMN updatedAt TEXT`,
    `ALTER TABLE sessions ADD COLUMN updatedAt TEXT`,
    `ALTER TABLE notes ADD COLUMN updatedAt TEXT`,
    `ALTER TABLE chapters ADD COLUMN updatedAt TEXT`,
    `ALTER TABLE entries ADD COLUMN deleted INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN phase TEXT DEFAULT 'draft'`,
    // Теги (JSON-массив строкой) и привязка к проекту — раньше колонок не было,
    // и эти поля сессий молча терялись при сохранении в SQLite
    `ALTER TABLE sessions ADD COLUMN tags TEXT`,
    `ALTER TABLE sessions ADD COLUMN projectId TEXT`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // Бэкфилл updatedAt для строк, созданных до миграции
  const backfills = [
    `UPDATE entries SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL`,
    `UPDATE projects SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL`,
    `UPDATE sessions SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL`,
    `UPDATE notes SET updatedAt = COALESCE(updatedAt, date, datetime('now')) WHERE updatedAt IS NULL`,
    `UPDATE chapters SET updatedAt = COALESCE(updatedAt, createdAt, datetime('now')) WHERE updatedAt IS NULL`,
  ]
  for (const sql of backfills) {
    try { db.exec(sql) } catch { /* ignore */ }
  }

  // Generate syncId for entries that don't have one (UUID v4 via SQLite)
  try {
    db.exec(`UPDATE entries SET syncId = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))) WHERE syncId IS NULL`)
  } catch { /* ignore */ }

  // UNIQUE-индекс обязателен: pull синхронизации использует ON CONFLICT(syncId),
  // который без UNIQUE-ограничения — ошибка SQL
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_syncid ON entries(syncId)`)
  } catch { /* ignore */ }
}

function queryDatabase(query, params = []) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        reject(new Error('Database not initialized'))
        return
      }

      const trimmedQuery = query.trim().toUpperCase()
      
      if (trimmedQuery.startsWith('SELECT')) {
        const stmt = db.prepare(query)
        const result = stmt.all(params)
        resolve(result)
      } else if (trimmedQuery.startsWith('INSERT') || trimmedQuery.startsWith('UPDATE') || trimmedQuery.startsWith('DELETE')) {
        const stmt = db.prepare(query)
        const result = stmt.run(params)
        resolve({
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes
        })
      } else {
        // Для других запросов (CREATE, DROP и т.д.)
        db.exec(query)
        resolve({ success: true })
      }
    } catch (error) {
      console.error('Database query error:', error)
      reject(error)
    }
  })
}

function backupDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const userDataPath = app.getPath('userData')
      const dbPath = path.join(userDataPath, 'knigotrek.db')
      const backupDir = path.join(userDataPath, 'backups')
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `knigotrek-backup-${timestamp}.db`)
      
      if (!fs.existsSync(dbPath)) {
        reject(new Error('Database file not found'))
        return
      }
      
      fs.copyFileSync(dbPath, backupPath)
      
      // Удаляем старые бэкапы (оставляем последние 7)
      try {
        const backups = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('knigotrek-backup-') && f.endsWith('.db'))
          .map(f => ({
            name: f,
            path: path.join(backupDir, f),
            time: fs.statSync(path.join(backupDir, f)).mtime
          }))
          .sort((a, b) => b.time - a.time)
        
        if (backups.length > 7) {
          backups.slice(7).forEach(backup => {
            fs.unlinkSync(backup.path)
          })
        }
      } catch (cleanupError) {
        console.warn('Backup cleanup error:', cleanupError)
      }
      
      resolve(backupPath)
    } catch (error) {
      console.error('Backup error:', error)
      reject(error)
    }
  })
}

// Закрытие БД при выходе
process.on('exit', () => {
  if (db) {
    db.close()
  }
})

function getDatabase() {
  return db
}

export {
  initDatabase,
  queryDatabase,
  backupDatabase,
  getDatabase
}
