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

# Step 4: Install zrok (open-source alternative to ngrok)
# Download latest zrok release for Linux AMD64
ZROK_VERSION=$(curl -s https://api.github.com/repos/openziti/zrok/releases/latest | grep '"tag_name"' | cut -d '"' -f 4)
ZROK_URL="https://github.com/openziti/zrok/releases/download/${ZROK_VERSION}/zrok_${ZROK_VERSION#v}_linux_amd64.tar.gz"
curl -sL "$ZROK_URL" -o /tmp/zrok.tar.gz
tar -xzf /tmp/zrok.tar.gz -C /tmp
sudo mv /tmp/zrok /usr/local/bin/zrok
sudo chmod +x /usr/local/bin/zrok
rm /tmp/zrok.tar.gz
# Initialize zrok (user will need to run 'zrok invite' to create account)
echo "zrok installed successfully. Run 'zrok invite' to create an account, then 'zrok enable' to enable sharing."

# Note: After adding user to docker group, you may need to:
# - Start a new session (logout/login), OR
# - Run `newgrp docker` to activate the docker group in current session, OR  
# - Use `sudo` for docker commands until a new session is started
