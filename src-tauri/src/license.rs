use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use log::{info, warn, error};

// Polar.sh API base URL
const POLAR_API_BASE: &str = "https://api.polar.sh/v1/customer-portal/license-keys";

// Your Polar organization ID - REPLACE WITH YOUR ACTUAL ORG ID
const POLAR_ORG_ID: &str = "YOUR_POLAR_ORGANIZATION_ID";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub key: String,
    pub status: LicenseStatus,
    pub customer_email: Option<String>,
    pub customer_name: Option<String>,
    pub expires_at: Option<String>,
    pub activation_id: Option<String>,
    pub activations_limit: Option<i32>,
    pub activations_used: Option<i32>,
    pub benefit_id: Option<String>,
    pub validated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LicenseStatus {
    Valid,
    Invalid,
    Expired,
    Revoked,
    Disabled,
    NotActivated,
    ActivationLimitReached,
    Unknown,
}

impl Default for LicenseStatus {
    fn default() -> Self {
        LicenseStatus::Unknown
    }
}

impl From<&str> for LicenseStatus {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "granted" => LicenseStatus::Valid,
            "revoked" => LicenseStatus::Revoked,
            "disabled" => LicenseStatus::Disabled,
            _ => LicenseStatus::Unknown,
        }
    }
}

// Polar API Response Types
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PolarValidateResponse {
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

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PolarCustomer {
    pub id: String,
    pub email: String,
    pub name: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PolarActivation {
    pub id: String,
    pub license_key_id: String,
    pub label: String,
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PolarActivateResponse {
    pub id: String,
    pub license_key_id: String,
    pub label: String,
    pub meta: Option<serde_json::Value>,
    pub created_at: String,
    pub license_key: PolarValidateResponse,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PolarErrorResponse {
    pub error: Option<String>,
    pub detail: Option<String>,
}

// Request types
#[derive(Debug, Serialize)]
struct ValidateRequest {
    key: String,
    organization_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    activation_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ActivateRequest {
    key: String,
    organization_id: String,
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    meta: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct DeactivateRequest {
    key: String,
    organization_id: String,
    activation_id: String,
}

pub struct LicenseClient {
    client: Client,
    org_id: String,
}

impl LicenseClient {
    pub fn new(org_id: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            org_id: org_id.unwrap_or_else(|| POLAR_ORG_ID.to_string()),
        }
    }

    /// Validate a license key with Polar
    pub async fn validate(&self, key: &str, activation_id: Option<&str>) -> Result<LicenseInfo, String> {
        let url = format!("{}/validate", POLAR_API_BASE);
        
        let request_body = ValidateRequest {
            key: key.to_string(),
            organization_id: self.org_id.clone(),
            activation_id: activation_id.map(String::from),
        };

        info!("Validating license key with Polar API");

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = response.status();
        
        if status.is_success() {
            let data: PolarValidateResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let license_status = self.determine_license_status(&data);

            Ok(LicenseInfo {
                key: data.display_key,
                status: license_status,
                customer_email: data.customer.as_ref().map(|c| c.email.clone()),
                customer_name: data.customer.as_ref().and_then(|c| c.name.clone()),
                expires_at: data.expires_at,
                activation_id: data.activation.as_ref().map(|a| a.id.clone()),
                activations_limit: data.limit_activations,
                activations_used: Some(data.validations),
                benefit_id: Some(data.benefit_id),
                validated_at: data.last_validated_at,
            })
        } else if status.as_u16() == 404 {
            warn!("License key not found");
            Ok(LicenseInfo {
                key: mask_license_key(key),
                status: LicenseStatus::Invalid,
                customer_email: None,
                customer_name: None,
                expires_at: None,
                activation_id: None,
                activations_limit: None,
                activations_used: None,
                benefit_id: None,
                validated_at: None,
            })
        } else {
            let error_body = response.text().await.unwrap_or_default();
            error!("License validation failed: {} - {}", status, error_body);
            Err(format!("Validation failed: {}", status))
        }
    }

    /// Activate a license key on this device
    pub async fn activate(&self, key: &str, device_label: &str, meta: Option<serde_json::Value>) -> Result<LicenseInfo, String> {
        let url = format!("{}/activate", POLAR_API_BASE);
        
        let request_body = ActivateRequest {
            key: key.to_string(),
            organization_id: self.org_id.clone(),
            label: device_label.to_string(),
            meta,
        };

        info!("Activating license key with Polar API");

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = response.status();
        
        if status.is_success() {
            let data: PolarActivateResponse = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            let license_status = self.determine_license_status(&data.license_key);

            Ok(LicenseInfo {
                key: data.license_key.display_key,
                status: license_status,
                customer_email: data.license_key.customer.as_ref().map(|c| c.email.clone()),
                customer_name: data.license_key.customer.as_ref().and_then(|c| c.name.clone()),
                expires_at: data.license_key.expires_at,
                activation_id: Some(data.id),
                activations_limit: data.license_key.limit_activations,
                activations_used: Some(data.license_key.validations),
                benefit_id: Some(data.license_key.benefit_id),
                validated_at: data.license_key.last_validated_at,
            })
        } else if status.as_u16() == 403 {
            warn!("Activation limit reached");
            Err("Activation limit reached. Please deactivate another device first.".to_string())
        } else if status.as_u16() == 404 {
            warn!("License key not found");
            Err("Invalid license key".to_string())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            error!("License activation failed: {} - {}", status, error_body);
            Err(format!("Activation failed: {}", status))
        }
    }

    /// Deactivate a license key from this device
    pub async fn deactivate(&self, key: &str, activation_id: &str) -> Result<(), String> {
        let url = format!("{}/deactivate", POLAR_API_BASE);
        
        let request_body = DeactivateRequest {
            key: key.to_string(),
            organization_id: self.org_id.clone(),
            activation_id: activation_id.to_string(),
        };

        info!("Deactivating license key with Polar API");

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        let status = response.status();
        
        if status.is_success() || status.as_u16() == 204 {
            info!("License deactivated successfully");
            Ok(())
        } else {
            let error_body = response.text().await.unwrap_or_default();
            error!("License deactivation failed: {} - {}", status, error_body);
            Err(format!("Deactivation failed: {}", status))
        }
    }

    fn determine_license_status(&self, data: &PolarValidateResponse) -> LicenseStatus {
        // Check status from Polar
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

        // Check activation limit
        if let Some(limit) = data.limit_activations {
            if data.activation.is_none() && data.validations >= limit {
                return LicenseStatus::ActivationLimitReached;
            }
        }

        // If activation is required but not present
        if data.limit_activations.is_some() && data.activation.is_none() {
            return LicenseStatus::NotActivated;
        }

        LicenseStatus::Valid
    }
}

/// Mask a license key for display (show only last 6 chars)
fn mask_license_key(key: &str) -> String {
    if key.len() <= 6 {
        return "****".to_string();
    }
    format!("****{}", &key[key.len()-6..])
}

/// Get device identifier for activation label
pub fn get_device_label() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    
    let os = std::env::consts::OS;
    
    format!("{} ({})", hostname, os)
}

/// Get device metadata for activation
pub fn get_device_meta() -> serde_json::Value {
    serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "hostname": hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        "app_version": env!("CARGO_PKG_VERSION"),
    })
}
