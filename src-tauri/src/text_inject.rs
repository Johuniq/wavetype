use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub struct TextInjector {
    enigo: Enigo,
}

// Safety: TextInjector must be Send + Sync for Tauri state management.
// On macOS, Enigo uses thread-local unsafe pointers (CGEventSource), but since we:
// 1. Only create one instance per app lifetime
// 2. Always access it through a Mutex (serialized)
// 3. Never share raw Enigo pointers across threads
// It's safe to mark as Send + Sync.
#[cfg(target_os = "macos")]
unsafe impl Send for TextInjector {}
#[cfg(target_os = "macos")]
unsafe impl Sync for TextInjector {}

impl TextInjector {
    pub fn new() -> Result<Self, String> {
        let enigo = Enigo::new(&Settings::default())
            .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;

        Ok(Self { enigo })
    }

    pub fn inject_text(&mut self, text: &str) -> Result<(), String> {
        if text.is_empty() {
            return Ok(());
        }

        // No delay needed - focus is already on target window when hotkey is pressed
        // This eliminates unnecessary wait time for maximum speed

        // Type the text
        self.enigo
            .text(text)
            .map_err(|e| format!("Failed to inject text: {}", e))?;

        Ok(())
    }

    /// Execute a keyboard shortcut
    pub fn execute_shortcut(&mut self, shortcut: &str) -> Result<(), String> {
        // Minimal delay to ensure focus (reduced from 50ms for speed)
        thread::sleep(Duration::from_millis(10));

        match shortcut {
            "undo" => {
                // Ctrl+Z (or Cmd+Z on macOS)
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('z'), Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('z'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "redo" => {
                // Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (macOS)
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Shift, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('z'), Direction::Click).ok();
                    self.enigo.key(Key::Shift, Direction::Release).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('y'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "copy" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('c'), Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('c'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "cut" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('x'), Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('x'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "paste" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('v'), Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('v'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "select_all" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('a'), Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Unicode('a'), Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "backspace_word" | "delete_word" => {
                // Ctrl+Backspace (delete word) or just multiple backspaces
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Alt, Direction::Press).ok();
                    self.enigo.key(Key::Backspace, Direction::Click).ok();
                    self.enigo.key(Key::Alt, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::Backspace, Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "backspace" => {
                self.enigo.key(Key::Backspace, Direction::Click).ok();
            }
            "delete_line" => {
                // Select entire line then delete: Home, Shift+End, Delete
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Meta, Direction::Press).ok();
                    self.enigo.key(Key::Backspace, Direction::Click).ok();
                    self.enigo.key(Key::Meta, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    // Go to start of line
                    self.enigo.key(Key::Home, Direction::Click).ok();
                    thread::sleep(Duration::from_millis(5));
                    // Select to end
                    self.enigo.key(Key::Shift, Direction::Press).ok();
                    self.enigo.key(Key::End, Direction::Click).ok();
                    self.enigo.key(Key::Shift, Direction::Release).ok();
                    thread::sleep(Duration::from_millis(5));
                    // Delete
                    self.enigo.key(Key::Backspace, Direction::Click).ok();
                }
            }
            "enter" => {
                self.enigo.key(Key::Return, Direction::Click).ok();
            }
            "tab" => {
                self.enigo.key(Key::Tab, Direction::Click).ok();
            }
            "escape" => {
                self.enigo.key(Key::Escape, Direction::Click).ok();
            }
            "left" => {
                self.enigo.key(Key::LeftArrow, Direction::Click).ok();
            }
            "right" => {
                self.enigo.key(Key::RightArrow, Direction::Click).ok();
            }
            "up" => {
                self.enigo.key(Key::UpArrow, Direction::Click).ok();
            }
            "down" => {
                self.enigo.key(Key::DownArrow, Direction::Click).ok();
            }
            "home" => {
                self.enigo.key(Key::Home, Direction::Click).ok();
            }
            "end" => {
                self.enigo.key(Key::End, Direction::Click).ok();
            }
            "word_left" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Alt, Direction::Press).ok();
                    self.enigo.key(Key::LeftArrow, Direction::Click).ok();
                    self.enigo.key(Key::Alt, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::LeftArrow, Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            "word_right" => {
                #[cfg(target_os = "macos")]
                {
                    self.enigo.key(Key::Alt, Direction::Press).ok();
                    self.enigo.key(Key::RightArrow, Direction::Click).ok();
                    self.enigo.key(Key::Alt, Direction::Release).ok();
                }
                #[cfg(not(target_os = "macos"))]
                {
                    self.enigo.key(Key::Control, Direction::Press).ok();
                    self.enigo.key(Key::RightArrow, Direction::Click).ok();
                    self.enigo.key(Key::Control, Direction::Release).ok();
                }
            }
            _ => {
                return Err(format!("Unknown shortcut: {}", shortcut));
            }
        }

        // No delay needed after shortcut - execution is immediate

        Ok(())
    }
}

// These functions are deprecated - use the state-managed TextInjector instead
// (kept for backwards compatibility but not used in the new optimized path)
#[allow(dead_code)]
pub fn inject_text_once(text: &str) -> Result<(), String> {
    let mut injector = TextInjector::new()?;
    injector.inject_text(text)
}

#[allow(dead_code)]
pub fn execute_shortcut(shortcut: &str) -> Result<(), String> {
    let mut injector = TextInjector::new()?;
    injector.execute_shortcut(shortcut)
}
