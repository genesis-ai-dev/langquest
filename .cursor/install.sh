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

# Step 4: Install ngrok
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo deb https://ngrok-agent.s3.amazonaws.com bookworm main | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install -y ngrok && ngrok config add-authtoken $NGROK_TOKEN

# Note: After adding user to docker group, you may need to:
# - Start a new session (logout/login), OR
# - Run `newgrp docker` to activate the docker group in current session, OR  
# - Use `sudo` for docker commands until a new session is started
