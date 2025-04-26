# Deploying Airbyte POC on GCP (for M1 Mac)

This guide will help you deploy the Airbyte POC application on a Google Cloud Platform (GCP) virtual machine with a self-hosted Airbyte instance, specifically tailored for M1 Mac users.

## Prerequisites

- An M1 Mac (Apple Silicon)
- A GCP project with billing enabled
- Permissions to create VM instances and firewall rules

## Step 1: Install Google Cloud SDK for M1 Mac

First, you need to install the ARM-compatible version of Google Cloud SDK:

```bash
# Make the installation script executable
chmod +x install-gcloud-m1.sh

# Run the installation script
./install-gcloud-m1.sh

# Initialize gcloud (follow the prompts to log in and select your project)
gcloud init
```

## Step 2: Create the GCP VM

Now that you have gcloud installed, create a GCP VM with Docker pre-installed:

```bash
# Create a VM instance
gcloud compute instances create airbyte-poc-vm \
  --machine-type=e2-medium \
  --zone=us-central1-a \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --tags=http-server,https-server

# Create firewall rules
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags=http-server \
  --description="Allow HTTP traffic"

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags=https-server \
  --description="Allow HTTPS traffic"

gcloud compute firewall-rules create allow-airbyte-ui \
  --allow tcp:8000 \
  --target-tags=http-server \
  --description="Allow Airbyte UI traffic"

gcloud compute firewall-rules create allow-app-port \
  --allow tcp:3000 \
  --target-tags=http-server \
  --description="Allow application traffic"
```

## Step 3: SSH into the VM

After the VM is created, SSH into it:

```bash
gcloud compute ssh airbyte-poc-vm --zone=us-central1-a
```

## Step 4: Set up Airbyte and the POC Application

Once you're connected to the VM, run the setup script:

```bash
# Create the setup script
sudo nano setup-self-hosted.sh

# Paste the content of the setup-self-hosted.sh file
# Save and exit (Ctrl+X, then Y, then Enter)

# Make the script executable and run it
chmod +x setup-self-hosted.sh
./setup-self-hosted.sh
```

## Step 5: Access the Applications

After the setup is complete, you can access:

- Airbyte UI: http://YOUR_VM_IP:8000
- Airbyte POC application: http://YOUR_VM_IP:3000

To get your VM's external IP, run:

```bash
gcloud compute instances describe airbyte-poc-vm --zone=us-central1-a --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

## Troubleshooting

If you encounter any issues:

1. Check the Airbyte logs:
```bash
cd /opt/airbyte
sudo docker-compose logs -f
```

2. Check the POC application logs:
```bash
cd /opt/airbyte-poc
sudo npm start
```

3. Make sure all ports are open:
```bash
sudo netstat -tulpn | grep -E '8000|3000'
```

## Cleanup

When you're done, you can delete the VM to avoid incurring charges:

```bash
gcloud compute instances delete airbyte-poc-vm --zone=us-central1-a
```

Also delete the firewall rules:

```bash
gcloud compute firewall-rules delete allow-http allow-https allow-airbyte-ui allow-app-port
```
