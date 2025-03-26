import * as fs from 'fs';
import * as path from 'path';
import { networkInterfaces } from 'os';

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal IPs and non-IPv4 addresses
      if (net.internal || net.family !== 'IPv4') continue;
      return net.address;
    }
  }
  return 'localhost';
}

function generateEnvFile() {
  const localIP = getLocalIP();
  const examplePath = path.join(process.cwd(), '.env.local.example');
  const targetPath = path.join(process.cwd(), '.env.local');

  // Read the example file
  const envExample = fs.readFileSync(examplePath, 'utf8');

  // Replace the IP placeholders with actual IP
  const envContent = envExample.replaceAll('LOCAL_IP', localIP);

  // Write the new .env.local file
  fs.writeFileSync(targetPath, envContent);
  console.log(`Generated .env.local with IP: ${localIP}`);
}

generateEnvFile();
