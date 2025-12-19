//! Production-grade License Management for WaveType
//! 
//! Implements Polar.sh License Key API integration with:
//! - Device activation with unique device fingerprinting
//! - License validation with activation_id verification  
//! - Secure local caching with offline grace period
//! - Proper error handling for all API responses
//!
//! API Reference: https://polar.sh/docs/api-reference/customer-portal/license-keys/

use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::PathBuf;
use std::time::Duration;
use log::{info, warn, error, debug};

// =============================================================================
// Configuration Constants
// =============================================================================

/// Polar.sh Customer Portal API endpoint (no auth required for client apps)
const POLAR_API_BASE: &str = "https://api.polar.sh/v1/customer-portal/license-keys";

/// Your Polar.sh Organization UUID - get from polar.sh dashboard settings
const POLAR_ORG_ID: &str = "d076d42a-b873-40f7-9486-a731bfbb8eb7";

/// Offline grace period in hours - license works offline for this duration
const OFFLINE_GRACE_HOURS: i64 = 168; // 7 days

/// HTTP request timeout
const REQUEST_TIMEOUT_SECS: u64 = 30;

// =============================================================================
// Public Types
// =============================================================================

/// License information returned to the application
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub license_key: String,
    pub display_key: String,
    pub status: LicenseStatus,
    pub activation_id: Option<String>,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub benefit_id: Option<String>,
    pub expires_at: Option<String>,
    pub limit_activations: Option<i32>,
    pub usage: i32,
    pub limit_usage: Option<i32>,
    pub validations: i32,
    pub last_validated_at: Option<String>,
    pub device_id: String,
    pub device_label: String,
}

/// License status enum matching Polar API statuses
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    /// License is valid and active
    Granted,
    /// License has been revoked
    Revoked,
    /// License has been disabled
    Disabled,
    /// License has expired
    Expired,
    /// License key is invalid/not found
    Invalid,
    /// Activation limit reached
    ActivationLimitReached,
    /// Network error - using cached license
    Offline,
    /// No license activated
    NotActivated,
}

impl Default for LicenseStatus {
    fn default() -> Self {
        LicenseStatus::NotActivated
    }
}

impl std::fmt::Display for LicenseStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LicenseStatus::Granted => write!(f, "granted"),
            LicenseStatus::Revoked => write!(f, "revoked"),
            LicenseStatus::Disabled => write!(f, "disabled"),
            LicenseStatus::Expired => write!(f, "expired"),
            LicenseStatus::Invalid => write!(f, "invalid"),
            LicenseStatus::ActivationLimitReached => write!(f, "activation_limit_reached"),
            LicenseStatus::Offline => write!(f, "offline"),
            LicenseStatus::NotActivated => write!(f, "not_activated"),
        }
    }
}

impl LicenseStatus {
    /// Check if the license allows app usage
    pub fn allows_usage(&self) -> bool {
        matches!(self, LicenseStatus::Granted | LicenseStatus::Offline)
    }
    
    /// Parse from Polar API status string
    pub fn from_polar_status(status: &str) -> Self {
        match status.to_lowercase().as_str() {
            "granted" => LicenseStatus::Granted,
            "revoked" => LicenseStatus::Revoked,
            "disabled" => LicenseStatus::Disabled,
            _ => LicenseStatus::Invalid,
        }
    }
}

// =============================================================================
// Polar API Request/Response Types
// =============================================================================

/// Request body for /activate endpoint
#[derive(Debug, Serialize)]
struct ActivateRequest {
    key: String,
    organization_id: String,
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    conditions: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    meta: Option<serde_json::Value>,
}

/// Request body for /validate endpoint
#[derive(Debug, Serialize)]
struct ValidateRequest {
    key: String,
    organization_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    activation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    benefit_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    increment_usage: Option<i32>,
}

/// Request body for /deactivate endpoint
#[derive(Debug, Serialize)]
struct DeactivateRequest {
    key: String,
    organization_id: String,
    activation_id: String,
}

/// Customer info from Polar API
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PolarCustomer {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
}

/// Activation info from Polar API
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PolarActivation {
    pub id: String,
    pub license_key_id: String,
    pub label: String,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
    pub modified_at: Option<String>,
}

