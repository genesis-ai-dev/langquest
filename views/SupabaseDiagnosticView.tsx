import { system } from '@/db/powersync/system';
import { AppConfig } from '@/db/supabase/AppConfig';
import { getSupabaseAuthKey } from '@/utils/supabaseUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface DiagnosticResult {
  test: string;
  status: 'pending' | 'success' | 'error' | 'timeout';
  result?: any;
  error?: any;
  duration?: number;
}

export function SupabaseDiagnosticView() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: DiagnosticResult) => {
    setResults((prev) => [...prev, result]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Check Supabase configuration
    addResult({
      test: 'Supabase Configuration',
      status: 'success',
      result: {
        url: AppConfig.supabaseUrl,
        hasAnonKey: !!AppConfig.supabaseAnonKey,
        bucket: AppConfig.supabaseBucket
      }
    });

    // Test 2: Check AsyncStorage
    try {
      const start = Date.now();
      const authKey = await getSupabaseAuthKey();
      const sessionString = authKey
        ? await AsyncStorage.getItem(authKey)
        : null;
      addResult({
        test: 'AsyncStorage Access',
        status: 'success',
        result: {
          authKey,
          hasSession: !!sessionString,
          sessionLength: sessionString?.length
        },
        duration: Date.now() - start
      });
    } catch (error) {
      addResult({
        test: 'AsyncStorage Access',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 3: Check Supabase client exists
    addResult({
      test: 'Supabase Client',
      status: 'success',
      result: {
        clientExists: !!system.supabaseConnector.client,
        authExists: !!system.supabaseConnector.client?.auth
      }
    });

    // Test 4: Simple auth.getSession with timeout
    try {
      const start = Date.now();
      const sessionPromise = system.supabaseConnector.client.auth.getSession();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout after 5s')), 5000)
      );

      const result = (await Promise.race([
        sessionPromise,
        timeoutPromise
      ])) as Awaited<
        ReturnType<typeof system.supabaseConnector.client.auth.getSession>
      >;
      addResult({
        test: 'getSession() Call',
        status: 'success',
        result: {
          hasSession: !!result.data?.session,
          userId: result.data?.session?.user.id
        },
        duration: Date.now() - start
      });
    } catch (error) {
      addResult({
        test: 'getSession() Call',
        status:
          error instanceof Error && error.message.includes('Timeout')
            ? 'timeout'
            : 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 5: Direct fetch to Supabase API
    try {
      const start = Date.now();
      const response = await fetch(`${AppConfig.supabaseUrl}/auth/v1/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.text();
      addResult({
        test: 'Direct API Fetch',
        status: 'success',
        result: {
          statusCode: response.status,
          response: data
        },
        duration: Date.now() - start
      });
    } catch (error) {
      addResult({
        test: 'Direct API Fetch',
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Test 6: Check if we're in development mode
    addResult({
      test: 'Environment',
      status: 'success',
      result: {
        isDev: __DEV__,
        nodeEnv: process.env.NODE_ENV
      }
    });

    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#1a1a1a', padding: 20 }}>
      <Text style={{ color: 'white', fontSize: 24, marginBottom: 20 }}>
        Supabase Diagnostics
      </Text>

      <TouchableOpacity
        onPress={runDiagnostics}
        disabled={isRunning}
        style={{
          backgroundColor: '#3b82f6',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {isRunning ? 'Running...' : 'Run Diagnostics'}
        </Text>
      </TouchableOpacity>

      {results.map((result, index) => (
        <View
          key={index}
          style={{
            backgroundColor: '#2a2a2a',
            padding: 12,
            borderRadius: 8,
            marginBottom: 10,
            borderLeftWidth: 4,
            borderLeftColor:
              result.status === 'success'
                ? '#10b981'
                : result.status === 'timeout'
                  ? '#f59e0b'
                  : result.status === 'error'
                    ? '#ef4444'
                    : '#6b7280'
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>
              {result.test}
            </Text>
            {result.status === 'pending' && (
              <ActivityIndicator size="small" color="white" />
            )}
            {result.duration && (
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                {result.duration}ms
              </Text>
            )}
          </View>

          {result.result && (
            <Text
              style={{ color: '#d1d5db', marginTop: 8, fontSize: 12 }}
              numberOfLines={10}
            >
              {JSON.stringify(result.result, null, 2)}
            </Text>
          )}

          {result.error && (
            <Text style={{ color: '#ef4444', marginTop: 8, fontSize: 12 }}>
              Error: {result.error}
            </Text>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
