#!/bin/bash
set -e

# Download the ARM-compatible version of Google Cloud SDK
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-458.0.0-darwin-arm.tar.gz

# Extract the archive
tar -xf google-cloud-cli-458.0.0-darwin-arm.tar.gz

# Run the installer
./google-cloud-sdk/install.sh

# Add to path for current session
export PATH=$PATH:$PWD/google-cloud-sdk/bin

# Verify installation
gcloud --version

echo "Google Cloud SDK installed successfully!"
echo "Please run 'gcloud init' to configure your account and project."
echo "You may need to restart your terminal or run 'source ~/.zshrc' (or ~/.bashrc) to use gcloud."
