#!/usr/bin/env tsx
/**
 * Check Supabase service status
 * This script checks both local and remote Supabase configurations
 */

// Load environment variables
import { config } from 'dotenv';
import { resolve } from 'path';

// Try to load .env.local first, then fall back to .env
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });
config(); // Also try .env

import { AppConfig } from '../db/supabase/AppConfig';

interface StatusCheck {
  name: string;
  status: 'ok' | 'error' | 'warning' | 'unknown';
  message: string;
  details?: any;
}

async function checkHealthEndpoint(url: string): Promise<StatusCheck> {
  try {
    const healthUrl = `${url}/auth/v1/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      return {
        name: 'Health Endpoint',
        status: 'ok',
        message: `Health check successful (${response.status})`,
        details: { statusCode: response.status, response: text }
      };
    } else {
      return {
        name: 'Health Endpoint',
        status: 'warning',
        message: `Health endpoint returned ${response.status}`,
        details: { statusCode: response.status }
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        name: 'Health Endpoint',
        status: 'error',
        message: 'Health check timed out after 5 seconds',
        details: { error: 'Timeout' }
      };
    }
    return {
      name: 'Health Endpoint',
      status: 'error',
      message: `Failed to connect: ${error.message}`,
      details: { error: error.message }
    };
  }
}

async function checkConfiguration(): Promise<StatusCheck> {
  // Check both AppConfig and process.env directly
  const supabaseUrl = AppConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = AppConfig.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseBucket = AppConfig.supabaseBucket || process.env.EXPO_PUBLIC_SUPABASE_BUCKET;
  const powersyncUrl = AppConfig.powersyncUrl || process.env.EXPO_PUBLIC_POWERSYNC_URL;

  const hasUrl = !!supabaseUrl;
  const hasAnonKey = !!supabaseAnonKey;
  const hasBucket = !!supabaseBucket;
  const hasPowersyncUrl = !!powersyncUrl;

  const allConfigured = hasUrl && hasAnonKey;

  return {
    name: 'Configuration',
    status: allConfigured ? 'ok' : 'error',
    message: allConfigured
      ? 'All required configuration present'
      : 'Missing required configuration',
    details: {
      supabaseUrl: hasUrl ? supabaseUrl : 'MISSING',
      hasAnonKey,
      bucket: hasBucket ? supabaseBucket : 'Not configured',
      powersyncUrl: hasPowersyncUrl ? powersyncUrl : 'Not configured',
      // Show if values are from AppConfig or process.env
      source: {
        url: AppConfig.supabaseUrl ? 'AppConfig' : (process.env.EXPO_PUBLIC_SUPABASE_URL ? 'process.env' : 'none'),
        anonKey: AppConfig.supabaseAnonKey ? 'AppConfig' : (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'process.env' : 'none')
      }
    }
  };
}

function getStatusIcon(status: StatusCheck['status']): string {
  switch (status) {
    case 'ok':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

async function main() {
  console.log('🔍 Checking Supabase Status...\n');

  const checks: StatusCheck[] = [];

  // Check configuration
  const configCheck = await checkConfiguration();
  checks.push(configCheck);

  // Check health endpoint if URL is configured
  const supabaseUrl = AppConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const healthCheck = await checkHealthEndpoint(supabaseUrl);
    checks.push(healthCheck);
  } else {
    checks.push({
      name: 'Health Endpoint',
      status: 'warning',
      message: 'Cannot check health endpoint - Supabase URL not configured'
    });
  }

  // Print results
  console.log('Results:\n');
  checks.forEach((check) => {
    const icon = getStatusIcon(check.status);
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.details) {
      console.log('   Details:', JSON.stringify(check.details, null, 2));
    }
    console.log('');
  });

  // Summary
  const hasErrors = checks.some((c) => c.status === 'error');
  const hasWarnings = checks.some((c) => c.status === 'warning');
  const allOk = checks.every((c) => c.status === 'ok');

  console.log('--- Summary ---');
  if (allOk) {
    console.log('✅ All checks passed');
    process.exit(0);
  } else if (hasErrors) {
    console.log('❌ Some checks failed');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Some checks have warnings');
    process.exit(0);
  } else {
    console.log('❓ Status unknown');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error running status check:', error);
  process.exit(1);
});
