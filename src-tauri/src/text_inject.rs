use enigo::{Enigo, Keyboard, Settings};
use std::thread;
use std::time::Duration;

pub struct TextInjector {
    enigo: Enigo,
}

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

        // Small delay to ensure focus is on the target window
        thread::sleep(Duration::from_millis(100));

        // Type the text
        self.enigo
            .text(text)
            .map_err(|e| format!("Failed to inject text: {}", e))?;

        Ok(())
    }
}

// Helper function for one-off text injection
pub fn inject_text_once(text: &str) -> Result<(), String> {
    let mut injector = TextInjector::new()?;
    injector.inject_text(text)
}
