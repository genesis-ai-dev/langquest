import { gateway4sync } from 'default-gateway';
import * as fs from 'fs';
import { networkInterfaces } from 'os';
import * as path from 'path';

function ipToNumber(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

function numberToIp(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff
  ].join('.');
}

function getNetworkAddress(ip: string, netmask: string): string {
  const ipNum = ipToNumber(ip);
  const maskNum = ipToNumber(netmask);
  const networkNum = (ipNum & maskNum) >>> 0;
  return numberToIp(networkNum);
}

function getLocalIP(): string {
  try {
    const gateway = gateway4sync();
    const gatewayIP = gateway.gateway;
    const gatewayInterface = gateway.int;

    if (!gatewayInterface) {
      console.warn(
        'Gateway interface not found, searching all interfaces for matching subnet'
      );
      const nets = networkInterfaces();
      return findIPInGatewaySubnet(gatewayIP, nets);
    }

    const nets = networkInterfaces();
    const interfaceInfo = nets[gatewayInterface];

    if (!interfaceInfo) {
      console.warn(
        `Interface ${gatewayInterface} not found, searching all interfaces for matching subnet`
      );
      return findIPInGatewaySubnet(gatewayIP, nets);
    }

    // First, get the subnet mask from the gateway interface
    let gatewaySubnetMask: string | null = null;
    for (const net of interfaceInfo) {
      if (net.family === 'IPv4' && !net.internal && net.netmask) {
        gatewaySubnetMask = net.netmask;
        break;
      }
    }

    if (!gatewaySubnetMask) {
      console.warn(
        `Could not determine subnet mask from gateway interface, searching all interfaces`
      );
      return findIPInGatewaySubnet(gatewayIP, nets);
    }

    // Calculate the gateway's network address
    const gatewayNetwork = getNetworkAddress(gatewayIP, gatewaySubnetMask);

    // Find an IP on the gateway interface that matches the gateway's subnet (excluding gateway itself)
    for (const net of interfaceInfo) {
      if (
        net.family === 'IPv4' &&
        !net.internal &&
        net.netmask &&
        net.address !== gatewayIP
      ) {
        const localNetwork = getNetworkAddress(net.address, net.netmask);

        if (localNetwork === gatewayNetwork) {
          console.log(
            `Found local IP ${net.address} on interface ${gatewayInterface} matching gateway subnet ${gatewayIP}`
          );
          return net.address;
        }
      }
    }

    // If not found on gateway interface, search all interfaces for matching subnet
    console.warn(
      `No matching IP found on gateway interface ${gatewayInterface}, searching all interfaces`
    );
    return findIPInGatewaySubnet(gatewayIP, nets, gatewaySubnetMask);
  } catch (error) {
    console.warn('Error getting gateway:', error);
    return 'localhost';
  }
}

function findIPInGatewaySubnet(
  gatewayIP: string,
  allInterfaces: ReturnType<typeof networkInterfaces>,
  subnetMask?: string | null
): string {
  // If subnet mask not provided, try to infer it from interfaces
  let gatewaySubnetMask = subnetMask;
  let gatewayNetwork: string | null = null;

  if (gatewaySubnetMask) {
    gatewayNetwork = getNetworkAddress(gatewayIP, gatewaySubnetMask);
  } else {
    // Try to find subnet mask by looking for an interface with an IP in the same network
    for (const name of Object.keys(allInterfaces)) {
      for (const net of allInterfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal && net.netmask) {
          const testNetwork = getNetworkAddress(net.address, net.netmask);
          const gatewayTestNetwork = getNetworkAddress(gatewayIP, net.netmask);

          if (testNetwork === gatewayTestNetwork) {
            gatewaySubnetMask = net.netmask;
            gatewayNetwork = testNetwork;
            break;
          }
        }
      }
      if (gatewayNetwork) break;
    }
  }

  if (!gatewayNetwork || !gatewaySubnetMask) {
    console.warn(
      `Could not determine gateway subnet, falling back to localhost`
    );
    return 'localhost';
  }

  // Search all interfaces for an IP in the same subnet as the gateway (excluding gateway itself)
  for (const name of Object.keys(allInterfaces)) {
    for (const net of allInterfaces[name] || []) {
      if (
        net.family === 'IPv4' &&
        !net.internal &&
        net.netmask &&
        net.address !== gatewayIP
      ) {
        const localNetwork = getNetworkAddress(net.address, net.netmask);

        if (localNetwork === gatewayNetwork) {
          console.log(
            `Found local IP ${net.address} on interface ${name} matching gateway subnet ${gatewayIP}`
          );
          return net.address;
        }
      }
    }
  }

  console.warn(
    `No IP found matching gateway subnet ${gatewayNetwork}, falling back to localhost`
  );
  return 'localhost';
}

function generateEnvFile() {
  const localIP = getLocalIP();
  const examplePath = path.join(process.cwd(), '.env.local.example');
  const targetPath = path.join(process.cwd(), '.env.local');

  // Read the example file
  const envExample = fs.readFileSync(examplePath, 'utf8');

  // Replace the IP placeholders with actual IP and add Supabase auth hook URL
  const envContent = envExample.replaceAll('LOCAL_IP', localIP);
  // Write the new .env.local file
  fs.writeFileSync(targetPath, envContent);
  console.log(`Generated .env.local with IP: ${localIP}`);
  console.log(
    'All glory to God, the Father of our Lord Jesus Christ, and the Holy Spirit!'
  );
}

generateEnvFile();
