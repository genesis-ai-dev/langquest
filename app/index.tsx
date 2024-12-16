import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// import { userRepository } from '@/database_services/repositories';
// import { initDatabase } from '@/database_services/dbInit';

import * as SQLite from 'expo-sqlite';
// import { userd, languaged } from '../db/drizzleSchema';
import * as schema from '../db/drizzleSchema';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { system } from '../db/powersync/system';
import { userService } from '@/database_services/userService';
import { handleMigrations } from '@/db/migrationHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { seedDatabase } from '../db/seedDatabase';
import { useAuth } from '@/contexts/AuthContext';

const { profile, language } = schema;
const { supabaseConnector } = system;

// const userRepository = new UserRepository();

export default function Index() {
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isDbReady, setIsDbReady] = useState(false);

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      // setPassword('');
      setCredentials({ username: '', password: '' });
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const initializeDatabase = async () => {
      if (system.isInitialized()) {
        return;
      }
  
      try {
        const { data, error: signInError } = await supabaseConnector.client.auth.signInAnonymously();
  
        if (signInError || !mounted) {
          console.error('Error signing in anonymously:', signInError);
          return;
        }
  
        const { data: sessionData } = await supabaseConnector.client.auth.getSession();
        
        if (!mounted) return;
        
        if (sessionData.session) {
          await system.init();
          if (mounted) {
            router.push("/projects");
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          router.replace("/register");
        }
      }
    };
  
    initializeDatabase();
  
    return () => {
      mounted = false;
    };
  }, []);
  
  const handleSignIn = async () => {
    try {
      const authenticatedUser = await userService.validateCredentials(credentials);
      if (authenticatedUser) {
        // await system.init(); // Initialize PowerSync after successful login
        // setPassword('');
        setCredentials({ username: '', password: '' });
        setCurrentUser(authenticatedUser);
        router.push("/projects");
      } else {
        Alert.alert('Error', 'Invalid username or password');
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      Alert.alert('Error', 'An error occurred during sign in');
    }
  };


  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={[sharedStyles.container, { backgroundColor: 'transparent' }]}>
        <Text>{dbStatus}</Text>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={sharedStyles.appTitle}>LangQuest</Text>
            <Text style={sharedStyles.subtitle}>Welcome back, hero!</Text>
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Username"
              placeholderTextColor={colors.text}
              value={credentials.username}
              onChangeText={(text) => setCredentials({ ...credentials, username: text.toLowerCase().trim() })}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Password"
              placeholderTextColor={colors.text}
              secureTextEntry
              value={credentials.password}
              onChangeText={(password) => setCredentials({ ...credentials, password })}
            />
          </View>
          
          <TouchableOpacity>
            <Text style={[sharedStyles.link, { marginBottom: spacing.medium }]}>I forgot my password</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleSignIn}>
            <Text style={sharedStyles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, marginRight: spacing.small }}>New user?</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={sharedStyles.link}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}