/// License key info from Polar API (embedded in responses)
#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct PolarLicenseKey {
    pub id: String,
    pub organization_id: String,
    pub customer_id: String,
    pub customer: Option<PolarCustomer>,
    pub benefit_id: String,
    pub key: String,
    pub display_key: String,
    pub status: String,
    pub limit_activations: Option<i32>,
    pub usage: i32,
    pub limit_usage: Option<i32>,
    pub validations: i32,
    pub last_validated_at: Option<String>,
    pub expires_at: Option<String>,
}

/// Response from /activate endpoint
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ActivateResponse {
    pub id: String,
    pub license_key_id: String,
    pub label: String,
    #[serde(default)]
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
    pub modified_at: Option<String>,
    pub license_key: PolarLicenseKey,
}

/// Response from /validate endpoint
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ValidateResponse {
    pub id: String,
    pub organization_id: String,
    pub customer_id: String,
    pub customer: Option<PolarCustomer>,
    pub benefit_id: String,
    pub key: String,
    pub display_key: String,
    pub status: String,
    pub limit_activations: Option<i32>,
    pub usage: i32,
    pub limit_usage: Option<i32>,
    pub validations: i32,
    pub last_validated_at: Option<String>,
    pub expires_at: Option<String>,
    pub activation: Option<PolarActivation>,
}

/// Error response from Polar API
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct PolarError {
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(rename = "type", default)]
    pub error_type: Option<String>,
}

// =============================================================================
// Local Cache Types
// =============================================================================

/// Cached license data stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedLicense {
    /// The original license key (stored securely)
    pub license_key: String,
    /// Activation ID from Polar (required for validation)
    pub activation_id: String,
    /// Device ID this license was activated on
    pub device_id: String,
    /// Device label for identification
    pub device_label: String,
    /// Customer email
    pub customer_email: Option<String>,
    /// Customer name
    pub customer_name: Option<String>,
    /// Benefit ID for validation
    pub benefit_id: String,
    /// Expiration timestamp
    pub expires_at: Option<String>,
    /// Last successful validation timestamp
    pub last_validated_at: String,
    /// License status at last validation
    pub status: String,
    /// Integrity hash to detect tampering
    pub integrity_hash: String,
    /// Cache version for migrations
    pub cache_version: i32,
}

const CACHE_VERSION: i32 = 2;

// =============================================================================
// Device Identification
// =============================================================================

/// Generate a unique, stable device fingerprint
/// Uses hardware identifiers to create a reproducible ID
pub fn get_device_id() -> String {
    let mut hasher = Sha256::new();
    
    // Hostname
    if let Ok(hostname) = hostname::get() {
        hasher.update(hostname.to_string_lossy().as_bytes());
    }
    
    // OS and architecture
    hasher.update(std::env::consts::OS.as_bytes());
    hasher.update(std::env::consts::ARCH.as_bytes());
    
    // Username for multi-user systems
    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        hasher.update(user.as_bytes());
    }
    
    // Platform-specific hardware identifiers
    #[cfg(target_os = "macos")]
    {
        // Get macOS IOPlatformUUID
        if let Ok(output) = std::process::Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = output_str.lines().find(|l| l.contains("IOPlatformUUID")) {
                hasher.update(line.as_bytes());
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Get Windows machine UUID
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
        {
            hasher.update(&output.stdout);
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // Get Linux machine-id
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            hasher.update(id.trim().as_bytes());
        } else if let Ok(id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
            hasher.update(id.trim().as_bytes());
        }
    }
    
    // Create readable device ID with prefix
    let hash = hasher.finalize();
    format!("WVT-{}", hex::encode(&hash[..12]).to_uppercase())
}

/// Get a human-readable device label
pub fn get_device_label() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string());
    
    let os = match std::env::consts::OS {
        "macos" => "macOS",
        "windows" => "Windows", 
        "linux" => "Linux",
        other => other,
    };
    
    format!("{} ({})", hostname, os)
}

/// Get device metadata for Polar activation
fn get_device_meta() -> serde_json::Value {
    serde_json::json!({
        "device_id": get_device_id(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hostname": hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_default(),
        "app_version": env!("CARGO_PKG_VERSION"),
        "activated_at": chrono::Utc::now().to_rfc3339(),
    })
}

// =============================================================================
// Secure Storage
// =============================================================================

fn get_cache_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join("com.johuniq.WaveType"))
}

