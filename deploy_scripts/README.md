# Airbyte POC Deployment Scripts

This folder contains scripts and documentation for deploying the Airbyte POC with a self-hosted Airbyte instance.

## Files Overview

- `AIRBYTE_SELF_HOSTED_SOLUTION.md` - Explains the source definitions problem and self-hosted solution
- `run-self-hosted-airbyte.sh` - Script to set up self-hosted Airbyte on a machine with Docker
- `airbyte-client-self-hosted.js` - Updated AirbyteClient implementation for self-hosted Airbyte
- `setup-self-hosted-simplified.sh` - Script for setting up Airbyte on a GCP VM
- `install-gcloud-m1.sh` - Script for installing Google Cloud SDK on M1 Macs
- `DEPLOYMENT_M1.md` - Deployment instructions for M1 Mac users
- Other deployment-related scripts and files

## Quick Start

If you already have a machine with Docker installed and want to run self-hosted Airbyte:

1. Make the script executable:
   ```bash
   chmod +x run-self-hosted-airbyte.sh
   ```

2. Run the script:
   ```bash
   ./run-self-hosted-airbyte.sh
   ```

3. Access the applications:
   - Airbyte UI: http://localhost:8000
   - Airbyte POC application: http://localhost:3000

## Understanding the Solution

For a detailed explanation of why we're using self-hosted Airbyte instead of Airbyte Cloud, see `AIRBYTE_SELF_HOSTED_SOLUTION.md`.
