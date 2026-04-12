#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# launch_lora.sh — LoRA training launcher for kohya_ss
# Supports: SDXL LoRA | Flux LoRA (via sd3 trainer)
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   chmod +x launch_lora.sh
#   ./launch_lora.sh --model sdxl --dataset ./train_dataset --name my_lora
#
# Variables can also be set via environment:
#   BASE_MODEL, TRAIN_DATA_DIR, OUTPUT_DIR, LORA_NAME, KOHYA_DIR
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Defaults ─────────────────────────────────────────────────────────────────
MODEL_TYPE="${MODEL_TYPE:-sdxl}"
BASE_MODEL="${BASE_MODEL:-/volumes/models/checkpoints/sd_xl_base_1.0.safetensors}"
FLUX_MODEL="${FLUX_MODEL:-/volumes/models/unet/flux1-dev.safetensors}"
TRAIN_DATA_DIR="${TRAIN_DATA_DIR:-./train_dataset}"
OUTPUT_DIR="${OUTPUT_DIR:-./lora_output}"
LORA_NAME="${LORA_NAME:-my_lora}"
KOHYA_DIR="${KOHYA_DIR:-../kohya_ss}"
RESOLUTION="${RESOLUTION:-1024}"
BATCH_SIZE="${BATCH_SIZE:-2}"
EPOCHS="${EPOCHS:-10}"
LR="${LR:-1e-4}"
NET_DIM="${NET_DIM:-64}"
NET_ALPHA="${NET_ALPHA:-32}"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --model)   MODEL_TYPE="$2"; shift 2 ;;
    --dataset) TRAIN_DATA_DIR="$2"; shift 2 ;;
    --name)    LORA_NAME="$2"; shift 2 ;;
    --epochs)  EPOCHS="$2"; shift 2 ;;
    --lr)      LR="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUTPUT_DIR"

echo "============================================================"
echo "  ComfyDesk LoRA Training"
echo "  Model type : $MODEL_TYPE"
echo "  Dataset    : $TRAIN_DATA_DIR"
echo "  Output     : $OUTPUT_DIR/$LORA_NAME"
echo "  Epochs     : $EPOCHS  |  LR: $LR"
echo "============================================================"

if [ "$MODEL_TYPE" = "sdxl" ]; then
  # ── SDXL LoRA ──────────────────────────────────────────────────────────────
  accelerate launch \
    --num_processes=1 \
    --num_machines=1 \
    --mixed_precision=bf16 \
    "$KOHYA_DIR/train_network.py" \
    --pretrained_model_name_or_path="$BASE_MODEL" \
    --train_data_dir="$TRAIN_DATA_DIR" \
    --output_dir="$OUTPUT_DIR" \
    --output_name="$LORA_NAME" \
    --resolution="$RESOLUTION,$RESOLUTION" \
    --network_module=networks.lora \
    --network_dim="$NET_DIM" \
    --network_alpha="$NET_ALPHA" \
    --learning_rate="$LR" \
    --unet_lr="$LR" \
    --text_encoder_lr="5e-5" \
    --lr_scheduler=cosine_with_restarts \
    --lr_warmup_steps=100 \
    --train_batch_size="$BATCH_SIZE" \
    --max_train_epochs="$EPOCHS" \
    --save_every_n_epochs=2 \
    --mixed_precision=bf16 \
    --optimizer_type=AdamW8bit \
    --gradient_checkpointing \
    --cache_latents \
    --sdxl \
    --caption_extension=".txt" \
    --bucket_no_upscale \
    --bucket_reso_steps=64 \
    --min_bucket_reso=512 \
    --max_bucket_reso=1536 \
    --logging_dir="./logs" \
    --log_with=tensorboard

elif [ "$MODEL_TYPE" = "flux" ]; then
  # ── Flux LoRA ──────────────────────────────────────────────────────────────
  # Uses kohya_ss sd3 trainer which also supports Flux
  accelerate launch \
    --num_processes=1 \
    --num_machines=1 \
    --mixed_precision=bf16 \
    "$KOHYA_DIR/flux_train_network.py" \
    --pretrained_model_name_or_path="$FLUX_MODEL" \
    --train_data_dir="$TRAIN_DATA_DIR" \
    --output_dir="$OUTPUT_DIR" \
    --output_name="$LORA_NAME" \
    --resolution="$RESOLUTION,$RESOLUTION" \
    --network_module=networks.lora_flux \
    --network_dim="$NET_DIM" \
    --network_alpha="$NET_ALPHA" \
    --learning_rate="$LR" \
    --lr_scheduler=constant \
    --train_batch_size="$BATCH_SIZE" \
    --max_train_epochs="$EPOCHS" \
    --save_every_n_epochs=2 \
    --mixed_precision=bf16 \
    --optimizer_type=AdamW8bit \
    --gradient_checkpointing \
    --cache_latents \
    --caption_extension=".txt" \
    --flux_shift_noise_sigma \
    --logging_dir="./logs" \
    --log_with=tensorboard
else
  echo "Unknown model type: $MODEL_TYPE (use 'sdxl' or 'flux')"
  exit 1
fi

echo ""
echo "✅ Training complete! LoRA saved to: $OUTPUT_DIR/$LORA_NAME.safetensors"
echo "   Copy to ComfyUI: cp $OUTPUT_DIR/$LORA_NAME.safetensors /volumes/models/loras/"