fn get_cache_path() -> Option<PathBuf> {
    get_cache_dir().map(|d| d.join(".license.dat"))
}

/// Calculate integrity hash for cache tampering detection
fn calculate_integrity_hash(cache: &CachedLicense) -> String {
    let mut hasher = Sha256::new();
    hasher.update(cache.license_key.as_bytes());
    hasher.update(cache.activation_id.as_bytes());
    hasher.update(cache.device_id.as_bytes());
    hasher.update(cache.benefit_id.as_bytes());
    hasher.update(b"wavetype-integrity-v2");
    hex::encode(hasher.finalize())
}

/// Encrypt data using device-bound key
fn encrypt_data(data: &[u8]) -> Vec<u8> {
    let key = derive_encryption_key();
    data.iter()
        .enumerate()
        .map(|(i, &b)| b ^ key[i % key.len()])
        .collect()
}

/// Decrypt data using device-bound key
fn decrypt_data(data: &[u8]) -> Vec<u8> {
    encrypt_data(data) // XOR is symmetric
}

/// Derive encryption key from device ID
fn derive_encryption_key() -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(get_device_id().as_bytes());
    hasher.update(b"wavetype-encryption-key-v2");
    hasher.finalize().to_vec()
}

/// Store license cache securely
pub fn store_cache(cache: &CachedLicense) -> Result<(), String> {
    let cache_dir = get_cache_dir()
        .ok_or("Failed to get cache directory")?;
    
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {}", e))?;
    
    let cache_path = get_cache_path()
        .ok_or("Failed to get cache path")?;
    
    // Add integrity hash
    let mut cache_with_hash = cache.clone();
    cache_with_hash.integrity_hash = calculate_integrity_hash(cache);
    cache_with_hash.cache_version = CACHE_VERSION;
    
    let json = serde_json::to_string(&cache_with_hash)
        .map_err(|e| format!("Failed to serialize cache: {}", e))?;
    
    let encrypted = encrypt_data(json.as_bytes());
    
    std::fs::write(&cache_path, encrypted)
        .map_err(|e| format!("Failed to write cache: {}", e))?;
    
    debug!("License cache stored successfully");
    Ok(())
}

/// Load license cache from disk
pub fn load_cache() -> Option<CachedLicense> {
    let cache_path = get_cache_path()?;
    
    let encrypted = std::fs::read(&cache_path).ok()?;
    let decrypted = decrypt_data(&encrypted);
    let json = String::from_utf8(decrypted).ok()?;
    let cache: CachedLicense = serde_json::from_str(&json).ok()?;
    
    // Verify integrity
    let expected_hash = calculate_integrity_hash(&cache);
    if cache.integrity_hash != expected_hash {
        warn!("License cache integrity check failed - possible tampering");
        return None;
    }
    
    // Verify device binding
    if cache.device_id != get_device_id() {
        warn!("License cache device mismatch");
        return None;
    }
    
    // Check cache version
    if cache.cache_version != CACHE_VERSION {
        warn!("License cache version mismatch");
        return None;
    }
    
    debug!("License cache loaded successfully");
    Some(cache)
}

/// Clear license cache
pub fn clear_cache() -> Result<(), String> {
    if let Some(path) = get_cache_path() {
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("Failed to delete cache: {}", e))?;
        }
    }
    info!("License cache cleared");
    Ok(())
}

// =============================================================================
// License Manager
// =============================================================================

/// Main license management interface
pub struct LicenseManager {
    client: Client,
    org_id: String,
}

impl LicenseManager {
    /// Create new license manager
    pub fn new() -> Self {
        Self::with_org_id(POLAR_ORG_ID)
    }
    
    /// Create license manager with custom org ID
    pub fn with_org_id(org_id: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
            .build()
            .expect("Failed to create HTTP client");
        
        Self {
            client,
            org_id: org_id.to_string(),
        }
    }
    
