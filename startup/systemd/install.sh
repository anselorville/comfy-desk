#!/usr/bin/env bash
# install.sh — install the three ComfyDesk units into /etc/systemd/system
set -euo pipefail
cd "$(dirname "$0")"
sudo cp comfydesk-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable comfydesk-comfyui.service comfydesk-gateway.service comfydesk-frontend.service
echo "installed + enabled (not started). use: sudo systemctl start comfydesk-*"
