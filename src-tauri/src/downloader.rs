use futures_util::StreamExt;
use reqwest::Client;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

pub struct ModelDownloader {
    client: Client,
    models_dir: PathBuf,
}

#[derive(Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub model_id: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percentage: f32,
}

impl ModelDownloader {
    pub fn new(models_dir: PathBuf) -> Self {
        Self {
            client: Client::new(),
            models_dir,
        }
    }

    pub fn get_model_path(&self, model_id: &str) -> PathBuf {
        self.models_dir
            .join(crate::transcription::get_model_filename(model_id))
    }

    pub fn is_model_downloaded(&self, model_id: &str) -> bool {
        if let Some(files) = crate::transcription::get_parakeet_files(model_id) {
            let model_dir = self.get_model_path(model_id);
            return model_dir.is_dir()
                && files
                    .iter()
                    .all(|file| model_dir.join(file.filename).is_file());
        }

        self.get_model_path(model_id).exists()
    }

    pub async fn download_model<F>(
        &self,
        model_id: &str,
        progress_callback: F,
    ) -> Result<PathBuf, String>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        if crate::transcription::get_parakeet_files(model_id).is_some() {
            return self
                .download_parakeet_model(model_id, progress_callback)
                .await;
        }

        let url = crate::transcription::get_model_url(model_id)
            .ok_or_else(|| format!("Unknown model: {}", model_id))?;

        // Security: Enforce HTTPS only
        if !url.starts_with("https://") {
            return Err("Security error: Only HTTPS URLs are allowed for downloads".to_string());
        }

        // Create models directory if it doesn't exist
        tokio::fs::create_dir_all(&self.models_dir)
            .await
            .map_err(|e| format!("Failed to create models directory: {}", e))?;

        let model_path = self.get_model_path(model_id);
        let temp_path = model_path.with_extension("bin.tmp");

        // Start download
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to start download: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Download failed with status: {}",
                response.status()
            ));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let mut file = File::create(&temp_path)
            .await
            .map_err(|e| format!("Failed to create temp file: {}", e))?;

        let mut stream = response.bytes_stream();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;

            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Failed to write chunk: {}", e))?;

            downloaded += chunk.len() as u64;

            let percentage = if total_size > 0 {
                (downloaded as f32 / total_size as f32) * 100.0
            } else {
                0.0
            };

            progress_callback(DownloadProgress {
                model_id: model_id.to_string(),
                bytes_downloaded: downloaded,
                total_bytes: total_size,
                percentage,
            });
        }

        file.flush()
            .await
            .map_err(|e| format!("Failed to flush file: {}", e))?;

        // Rename temp file to final path
        tokio::fs::rename(&temp_path, &model_path)
            .await
            .map_err(|e| format!("Failed to rename temp file: {}", e))?;

        Ok(model_path)
    }

    async fn download_parakeet_model<F>(
        &self,
        model_id: &str,
        progress_callback: F,
    ) -> Result<PathBuf, String>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        let files = crate::transcription::get_parakeet_files(model_id)
            .ok_or_else(|| format!("Unknown Parakeet model: {}", model_id))?;

        tokio::fs::create_dir_all(&self.models_dir)
            .await
            .map_err(|e| format!("Failed to create models directory: {}", e))?;

        let model_dir = self.get_model_path(model_id);
        tokio::fs::create_dir_all(&model_dir)
            .await
            .map_err(|e| format!("Failed to create Parakeet model directory: {}", e))?;

        let mut total_size = 0u64;
        for file in files {
            if !file.url.starts_with("https://") {
                return Err("Security error: Only HTTPS URLs are allowed for downloads".to_string());
            }

            if let Ok(response) = self.client.head(file.url).send().await {
                if response.status().is_success() {
                    total_size = total_size.saturating_add(response.content_length().unwrap_or(0));
                }
            }
        }

        let mut total_downloaded = 0u64;

        for file in files {
            let final_path = model_dir.join(file.filename);
            let temp_path = final_path.with_extension("tmp");

            let response =
                self.client.get(file.url).send().await.map_err(|e| {
                    format!("Failed to start download for {}: {}", file.filename, e)
                })?;

            if !response.status().is_success() {
                return Err(format!(
                    "Download failed for {} with status: {}",
                    file.filename,
                    response.status()
                ));
            }

            let file_size = response.content_length().unwrap_or(0);
            if total_size == 0 {
                total_size = total_size.saturating_add(file_size);
            }

            let mut output = File::create(&temp_path)
                .await
                .map_err(|e| format!("Failed to create temp file for {}: {}", file.filename, e))?;

            let mut stream = response.bytes_stream();
            while let Some(chunk) = stream.next().await {
                let chunk =
                    chunk.map_err(|e| format!("Download error for {}: {}", file.filename, e))?;

                output
                    .write_all(&chunk)
                    .await
                    .map_err(|e| format!("Failed to write {}: {}", file.filename, e))?;

                total_downloaded = total_downloaded.saturating_add(chunk.len() as u64);

                let percentage = if total_size > 0 {
                    (total_downloaded as f32 / total_size as f32 * 100.0).min(100.0)
                } else {
                    0.0
                };

                progress_callback(DownloadProgress {
                    model_id: model_id.to_string(),
                    bytes_downloaded: total_downloaded,
                    total_bytes: total_size,
                    percentage,
                });
            }

            output
                .flush()
                .await
                .map_err(|e| format!("Failed to flush {}: {}", file.filename, e))?;

            tokio::fs::rename(&temp_path, &final_path)
                .await
                .map_err(|e| format!("Failed to finalize {}: {}", file.filename, e))?;
        }

        progress_callback(DownloadProgress {
            model_id: model_id.to_string(),
            bytes_downloaded: total_downloaded,
            total_bytes: total_size,
            percentage: 100.0,
        });

        Ok(model_dir)
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let model_path = self.get_model_path(model_id);

        if model_path.is_dir() {
            tokio::fs::remove_dir_all(&model_path)
                .await
                .map_err(|e| format!("Failed to delete model: {}", e))?;
        } else if model_path.exists() {
            tokio::fs::remove_file(&model_path)
                .await
                .map_err(|e| format!("Failed to delete model: {}", e))?;
        }

        Ok(())
    }

    pub fn get_downloaded_models(&self) -> Vec<String> {
        let models = [
            "tiny",
            "base",
            "small",
            "medium",
            "large",
            "large-v3",
            "large-v3-turbo",
            "tiny.en",
            "base.en",
            "small.en",
            "medium.en",
            "distil-small.en",
            "distil-medium.en",
            "distil-large-v2",
            "distil-large-v3",
            "parakeet-v2",
            "parakeet-v3",
        ];
        models
            .iter()
            .filter(|&&id| self.is_model_downloaded(id))
            .map(|&s| s.to_string())
            .collect()
    }
}