    /// Activate a license key on this device
    /// 
    /// This creates an activation instance in Polar and stores the activation_id
    /// locally for future validations.
    pub async fn activate(&self, license_key: &str) -> Result<LicenseInfo, String> {
        let device_id = get_device_id();
        let device_label = get_device_label();
        
        info!("Activating license on device: {} ({})", device_label, device_id);
        
        let request = ActivateRequest {
            key: license_key.to_string(),
            organization_id: self.org_id.clone(),
            label: device_label.clone(),
            conditions: None,
            meta: Some(get_device_meta()),
        };
        
        let url = format!("{}/activate", POLAR_API_BASE);
        debug!("POST {}", url);
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        
        debug!("Response status: {}", status);
        debug!("Response body: {}", body);
        
        if status.is_success() {
            let data: ActivateResponse = serde_json::from_str(&body)
                .map_err(|e| format!("Failed to parse response: {} - Body: {}", e, body))?;
            
            info!("License activated successfully!");
            info!("  Activation ID: {}", data.id);
            info!("  Status: {}", data.license_key.status);
            info!("  Activations: {}/{:?}", data.license_key.usage, data.license_key.limit_activations);
            
            // Check expiration
            let license_status = self.check_license_status(&data.license_key);
            
            // Store in local cache
            let cache = CachedLicense {
                license_key: license_key.to_string(),
                activation_id: data.id.clone(),
                device_id: device_id.clone(),
                device_label: device_label.clone(),
                customer_email: data.license_key.customer.as_ref().map(|c| c.email.clone()),
                customer_name: data.license_key.customer.as_ref().and_then(|c| c.name.clone()),
                benefit_id: data.license_key.benefit_id.clone(),
                expires_at: data.license_key.expires_at.clone(),
                last_validated_at: chrono::Utc::now().to_rfc3339(),
                status: data.license_key.status.clone(),
                integrity_hash: String::new(),
                cache_version: CACHE_VERSION,
            };
            
            store_cache(&cache)?;
            
            Ok(LicenseInfo {
                license_key: license_key.to_string(),
                display_key: data.license_key.display_key,
                status: license_status,
                activation_id: Some(data.id),
                customer_email: data.license_key.customer.as_ref().map(|c| c.email.clone()),
                customer_name: data.license_key.customer.as_ref().and_then(|c| c.name.clone()),
                benefit_id: Some(data.license_key.benefit_id),
                expires_at: data.license_key.expires_at,
                limit_activations: data.license_key.limit_activations,
                usage: data.license_key.usage,
                limit_usage: data.license_key.limit_usage,
                validations: data.license_key.validations,
                last_validated_at: data.license_key.last_validated_at,
                device_id,
                device_label,
            })
        } else if status.as_u16() == 403 {
            // Activation limit reached
            let err: PolarError = serde_json::from_str(&body).unwrap_or(PolarError {
                error: Some("Activation limit reached".to_string()),
                detail: None,
                error_type: None,
            });
            error!("Activation limit reached: {:?}", err);
            Err("Activation limit reached. Please deactivate from another device first.".to_string())
        } else if status.as_u16() == 404 {
            error!("License key not found");
            Err("Invalid license key. Please check and try again.".to_string())
        } else if status.as_u16() == 422 {
            let err: PolarError = serde_json::from_str(&body).unwrap_or(PolarError {
                error: Some("Validation error".to_string()),
                detail: Some(body.clone()),
                error_type: None,
            });
            error!("Validation error: {:?}", err);
            Err(format!("Invalid request: {}", err.detail.unwrap_or(err.error.unwrap_or_default())))
        } else {
            error!("Activation failed: {} - {}", status, body);
            Err(format!("Activation failed: HTTP {}", status))
        }
    }
    
