use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Sample, SampleFormat};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::{self, JoinHandle};

// Pre-allocate buffer for ~30 seconds of 16kHz mono audio
// This reduces dynamic allocations during recording
const INITIAL_BUFFER_CAPACITY: usize = 16000 * 30;

pub enum RecorderCommand {
    Stop,
}

pub struct AudioRecorder {
    samples: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
    command_sender: Option<mpsc::Sender<RecorderCommand>>,
    thread_handle: Option<JoinHandle<()>>,
}

// Make AudioRecorder Send + Sync by not storing the Stream
unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            samples: Arc::new(Mutex::new(Vec::with_capacity(INITIAL_BUFFER_CAPACITY))),
            is_recording: Arc::new(AtomicBool::new(false)),
            command_sender: None,
            thread_handle: None,
        })
    }

    pub fn start_recording(&mut self) -> Result<(), String> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Err("Already recording".to_string());
        }

        // Clear previous samples but keep capacity
        {
            let mut samples = self.samples.lock().unwrap();
            samples.clear();
            // Ensure we have enough capacity pre-allocated
            let current_capacity = samples.capacity();
            if current_capacity < INITIAL_BUFFER_CAPACITY {
                samples.reserve(INITIAL_BUFFER_CAPACITY - current_capacity);
            }
        }

        let (cmd_tx, cmd_rx) = mpsc::channel::<RecorderCommand>();
        let samples = self.samples.clone();
        let is_recording = self.is_recording.clone();

        is_recording.store(true, Ordering::SeqCst);

        let handle = thread::spawn(move || {
            if let Err(e) = run_recording_thread(cmd_rx, samples, is_recording) {
                eprintln!("Recording thread error: {}", e);
            }
        });

        self.command_sender = Some(cmd_tx);
        self.thread_handle = Some(handle);

        Ok(())
    }

    pub fn stop_recording(&mut self) -> Result<Vec<f32>, String> {
        self.is_recording.store(false, Ordering::SeqCst);

        // Signal thread to stop
        if let Some(sender) = self.command_sender.take() {
            let _ = sender.send(RecorderCommand::Stop);
        }

        // Wait for thread to finish
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }

        // No delay needed - samples are already collected via mutex
        // The stream is already stopped at this point

        let samples = self.samples.lock().unwrap().clone();

        if samples.is_empty() {
            return Err("No audio recorded".to_string());
        }

        Ok(samples)
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn cancel_recording(&mut self) {
        self.is_recording.store(false, Ordering::SeqCst);

        if let Some(sender) = self.command_sender.take() {
            let _ = sender.send(RecorderCommand::Stop);
        }

        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }

        self.samples.lock().unwrap().clear();
    }
}

fn run_recording_thread(
    cmd_rx: mpsc::Receiver<RecorderCommand>,
    samples: Arc<Mutex<Vec<f32>>>,
    is_recording: Arc<AtomicBool>,
) -> Result<(), String> {
    println!("[AUDIO] Recording thread started");

    let host = cpal::default_host();
    println!("[AUDIO] Host: {:?}", host.id());

    let device = host
        .default_input_device()
        .ok_or("No input device available")?;

    println!("[AUDIO] Device: {:?}", device.name().unwrap_or_default());

    let config = device
        .default_input_config()
        .map_err(|e| format!("Failed to get default input config: {}", e))?;

    println!(
        "[AUDIO] Sample rate: {}, Channels: {}, Format: {:?}",
        config.sample_rate().0,
        config.channels(),
        config.sample_format()
    );

    let sample_rate = config.sample_rate().0;
    let channels = config.channels() as usize;
    let target_sample_rate = 16000u32; // Whisper expects 16kHz

    let err_fn = |err| eprintln!("[AUDIO ERROR] Audio stream error: {}", err);

    let stream = match config.sample_format() {
        SampleFormat::F32 => {
            let samples = samples.clone();
            let is_recording = is_recording.clone();
            device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    if is_recording.load(Ordering::SeqCst) {
                        process_audio_data(
                            data,
                            channels,
                            sample_rate,
                            target_sample_rate,
                            &samples,
                        );
                    }
                },
                err_fn,
                None,
            )
        }
        SampleFormat::I16 => {
            let samples = samples.clone();
            let is_recording = is_recording.clone();
            device.build_input_stream(
                &config.into(),
                move |data: &[i16], _: &_| {
                    if is_recording.load(Ordering::SeqCst) {
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s.to_float_sample()).collect();
                        process_audio_data(
                            &float_data,
                            channels,
                            sample_rate,
                            target_sample_rate,
                            &samples,
                        );
                    }
                },
                err_fn,
                None,
            )
        }
        SampleFormat::U16 => {
            let samples = samples.clone();
            let is_recording = is_recording.clone();
            device.build_input_stream(
                &config.into(),
                move |data: &[u16], _: &_| {
                    if is_recording.load(Ordering::SeqCst) {
                        let float_data: Vec<f32> =
                            data.iter().map(|&s| s.to_float_sample()).collect();
                        process_audio_data(
                            &float_data,
                            channels,
                            sample_rate,
                            target_sample_rate,
                            &samples,
                        );
                    }
                },
                err_fn,
                None,
            )
        }
        _ => return Err("Unsupported sample format".to_string()),
    }
    .map_err(|e| format!("Failed to build input stream: {}", e))?;

    stream
        .play()
        .map_err(|e| format!("Failed to start stream: {}", e))?;

    // Wait for stop command with minimal latency
    // Using 5ms polling for near-instant response when user stops recording
    loop {
        if let Ok(RecorderCommand::Stop) = cmd_rx.try_recv() {
            break;
        }
        if !is_recording.load(Ordering::SeqCst) {
            break;
        }
        thread::sleep(std::time::Duration::from_millis(5));
    }    // Stream is dropped here, stopping the recording
    Ok(())
}

fn process_audio_data(
    data: &[f32],
    channels: usize,
    source_rate: u32,
    target_rate: u32,
    samples: &Arc<Mutex<Vec<f32>>>,
) {
    // Convert to mono if stereo
    let mono: Vec<f32> = if channels > 1 {
        data.chunks(channels)
            .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
            .collect()
    } else {
        data.to_vec()
    };

    // Simple resampling (linear interpolation)
    let resampled = if source_rate != target_rate {
        resample(&mono, source_rate, target_rate)
    } else {
        mono
    };

    samples.lock().unwrap().extend(resampled);
}

fn resample(samples: &[f32], source_rate: u32, target_rate: u32) -> Vec<f32> {
    let ratio = source_rate as f64 / target_rate as f64;
    let output_len = (samples.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac as f32) + samples[idx + 1] * frac as f32
        } else if idx < samples.len() {
            samples[idx]
        } else {
            0.0
        };

        output.push(sample);
    }

    output
}

// Save audio to WAV file for debugging
// Save audio to WAV file
pub fn save_wav(samples: &[f32], path: &str) -> Result<(), String> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: 16000,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::create(path, spec)
        .map_err(|e| format!("Failed to create WAV file: {}", e))?;

    for &sample in samples {
        let amplitude = (sample * 32767.0) as i16;
        writer
            .write_sample(amplitude)
            .map_err(|e| format!("Failed to write sample: {}", e))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize WAV: {}", e))?;

    Ok(())
}
