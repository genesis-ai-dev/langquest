import * as fs from "fs";
import * as path from "path";
import { networkInterfaces } from "os";

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal IPs and non-IPv4 addresses
      if (net.internal || net.family !== "IPv4") continue;
      return net.address;
    }
  }
  return "localhost";
}

function getSupabaseAuthHookUrl(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return "http://host.docker.internal:54321";
  } else if (platform === "darwin") {
    return "http://docker.for.mac.localhost:54321";
  }
  return "http://localhost:54321"; // Default fallback
}

function generateEnvFile() {
  const localIP = getLocalIP();
  const supabaseAuthHookUrl = getSupabaseAuthHookUrl();
  const examplePath = path.join(process.cwd(), ".env.local.example");
  const targetPath = path.join(process.cwd(), ".env.local");

  // Read the example file
  const envExample = fs.readFileSync(examplePath, "utf8");

  // Replace the IP placeholders with actual IP and add Supabase auth hook URL
  const envContent = envExample
    .replaceAll("LOCAL_IP", localIP)
    .replace(
      "SUPABASE_BASE_AUTH_HOOK_URL=",
      `SUPABASE_BASE_AUTH_HOOK_URL=${supabaseAuthHookUrl}`,
    );

  // Write the new .env.local file
  fs.writeFileSync(targetPath, envContent);
  console.log(
    `Generated .env.local with IP: ${localIP} and Supabase auth hook URL: ${supabaseAuthHookUrl}`,
  );
}

generateEnvFile();