    /// Validate the current license
    /// 
    /// First tries online validation with Polar API, falls back to cached
    /// license within the offline grace period.
    pub async fn validate(&self) -> Result<LicenseInfo, String> {
        let device_id = get_device_id();
        let device_label = get_device_label();
        
        // Load cached license
        let cache = load_cache();
        
        if let Some(ref cached) = cache {
            info!("Validating license with Polar API...");
            
            let request = ValidateRequest {
                key: cached.license_key.clone(),
                organization_id: self.org_id.clone(),
                activation_id: Some(cached.activation_id.clone()),
                benefit_id: Some(cached.benefit_id.clone()),
                increment_usage: None, // Don't increment usage on validation
            };
            
            let url = format!("{}/validate", POLAR_API_BASE);
            
            match self.client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&request)
                .send()
                .await
            {
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    
                    debug!("Validate response: {} - {}", status, body);
                    
                    if status.is_success() {
                        let data: ValidateResponse = serde_json::from_str(&body)
                            .map_err(|e| format!("Failed to parse response: {}", e))?;
                        
                        let license_status = self.check_license_status_from_validate(&data);
                        
                        info!("License validated successfully!");
                        info!("  Status: {} -> {:?}", data.status, license_status);
                        info!("  Validations: {}", data.validations);
                        info!("  Has activation: {}", data.activation.is_some());
                        
                        // Update cache
                        let mut updated_cache = cached.clone();
                        updated_cache.last_validated_at = chrono::Utc::now().to_rfc3339();
                        updated_cache.status = data.status.clone();
                        let _ = store_cache(&updated_cache);
                        
                        return Ok(LicenseInfo {
                            license_key: cached.license_key.clone(),
                            display_key: data.display_key,
                            status: license_status,
                            activation_id: data.activation.as_ref().map(|a| a.id.clone()),
                            customer_email: data.customer.as_ref().map(|c| c.email.clone()),
                            customer_name: data.customer.as_ref().and_then(|c| c.name.clone()),
                            benefit_id: Some(data.benefit_id),
                            expires_at: data.expires_at,
                            limit_activations: data.limit_activations,
                            usage: data.usage,
                            limit_usage: data.limit_usage,
                            validations: data.validations,
                            last_validated_at: data.last_validated_at,
                            device_id: device_id.clone(),
                            device_label: device_label.clone(),
                        });
                    } else if status.as_u16() == 404 {
                        // License or activation not found - clear cache
                        warn!("License not found on server - clearing cache");
                        let _ = clear_cache();
                        return Err("License not found. Please activate again.".to_string());
                    } else {
                        warn!("Validation failed: {} - {}", status, body);
                        // Fall through to offline validation
                    }
                }
                Err(e) => {
                    warn!("Network error during validation: {}", e);
                    // Fall through to offline validation
                }
            }
            
