use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

// Types for database operations
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub push_to_talk_key: String,
    pub toggle_key: String,
    pub hotkey_mode: String,
    pub language: String,
    pub selected_model_id: String,
    pub show_recording_indicator: bool,
    pub play_audio_feedback: bool,
    pub auto_start_on_boot: bool,
    pub minimize_to_tray: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            push_to_talk_key: "Ctrl+Shift+R".to_string(),
            toggle_key: "Ctrl+Shift+T".to_string(),
            hotkey_mode: "push-to-talk".to_string(),
            language: "en".to_string(),
            selected_model_id: "base".to_string(),
            show_recording_indicator: true,
            play_audio_feedback: true,
            auto_start_on_boot: false,
            minimize_to_tray: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperModel {
    pub id: String,
    pub name: String,
    pub size: String,
    pub size_bytes: i64,
    pub description: String,
    pub languages: String, // JSON array stored as string
    pub downloaded: bool,
    pub download_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppState {
    pub is_first_launch: bool,
    pub setup_complete: bool,
    pub current_setup_step: i32,
    pub selected_model_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptionHistory {
    pub id: i64,
    pub text: String,
    pub model_id: String,
    pub language: String,
    pub duration_ms: i64,
    pub created_at: String,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_data_dir).ok();
        let db_path = app_data_dir.join("WaveType.db");
        let conn = Connection::open(db_path)?;
        
        let db = Self {
            conn: Mutex::new(conn),
        };
        
        db.init_tables()?;
        db.init_default_data()?;
        
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Settings table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                push_to_talk_key TEXT NOT NULL DEFAULT 'Ctrl+Shift+R',
                toggle_key TEXT NOT NULL DEFAULT 'Ctrl+Shift+T',
                hotkey_mode TEXT NOT NULL DEFAULT 'push-to-talk',
                language TEXT NOT NULL DEFAULT 'en',
                selected_model_id TEXT NOT NULL DEFAULT 'base',
                show_recording_indicator INTEGER NOT NULL DEFAULT 1,
                play_audio_feedback INTEGER NOT NULL DEFAULT 1,
                auto_start_on_boot INTEGER NOT NULL DEFAULT 0,
                minimize_to_tray INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // App state table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                is_first_launch INTEGER NOT NULL DEFAULT 1,
                setup_complete INTEGER NOT NULL DEFAULT 0,
                current_setup_step INTEGER NOT NULL DEFAULT 0,
                selected_model_id TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Models table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                size TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                description TEXT NOT NULL,
                languages TEXT NOT NULL,
                downloaded INTEGER NOT NULL DEFAULT 0,
                download_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Transcription history table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS transcription_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                model_id TEXT NOT NULL,
                language TEXT NOT NULL,
                duration_ms INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        Ok(())
    }

    fn init_default_data(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Insert default settings if not exists
        conn.execute(
            "INSERT OR IGNORE INTO settings (id) VALUES (1)",
            [],
        )?;

        // Insert default app state if not exists
        conn.execute(
            "INSERT OR IGNORE INTO app_state (id) VALUES (1)",
            [],
        )?;

        // Insert default Whisper models
        let models: Vec<(&str, &str, &str, i64, &str, &str)> = vec![
            ("tiny", "Tiny", "75 MB", 75_i64 * 1024 * 1024, "Fastest model, lower accuracy. Good for quick notes.", "[\"en\"]"),
            ("base", "Base", "142 MB", 142_i64 * 1024 * 1024, "Balanced speed and accuracy. Recommended for most users.", "[\"en\"]"),
            ("small", "Small", "466 MB", 466_i64 * 1024 * 1024, "Higher accuracy, slower than Base. Good for longer dictation.", "[\"en\", \"bn\"]"),
            ("medium", "Medium", "1.5 GB", 1536_i64 * 1024 * 1024, "Best accuracy for most languages. Requires more RAM.", "[\"en\", \"bn\"]"),
            ("large", "Large", "2.9 GB", 2969_i64 * 1024 * 1024, "Highest accuracy. Best for professional use.", "[\"en\", \"bn\"]"),
        ];

        for (id, name, size, size_bytes, description, languages) in models {
            conn.execute(
                "INSERT OR IGNORE INTO models (id, name, size, size_bytes, description, languages)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, name, size, size_bytes, description, languages],
            )?;
        }

        Ok(())
    }

    // Settings operations
    pub fn get_settings(&self) -> Result<AppSettings> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT push_to_talk_key, toggle_key, hotkey_mode, language, selected_model_id,
                    show_recording_indicator, play_audio_feedback, auto_start_on_boot, minimize_to_tray
             FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(AppSettings {
                    push_to_talk_key: row.get(0)?,
                    toggle_key: row.get(1)?,
                    hotkey_mode: row.get(2)?,
                    language: row.get(3)?,
                    selected_model_id: row.get(4)?,
                    show_recording_indicator: row.get::<_, i32>(5)? == 1,
                    play_audio_feedback: row.get::<_, i32>(6)? == 1,
                    auto_start_on_boot: row.get::<_, i32>(7)? == 1,
                    minimize_to_tray: row.get::<_, i32>(8)? == 1,
                })
            },
        )
    }

    pub fn update_settings(&self, settings: &AppSettings) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET
                push_to_talk_key = ?1,
                toggle_key = ?2,
                hotkey_mode = ?3,
                language = ?4,
                selected_model_id = ?5,
                show_recording_indicator = ?6,
                play_audio_feedback = ?7,
                auto_start_on_boot = ?8,
                minimize_to_tray = ?9,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 1",
            params![
                settings.push_to_talk_key,
                settings.toggle_key,
                settings.hotkey_mode,
                settings.language,
                settings.selected_model_id,
                settings.show_recording_indicator as i32,
                settings.play_audio_feedback as i32,
                settings.auto_start_on_boot as i32,
                settings.minimize_to_tray as i32,
            ],
        )?;
        Ok(())
    }

    pub fn update_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let query = format!(
            "UPDATE settings SET {} = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            key
        );
        conn.execute(&query, params![value])?;
        Ok(())
    }

    // App state operations
    pub fn get_app_state(&self) -> Result<AppState> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT is_first_launch, setup_complete, current_setup_step, selected_model_id
             FROM app_state WHERE id = 1",
            [],
            |row| {
                Ok(AppState {
                    is_first_launch: row.get::<_, i32>(0)? == 1,
                    setup_complete: row.get::<_, i32>(1)? == 1,
                    current_setup_step: row.get(2)?,
                    selected_model_id: row.get(3)?,
                })
            },
        )
    }

    pub fn update_app_state(&self, state: &AppState) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_state SET
                is_first_launch = ?1,
                setup_complete = ?2,
                current_setup_step = ?3,
                selected_model_id = ?4,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = 1",
            params![
                state.is_first_launch as i32,
                state.setup_complete as i32,
                state.current_setup_step,
                state.selected_model_id,
            ],
        )?;
        Ok(())
    }

    pub fn set_setup_complete(&self, complete: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_state SET setup_complete = ?1, is_first_launch = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            params![complete as i32, (!complete) as i32],
        )?;
        Ok(())
    }

    pub fn set_current_setup_step(&self, step: i32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_state SET current_setup_step = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            params![step],
        )?;
        Ok(())
    }

    // Model operations
    pub fn get_models(&self) -> Result<Vec<WhisperModel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, size, size_bytes, description, languages, downloaded, download_path
             FROM models ORDER BY size_bytes ASC"
        )?;
        
        let models = stmt.query_map([], |row| {
            Ok(WhisperModel {
                id: row.get(0)?,
                name: row.get(1)?,
                size: row.get(2)?,
                size_bytes: row.get(3)?,
                description: row.get(4)?,
                languages: row.get(5)?,
                downloaded: row.get::<_, i32>(6)? == 1,
                download_path: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
        
        Ok(models)
    }

    pub fn get_model(&self, id: &str) -> Result<Option<WhisperModel>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, size, size_bytes, description, languages, downloaded, download_path
             FROM models WHERE id = ?1"
        )?;
        
        let model = stmt.query_row(params![id], |row| {
            Ok(WhisperModel {
                id: row.get(0)?,
                name: row.get(1)?,
                size: row.get(2)?,
                size_bytes: row.get(3)?,
                description: row.get(4)?,
                languages: row.get(5)?,
                downloaded: row.get::<_, i32>(6)? == 1,
                download_path: row.get(7)?,
            })
        }).ok();
        
        Ok(model)
    }

    pub fn set_model_downloaded(&self, id: &str, downloaded: bool, path: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE models SET downloaded = ?1, download_path = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            params![downloaded as i32, path, id],
        )?;
        Ok(())
    }

    pub fn set_selected_model(&self, model_id: Option<&str>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE app_state SET selected_model_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
            params![model_id],
        )?;
        // Also update in settings
        if let Some(id) = model_id {
            conn.execute(
                "UPDATE settings SET selected_model_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                params![id],
            )?;
        }
        Ok(())
    }

    // Transcription history operations
    pub fn add_transcription(&self, text: &str, model_id: &str, language: &str, duration_ms: i64) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO transcription_history (text, model_id, language, duration_ms)
             VALUES (?1, ?2, ?3, ?4)",
            params![text, model_id, language, duration_ms],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_transcription_history(&self, limit: i32) -> Result<Vec<TranscriptionHistory>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, text, model_id, language, duration_ms, created_at
             FROM transcription_history
             ORDER BY created_at DESC
             LIMIT ?1"
        )?;
        
        let history = stmt.query_map(params![limit], |row| {
            Ok(TranscriptionHistory {
                id: row.get(0)?,
                text: row.get(1)?,
                model_id: row.get(2)?,
                language: row.get(3)?,
                duration_ms: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>>>()?;
        
        Ok(history)
    }

    pub fn clear_transcription_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM transcription_history", [])?;
        Ok(())
    }

    pub fn delete_transcription(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM transcription_history WHERE id = ?1", params![id])?;
        Ok(())
    }
}
