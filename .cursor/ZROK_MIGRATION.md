# Migration from ngrok to zrok

This project has been migrated from ngrok to [zrok](https://zrok.io/), an open-source alternative built on OpenZiti.

## What Changed

1. **Installation**: Updated `.cursor/install.sh` to install zrok instead of ngrok
2. **Environment**: Updated `.cursor/environment.json` to use zrok commands
3. **No API tokens needed**: zrok uses account-based authentication instead of tokens

## Setup Instructions

### 1. Install zrok (if not already installed)

The install script will automatically install zrok. Or install manually:

```bash
# Download latest release
ZROK_VERSION=$(curl -s https://api.github.com/repos/openziti/zrok/releases/latest | grep '"tag_name"' | cut -d '"' -f 4)
curl -sL "https://github.com/openziti/zrok/releases/download/${ZROK_VERSION}/zrok_${ZROK_VERSION#v}_linux_amd64.tar.gz" -o /tmp/zrok.tar.gz
tar -xzf /tmp/zrok.tar.gz -C /tmp
sudo mv /tmp/zrok /usr/local/bin/zrok
sudo chmod +x /usr/local/bin/zrok
```

### 2. Create Account and Enable

```bash
# Create account (first time only)
zrok invite

# Enable zrok in your environment
zrok enable
```

### 3. Share Your Supabase API

The environment terminal will automatically run:
```bash
zrok share public http://localhost:54321 --backend-mode proxy
```

Or manually:
```bash
# Public sharing (accessible to anyone with the URL)
zrok share public http://localhost:54321 --backend-mode proxy

# Private sharing (only accessible to invited zrok users)
zrok share private http://localhost:54321 --backend-mode proxy

# For web applications, you can also use:
zrok share public http://localhost:54321 --backend-mode web
```

## Differences from ngrok

| Feature | ngrok | zrok |
|---------|-------|------|
| **License** | Proprietary (free tier limited) | Open Source |
| **Authentication** | API token | Account-based |
| **Public Sharing** | ✅ | ✅ |
| **Private Sharing** | ❌ | ✅ (zero-trust) |
| **Simultaneous Tunnels** | Limited on free tier | Unlimited |
| **Self-hosting** | ❌ | ✅ |

## Getting Your Public URL

When you run `zrok share public`, it will output a URL like:
```
https://your-share.zrok.io
```

You can also check active shares:
```bash
zrok list
```

## Troubleshooting

### zrok command not found
- Make sure zrok is installed: `which zrok`
- Check PATH includes `/usr/local/bin`

### Authentication errors
- Run `zrok invite` to create an account
- Run `zrok enable` to authenticate your shell

### Port already in use
- Make sure Supabase is running on port 54321
- Check with: `netstat -tlnp | grep 54321`

## Resources

- [zrok Documentation](https://zrok.io/docs)
- [zrok GitHub](https://github.com/openziti/zrok)
- [OpenZiti](https://openziti.io/)
