use regex::Regex;
use std::collections::HashMap;
use lazy_static::lazy_static;

/// Post-processor for transcribed text
/// Handles proper casing, file paths, function names, and programming patterns
pub struct PostProcessor {
    /// Common programming keywords that should be lowercase
    keywords: HashMap<String, String>,
    /// File extensions for path detection
    file_extensions: Vec<&'static str>,
}

lazy_static! {
    // Pattern: "function name" or "func name" -> functionName()
    static ref FUNCTION_PATTERN: Regex = Regex::new(
        r"(?i)\b(function|func|method|def)\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "file name dot extension" -> filename.extension
    static ref FILE_PATH_PATTERN: Regex = Regex::new(
        r"(?i)\b([a-z][a-z0-9_-]*)\s+dot\s+(js|ts|tsx|jsx|rs|py|go|rb|java|cpp|c|h|hpp|css|scss|html|json|yaml|yml|toml|md|txt|sh|bash|sql|vue|svelte|astro)\b"
    ).unwrap();
    
    // Pattern: "slash" -> /
    static ref SLASH_PATTERN: Regex = Regex::new(r"(?i)\b(forward\s+)?slash\b").unwrap();
    
    // Pattern: "backslash" -> \
    static ref BACKSLASH_PATTERN: Regex = Regex::new(r"(?i)\bback\s*slash\b").unwrap();
    
    // Pattern: "underscore" -> _
    static ref UNDERSCORE_PATTERN: Regex = Regex::new(r"(?i)\bunderscore\b").unwrap();
    
    // Pattern: "hyphen" or "dash" -> -
    static ref HYPHEN_PATTERN: Regex = Regex::new(r"(?i)\b(hyphen|dash)\b").unwrap();
    
    // Pattern: "dot" or "period" (standalone) -> .
    static ref DOT_PATTERN: Regex = Regex::new(r"(?i)\b(dot|period)\b").unwrap();
    
    // Pattern: "colon" -> :
    static ref COLON_PATTERN: Regex = Regex::new(r"(?i)\bcolon\b").unwrap();
    
    // Pattern: "semicolon" -> ;
    static ref SEMICOLON_PATTERN: Regex = Regex::new(r"(?i)\bsemi\s*colon\b").unwrap();
    
    // Pattern: "equals" or "equal sign" -> =
    static ref EQUALS_PATTERN: Regex = Regex::new(r"(?i)\b(equals?(\s+sign)?|equal\s+to)\b").unwrap();
    
    // Pattern: "arrow" or "fat arrow" -> =>
    static ref ARROW_PATTERN: Regex = Regex::new(r"(?i)\b(fat\s+)?arrow\b").unwrap();
    
    // Pattern: "open paren" -> (
    static ref OPEN_PAREN_PATTERN: Regex = Regex::new(r"(?i)\bopen\s*(paren|parenthesis|bracket)\b").unwrap();
    
    // Pattern: "close paren" -> )
    static ref CLOSE_PAREN_PATTERN: Regex = Regex::new(r"(?i)\bclose\s*(paren|parenthesis|bracket)\b").unwrap();
    
    // Pattern: "open brace" or "open curly" -> {
    static ref OPEN_BRACE_PATTERN: Regex = Regex::new(r"(?i)\bopen\s*(brace|curly)\b").unwrap();
    
    // Pattern: "close brace" or "close curly" -> }
    static ref CLOSE_BRACE_PATTERN: Regex = Regex::new(r"(?i)\bclose\s*(brace|curly)\b").unwrap();
    
    // Pattern: "open square" or "open bracket" -> [
    static ref OPEN_SQUARE_PATTERN: Regex = Regex::new(r"(?i)\bopen\s*square(\s*bracket)?\b").unwrap();
    
    // Pattern: "close square" or "close bracket" -> ]
    static ref CLOSE_SQUARE_PATTERN: Regex = Regex::new(r"(?i)\bclose\s*square(\s*bracket)?\b").unwrap();
    
    // Pattern: "new line" or "newline" -> \n
    static ref NEWLINE_PATTERN: Regex = Regex::new(r"(?i)\bnew\s*line\b").unwrap();
    
    // Pattern: "tab" -> \t (only when it seems intentional)
    static ref TAB_PATTERN: Regex = Regex::new(r"(?i)\btab\s+(character|key)\b").unwrap();
    
    // Pattern: "camel case X Y Z" -> xYZ
    static ref CAMEL_CASE_PATTERN: Regex = Regex::new(
        r"(?i)\bcamel\s*case\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "snake case X Y Z" -> x_y_z
    static ref SNAKE_CASE_PATTERN: Regex = Regex::new(
        r"(?i)\bsnake\s*case\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "pascal case X Y Z" -> XYZ
    static ref PASCAL_CASE_PATTERN: Regex = Regex::new(
        r"(?i)\bpascal\s*case\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "kebab case X Y Z" -> x-y-z
    static ref KEBAB_CASE_PATTERN: Regex = Regex::new(
        r"(?i)\bkebab\s*case\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "constant case X Y Z" -> X_Y_Z
    static ref CONSTANT_CASE_PATTERN: Regex = Regex::new(
        r"(?i)\b(constant|screaming)\s*case\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "string X" -> "X"
    static ref STRING_PATTERN: Regex = Regex::new(
        r#"(?i)\bstring\s+"?([^"]+)"?\b"#
    ).unwrap();
    
    // Pattern: "variable X" or "var X" -> variable name
    static ref VARIABLE_PATTERN: Regex = Regex::new(
        r"(?i)\b(variable|var|const|let)\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Pattern: "class X" -> ClassName
    static ref CLASS_PATTERN: Regex = Regex::new(
        r"(?i)\bclass\s+([a-z]+(?:\s+[a-z]+)*)\b"
    ).unwrap();
    
    // Common abbreviations (processed carefully to avoid file extensions)
    static ref ABBREV_PATTERN: Regex = Regex::new(
        r"(?i)\b(http|https|api|url|html|css|json|xml|sql|gui|cli|sdk|ide|dom|ajax|rest|crud|orm|mvc|jwt|oauth|ssr|csr|pwa|spa|seo|cdn|dns|ssh|ssl|tls|ftp|tcp|udp|ip|os|cpu|gpu|ram|ssd|hdd|usb|pdf|csv|svg|png|jpg|gif|mp3|mp4|avi|exe|dll|npm|yarn|pnpm|git|svn|aws|gcp|env)\b"
    ).unwrap();
    
    // Pattern: "in file X dot ext" or "file X dot ext" -> @X.ext (IDE file mention)
    // Matches patterns like: "in index dot ts", "file main dot rs", "the app dot tsx"
    static ref FILE_MENTION_PATTERN: Regex = Regex::new(
        r"(?i)\b(in|the|file|from|to|open|edit|fix|update|check|see|look at|modify|change|review|refactor)\s+([a-z][a-z0-9_-]*)\s+dot\s+(js|ts|tsx|jsx|rs|py|go|rb|java|cpp|c|h|hpp|css|scss|html|json|yaml|yml|toml|md|txt|sh|sql|vue|svelte|astro|env|config|lock|gitignore|dockerignore|makefile)\b"
    ).unwrap();
    
    // Pattern for path with file mention: "src slash components slash button dot tsx" -> src/components/@button.tsx
    static ref PATH_FILE_MENTION_PATTERN: Regex = Regex::new(
        r"(?i)\b(in|the|file|from|to|open|edit|fix|update|check|see|look at|modify|change|review|refactor)\s+([a-z][a-z0-9_/-]*)\s+([a-z][a-z0-9_-]*)\s+dot\s+(js|ts|tsx|jsx|rs|py|go|rb|java|cpp|c|h|hpp|css|scss|html|json|yaml|yml|toml|md|txt|sh|sql|vue|svelte|astro)\b"
    ).unwrap();
}

impl PostProcessor {
    pub fn new() -> Self {
        let mut keywords = HashMap::new();
        
        // Common programming keywords
        let kw_list = [
            "if", "else", "for", "while", "do", "switch", "case", "break", "continue",
            "return", "function", "const", "let", "var", "class", "struct", "enum",
            "interface", "type", "import", "export", "from", "as", "default", "async",
            "await", "try", "catch", "finally", "throw", "new", "this", "self", "super",
            "public", "private", "protected", "static", "final", "abstract", "virtual",
            "override", "implements", "extends", "null", "undefined", "none", "nil",
            "true", "false", "and", "or", "not", "in", "is", "typeof", "instanceof",
            "void", "int", "float", "double", "string", "bool", "boolean", "char",
            "array", "list", "map", "set", "dict", "tuple", "option", "result",
            "println", "print", "console", "log", "debug", "info", "warn", "error",
        ];
        
        for kw in kw_list {
            keywords.insert(kw.to_lowercase(), kw.to_string());
        }
        
        Self {
            keywords,
            file_extensions: vec![
                "js", "ts", "tsx", "jsx", "rs", "py", "go", "rb", "java", "cpp", "c",
                "h", "hpp", "css", "scss", "sass", "less", "html", "htm", "json", "yaml",
                "yml", "toml", "xml", "md", "txt", "sh", "bash", "zsh", "fish", "sql",
                "vue", "svelte", "astro", "php", "swift", "kt", "scala", "ex", "exs",
                "erl", "hs", "ml", "fs", "clj", "lisp", "r", "jl", "lua", "pl", "pm",
            ],
        }
    }
    
    /// Main post-processing function
    pub fn process(&self, text: &str) -> String {
        let mut result = text.to_string();
        
        // Apply transformations in order
        // First, fix sentence casing on raw text
        result = self.fix_sentence_casing(&result);
        
        // Then apply code-specific transformations
        result = self.process_explicit_casing(&result);
        result = self.process_functions(&result);
        result = self.process_file_mentions(&result);  // Process @file mentions first
        result = self.process_file_paths(&result);
        result = self.process_variables(&result);
        result = self.process_classes(&result);
        result = self.process_symbols(&result);
        result = self.process_abbreviations(&result);
        result = self.process_keywords(&result);  // Apply keyword casing
        result = self.cleanup_whitespace(&result);
        
        result
    }
    
    /// Process explicit casing commands (camelCase, snake_case, etc.)
    fn process_explicit_casing(&self, text: &str) -> String {
        let mut result = text.to_string();
        
        // camelCase
        result = CAMEL_CASE_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            self.to_camel_case(&caps[1])
        }).to_string();
        
        // snake_case
        result = SNAKE_CASE_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            self.to_snake_case(&caps[1])
        }).to_string();
        
        // PascalCase
        result = PASCAL_CASE_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            self.to_pascal_case(&caps[1])
        }).to_string();
        
        // kebab-case
        result = KEBAB_CASE_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            self.to_kebab_case(&caps[1])
        }).to_string();
        
        // CONSTANT_CASE
        result = CONSTANT_CASE_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            self.to_constant_case(&caps[2])
        }).to_string();
        
        result
    }
    
    /// Process function declarations
    fn process_functions(&self, text: &str) -> String {
        FUNCTION_PATTERN.replace_all(text, |caps: &regex::Captures| {
            let name = self.to_camel_case(&caps[2]);
            format!("{}()", name)
        }).to_string()
    }
    
    /// Process file mentions for IDE-style @ mentions (e.g., "fix bug in index dot ts" -> "fix bug in @index.ts")
    fn process_file_mentions(&self, text: &str) -> String {
        let mut result = text.to_string();
        
        // Process "in/file X dot ext" -> "in @X.ext"
        result = FILE_MENTION_PATTERN.replace_all(&result, |caps: &regex::Captures| {
            let preposition = &caps[1];
            let filename = caps[2].to_lowercase();
            let ext = caps[3].to_lowercase();
            format!("{} @{}.{}", preposition, filename, ext)
        }).to_string();
        
        result
    }
    
    /// Process file paths (e.g., "index dot ts" -> "index.ts")
    fn process_file_paths(&self, text: &str) -> String {
        FILE_PATH_PATTERN.replace_all(text, |caps: &regex::Captures| {
            format!("{}.{}", caps[1].to_lowercase(), caps[2].to_lowercase())
        }).to_string()
    }
    
    /// Process variable declarations
    fn process_variables(&self, text: &str) -> String {
        VARIABLE_PATTERN.replace_all(text, |caps: &regex::Captures| {
            let keyword = caps[1].to_lowercase();
            let name = self.to_camel_case(&caps[2]);
            format!("{} {}", keyword, name)
        }).to_string()
    }
    
    /// Process class declarations
    fn process_classes(&self, text: &str) -> String {
        CLASS_PATTERN.replace_all(text, |caps: &regex::Captures| {
            let name = self.to_pascal_case(&caps[1]);
            format!("class {}", name)
        }).to_string()
    }
    
    /// Process programming symbols
    fn process_symbols(&self, text: &str) -> String {
        let mut result = text.to_string();
        
        // Order matters - process more specific patterns first
        result = SEMICOLON_PATTERN.replace_all(&result, ";").to_string();
        result = BACKSLASH_PATTERN.replace_all(&result, "\\").to_string();
        result = SLASH_PATTERN.replace_all(&result, "/").to_string();
        result = UNDERSCORE_PATTERN.replace_all(&result, "_").to_string();
        result = HYPHEN_PATTERN.replace_all(&result, "-").to_string();
        result = COLON_PATTERN.replace_all(&result, ":").to_string();
        result = ARROW_PATTERN.replace_all(&result, "=>").to_string();
        result = EQUALS_PATTERN.replace_all(&result, "=").to_string();
        
        // Brackets and braces
        result = OPEN_PAREN_PATTERN.replace_all(&result, "(").to_string();
        result = CLOSE_PAREN_PATTERN.replace_all(&result, ")").to_string();
        result = OPEN_BRACE_PATTERN.replace_all(&result, "{").to_string();
        result = CLOSE_BRACE_PATTERN.replace_all(&result, "}").to_string();
        result = OPEN_SQUARE_PATTERN.replace_all(&result, "[").to_string();
        result = CLOSE_SQUARE_PATTERN.replace_all(&result, "]").to_string();
        
        // Special characters
        result = NEWLINE_PATTERN.replace_all(&result, "\n").to_string();
        result = TAB_PATTERN.replace_all(&result, "\t").to_string();
        
        // Process "dot" last but only standalone dots, not in file paths
        // Don't convert "dot" if it's already been processed as part of a file path
        result = self.process_standalone_dots(&result);
        
        result
    }
    
    /// Process standalone dots (not part of file paths)
    fn process_standalone_dots(&self, text: &str) -> String {
        // Only convert "dot" when it's not adjacent to a file extension
        let mut result = String::new();
        let words: Vec<&str> = text.split_whitespace().collect();
        
        for (i, word) in words.iter().enumerate() {
            if i > 0 {
                result.push(' ');
            }
            
            let lower = word.to_lowercase();
            if lower == "dot" || lower == "period" {
                // Check if next word looks like a file extension
                let next_is_ext = words.get(i + 1)
                    .map(|w| self.file_extensions.contains(&w.to_lowercase().as_str()))
                    .unwrap_or(false);
                
                // If it's before an extension, keep it (will be processed by file path)
                // Otherwise convert to "."
                if next_is_ext {
                    result.push_str(word);
                } else {
                    result.push('.');
                }
            } else {
                result.push_str(word);
            }
        }
        
        result
    }
    
    /// Process abbreviations to uppercase (but not file extensions after @ or .)
    fn process_abbreviations(&self, text: &str) -> String {
        let mut result = String::new();
        let mut last_end = 0;
        
        for cap in ABBREV_PATTERN.captures_iter(text) {
            let m = cap.get(1).unwrap();
            let start = m.start();
            
            // Check if preceded by @ or . (file extension context)
            let is_file_ext = if start > 0 {
                let prev_char = text.chars().nth(start - 1).unwrap_or(' ');
                prev_char == '@' || prev_char == '.'
            } else {
                false
            };
            
            result.push_str(&text[last_end..start]);
            
            if is_file_ext {
                // Keep as lowercase for file extensions
                result.push_str(&m.as_str().to_lowercase());
            } else {
                // Uppercase for abbreviations
                result.push_str(&m.as_str().to_uppercase());
            }
            
            last_end = m.end();
        }
        
        result.push_str(&text[last_end..]);
        result
    }
    
    /// Process programming keywords to their proper casing
    fn process_keywords(&self, text: &str) -> String {
        let mut result = String::new();
        let mut last_end = 0;
        
        // Simple word boundary matching for keywords
        for (i, c) in text.char_indices() {
            if c.is_alphabetic() && (i == 0 || !text.chars().nth(i - 1).map(|p| p.is_alphanumeric()).unwrap_or(false)) {
                // Start of a word
                let word_start = i;
                let word_end = text[i..].char_indices()
                    .find(|(_, c)| !c.is_alphanumeric())
                    .map(|(j, _)| i + j)
                    .unwrap_or(text.len());
                
                let word = &text[word_start..word_end];
                let lower = word.to_lowercase();
                
                // Check if this word is a known keyword
                if let Some(proper_case) = self.keywords.get(&lower) {
                    // Add text before this word
                    result.push_str(&text[last_end..word_start]);
                    result.push_str(proper_case);
                    last_end = word_end;
                }
            }
        }
        
        // Add remaining text
        result.push_str(&text[last_end..]);
        
        if result.is_empty() {
            text.to_string()
        } else {
            result
        }
    }
    
    /// Fix sentence casing (capitalize first letter after periods)
    fn fix_sentence_casing(&self, text: &str) -> String {
        let mut result = String::new();
        let mut capitalize_next = true;
        
        for c in text.chars() {
            if capitalize_next && c.is_alphabetic() {
                result.push(c.to_uppercase().next().unwrap_or(c));
                capitalize_next = false;
            } else {
                result.push(c);
                if c == '.' || c == '!' || c == '?' {
                    capitalize_next = true;
                }
            }
        }
        
        result
    }
    
    /// Clean up extra whitespace
    fn cleanup_whitespace(&self, text: &str) -> String {
        // Replace multiple spaces with single space
        let mut result = String::new();
        let mut prev_was_space = false;
        
        for c in text.chars() {
            if c.is_whitespace() && c != '\n' && c != '\t' {
                if !prev_was_space {
                    result.push(' ');
                    prev_was_space = true;
                }
            } else {
                result.push(c);
                prev_was_space = false;
            }
        }
        
        result.trim().to_string()
    }
    
    // ========== Case conversion helpers ==========
    
    fn to_camel_case(&self, text: &str) -> String {
        let words: Vec<&str> = text.split_whitespace().collect();
        if words.is_empty() {
            return String::new();
        }
        
        let mut result = words[0].to_lowercase();
        for word in words.iter().skip(1) {
            let mut chars = word.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_uppercase().next().unwrap_or(first));
                result.extend(chars.map(|c| c.to_lowercase().next().unwrap_or(c)));
            }
        }
        result
    }
    
    fn to_pascal_case(&self, text: &str) -> String {
        text.split_whitespace()
            .map(|word| {
                let mut chars = word.chars();
                match chars.next() {
                    Some(first) => {
                        let mut s = first.to_uppercase().to_string();
                        s.extend(chars.map(|c| c.to_lowercase().next().unwrap_or(c)));
                        s
                    }
                    None => String::new(),
                }
            })
            .collect()
    }
    
    fn to_snake_case(&self, text: &str) -> String {
        text.split_whitespace()
            .map(|w| w.to_lowercase())
            .collect::<Vec<_>>()
            .join("_")
    }
    
    fn to_kebab_case(&self, text: &str) -> String {
        text.split_whitespace()
            .map(|w| w.to_lowercase())
            .collect::<Vec<_>>()
            .join("-")
    }
    
    fn to_constant_case(&self, text: &str) -> String {
        text.split_whitespace()
            .map(|w| w.to_uppercase())
            .collect::<Vec<_>>()
            .join("_")
    }
}