            // Offline validation - check grace period
            return self.validate_offline(cached, &device_id, &device_label);
        }
        
        Err("No license activated. Please enter your license key.".to_string())
    }
    
    /// Validate license offline using cache
    fn validate_offline(&self, cache: &CachedLicense, device_id: &str, device_label: &str) -> Result<LicenseInfo, String> {
        // Check last validation time
        if let Ok(last_validated) = chrono::DateTime::parse_from_rfc3339(&cache.last_validated_at) {
            let hours_since = (chrono::Utc::now() - last_validated.with_timezone(&chrono::Utc)).num_hours();
            
            if hours_since < OFFLINE_GRACE_HOURS && cache.status == "granted" {
                info!("Using offline license (validated {} hours ago)", hours_since);
                
                // Check expiration even offline
                if let Some(ref expires_at) = cache.expires_at {
                    if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expires_at) {
                        if expiry < chrono::Utc::now() {
                            return Err("License has expired.".to_string());
                        }
                    }
                }
                
                return Ok(LicenseInfo {
                    license_key: cache.license_key.clone(),
                    display_key: mask_key(&cache.license_key),
                    status: LicenseStatus::Offline,
                    activation_id: Some(cache.activation_id.clone()),
                    customer_email: cache.customer_email.clone(),
                    customer_name: cache.customer_name.clone(),
                    benefit_id: Some(cache.benefit_id.clone()),
                    expires_at: cache.expires_at.clone(),
                    limit_activations: None,
                    usage: 0,
                    limit_usage: None,
                    validations: 0,
                    last_validated_at: Some(cache.last_validated_at.clone()),
                    device_id: device_id.to_string(),
                    device_label: device_label.to_string(),
                });
            }
            
            error!("Offline grace period expired ({} hours since last validation)", hours_since);
        }
        
        Err("License validation failed and offline grace period expired. Please connect to the internet.".to_string())
    }
    
    /// Deactivate license from this device
    pub async fn deactivate(&self) -> Result<(), String> {
        let cache = load_cache()
            .ok_or("No license to deactivate")?;
        
        info!("Deactivating license from device...");
        
        let request = DeactivateRequest {
            key: cache.license_key.clone(),
            organization_id: self.org_id.clone(),
            activation_id: cache.activation_id.clone(),
        };
        
        let url = format!("{}/deactivate", POLAR_API_BASE);
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        let status = response.status();
        
        // 204 No Content = success
        if status.is_success() || status.as_u16() == 204 {
            info!("License deactivated successfully");
            clear_cache()?;
            Ok(())
        } else if status.as_u16() == 404 {
            // Already deactivated or not found - clear local anyway
            warn!("Activation not found on server - clearing local cache");
            clear_cache()?;
            Ok(())
        } else {
            let body = response.text().await.unwrap_or_default();
            error!("Deactivation failed: {} - {}", status, body);
            Err(format!("Deactivation failed: HTTP {}", status))
        }
    }
    
    /// Check if license is currently valid (quick local check)
    pub fn is_valid(&self) -> bool {
        if let Some(cache) = load_cache() {
            // Check status
            if cache.status != "granted" {
                return false;
            }
            
            // Check expiration
            if let Some(ref expires_at) = cache.expires_at {
                if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expires_at) {
                    if expiry < chrono::Utc::now() {
                        return false;
                    }
                }
            }
            
            // Check offline grace period
            if let Ok(last_validated) = chrono::DateTime::parse_from_rfc3339(&cache.last_validated_at) {
                let hours_since = (chrono::Utc::now() - last_validated.with_timezone(&chrono::Utc)).num_hours();
                return hours_since < OFFLINE_GRACE_HOURS;
            }
        }
        
        false
    }
    
    /// Get cached license info without validation
    pub fn get_cached_info(&self) -> Option<LicenseInfo> {
        let cache = load_cache()?;
        let device_id = get_device_id();
        let device_label = get_device_label();
        
        Some(LicenseInfo {
            license_key: cache.license_key.clone(),
            display_key: mask_key(&cache.license_key),
            status: LicenseStatus::from_polar_status(&cache.status),
            activation_id: Some(cache.activation_id),
            customer_email: cache.customer_email,
            customer_name: cache.customer_name,
            benefit_id: Some(cache.benefit_id),
            expires_at: cache.expires_at,
            limit_activations: None,
            usage: 0,
            limit_usage: None,
            validations: 0,
            last_validated_at: Some(cache.last_validated_at),
            device_id,
            device_label,
        })
    }
    
    /// Determine license status from license key data
    fn check_license_status(&self, key: &PolarLicenseKey) -> LicenseStatus {
        // Check Polar status
        match key.status.as_str() {
            "revoked" => return LicenseStatus::Revoked,
            "disabled" => return LicenseStatus::Disabled,
            _ => {}
        }
        
        // Check expiration
        if let Some(ref expires_at) = key.expires_at {
            if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expires_at) {
                if expiry < chrono::Utc::now() {
                    return LicenseStatus::Expired;
                }
            }
        }
        
        LicenseStatus::Granted
    }
    
    /// Determine license status from validate response
    fn check_license_status_from_validate(&self, data: &ValidateResponse) -> LicenseStatus {
        // Check Polar status
        match data.status.as_str() {
            "revoked" => return LicenseStatus::Revoked,
            "disabled" => return LicenseStatus::Disabled,
            _ => {}
        }
        
        // Check expiration
        if let Some(ref expires_at) = data.expires_at {
            if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expires_at) {
                if expiry < chrono::Utc::now() {
                    return LicenseStatus::Expired;
                }
            }
        }
        
        LicenseStatus::Granted
    }
}

impl Default for LicenseManager {
    fn default() -> Self {
        Self::new()
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Mask license key for display
fn mask_key(key: &str) -> String {
    if key.len() <= 8 {
        return "****".to_string();
    }
    
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() >= 2 {
        format!("****-{}", parts.last().unwrap_or(&"****"))
    } else {
        format!("****{}", &key[key.len().saturating_sub(6)..])
    }
}

// =============================================================================
// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_device_id_is_stable() {
        let id1 = get_device_id();
        let id2 = get_device_id();
        assert_eq!(id1, id2);
        assert!(id1.starts_with("WVT-"));
    }
    
    #[test]
    fn test_device_label() {
        let label = get_device_label();
        assert!(!label.is_empty());
        assert!(label.contains('('));
    }
    
    #[test]
    fn test_mask_key() {
        assert_eq!(mask_key("ABC"), "****");
        assert_eq!(mask_key("ABC-DEF-GHI-JKL"), "****-JKL");
    }
    
    #[test]
    fn test_license_status_allows_usage() {
        assert!(LicenseStatus::Granted.allows_usage());
        assert!(LicenseStatus::Offline.allows_usage());
        assert!(!LicenseStatus::Revoked.allows_usage());
        assert!(!LicenseStatus::Expired.allows_usage());
    }
}
