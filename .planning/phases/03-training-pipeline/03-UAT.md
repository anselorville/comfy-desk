# Phase 3 UAT: Training Pipeline

## Test Cases

### 1. Dataset Viewer
- **Action**: Open the Training page.
- **Expected**: The dataset viewer displays images from the dataset directory.

### 2. Auto-Captioning
- **Action**: Click the batch caption button.
- **Expected**: `.txt` sidecar files are generated for the images without captions.

### 3. LoRA Training Subprocess & Logs
- **Action**: Start a LoRA training job.
- **Expected**: The system mode changes to training, and logs stream into the UI terminal block.

### 4. Output Model Visibility
- **Action**: Navigate to the models section (if implemented).
- **Expected**: You can see output `.safetensors` files.

---
**Status**: IN PROGRESS
