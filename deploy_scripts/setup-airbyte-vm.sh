#!/bin/bash
set -e

# Create a minimal GCP VM with Docker pre-installed
echo "Creating GCP VM with Docker..."
gcloud compute instances create airbyte-poc-vm \
  --machine-type=e2-medium \
  --zone=us-central1-a \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server \
  --metadata=startup-script='#! /bin/bash
# Install Docker
apt-get update
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create a directory for the project
mkdir -p /opt/airbyte-poc
'

# Allow HTTP/HTTPS traffic
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags=http-server \
  --description="Allow HTTP traffic"

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags=https-server \
  --description="Allow HTTPS traffic"

# Allow Airbyte UI port
gcloud compute firewall-rules create allow-airbyte-ui \
  --allow tcp:8000 \
  --target-tags=http-server \
  --description="Allow Airbyte UI traffic"

# Allow our app port
gcloud compute firewall-rules create allow-app-port \
  --allow tcp:3000 \
  --target-tags=http-server \
  --description="Allow application traffic"

echo "VM created successfully. Now you can SSH into it:"
echo "gcloud compute ssh airbyte-poc-vm --zone=us-central1-a"