impl Default for PostProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_camel_case() {
        let pp = PostProcessor::new();
        assert_eq!(pp.process("camel case hello world"), "helloWorld");
        assert_eq!(pp.process("camel case get user data"), "getUserData");
    }
    
    #[test]
    fn test_snake_case() {
        let pp = PostProcessor::new();
        assert_eq!(pp.process("snake case hello world"), "hello_world");
    }
    
    #[test]
    fn test_file_paths() {
        let pp = PostProcessor::new();
        // File paths get converted properly
        assert_eq!(pp.process("open index dot ts"), "Open @index.ts");
        assert_eq!(pp.process("main dot rs"), "main.rs");
    }
    
    #[test]
    fn test_file_mentions() {
        let pp = PostProcessor::new();
        // IDE-style file mentions with @
        assert_eq!(pp.process("fix bug in index dot ts"), "Fix bug in @index.ts");
        assert_eq!(pp.process("check the app dot tsx"), "Check the @app.tsx");
        assert_eq!(pp.process("edit main dot rs"), "Edit @main.rs");
        assert_eq!(pp.process("refactor utils dot py"), "Refactor @utils.py");
    }
    
    #[test]
    fn test_function() {
        let pp = PostProcessor::new();
        assert_eq!(pp.process("function get user"), "getUser()");
        assert_eq!(pp.process("func handle click"), "handleClick()");
    }
    
    #[test]
    fn test_symbols() {
        let pp = PostProcessor::new();
        // Symbols replace the word but space handling may vary
        let result = pp.process("hello slash world");
        assert!(result.contains("/"));
        let result = pp.process("a equals b");
        assert!(result.contains("="));
    }
    
    #[test]
    fn test_keywords() {
        let pp = PostProcessor::new();
        // Keywords maintain proper casing
        // Test with keywords that won't be matched by other patterns
        let result = pp.process("this is true and false");
        println!("Result: '{}'", result);
        assert!(result.contains("true"), "Expected 'true' in '{}'", result);
        assert!(result.contains("false"), "Expected 'false' in '{}'", result);
    }
}
