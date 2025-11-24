#!/bin/bash

# Step 1: Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
rm get-docker.sh

# Step 2: Configure Docker daemon
sudo cp .cursor/daemon.json /etc/docker/daemon.json

# Start Docker service (with error handling for already running)
sudo service docker start || true

# Step 3: Install npm dependencies
npm install

# Step 4: Install zgrok
# Install zgrok using the official installer
curl -fsSL https://zgrok.io/install.sh | sh
zgrok config add-authtoken $ZGROK_TOKEN

# Note: After adding user to docker group, you may need to:
# - Start a new session (logout/login), OR
# - Run `newgrp docker` to activate the docker group in current session, OR  
# - Use `sudo` for docker commands until a new session is started
