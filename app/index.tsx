import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// import { userRepository } from '@/database_components/repositories';
// import { initDatabase } from '@/database_components/dbInit';

import * as SQLite from 'expo-sqlite';
// import { userd, languaged } from '../db/drizzleSchema';
import * as schema from '../db/drizzleSchema';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { db } from '../db/database';
import { UserService } from '@/database_components/userService';
import { handleMigrations } from '@/db/migrationHandler';

const { user, language } = schema;


// const userRepository = new UserRepository();

export default function Index() {
  const router = useRouter();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { success, error } = useMigrations(db, migrations);
  const [items, setItems] = useState<typeof language.$inferSelect[] | null>(null);

  useEffect(() => {
    (async () => {
      const { success, error } = await handleMigrations();
      if (success) {
        setDbStatus('Database initialized successfully');
      } else {
        setDbStatus(`Migration error: ${error}`);
        console.error('Migration error:', error);
      }
    })();
  }, []);


  const handleSignIn = async () => {
    try {
      const user = await UserService.validateCredentials(username, password);
      if (user) {
        router.push("/projects");
      } else {
        Alert.alert('Error', 'Invalid username or password');
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      Alert.alert('Error', 'An error occurred during sign in');
    }
  };

  // const handleResetDatabase = async () => {
  //   Alert.alert(
  //     'Reset Database',
  //     'Are you sure you want to reset the entire database? This will delete all data.',
  //     [
  //       {
  //         text: 'Cancel',
  //         style: 'cancel',
  //       },
  //       {
  //         text: 'Reset',
  //         style: 'destructive',
  //         onPress: async () => {
  //           try {
  //             await initDatabase(true);
  //             setDbStatus('Database reset successfully');
  //           } catch (error) {
  //             console.error('Error resetting database:', error);
  //             setDbStatus(`Error resetting database: ${error}`);
  //           }
  //         },
  //       },
  //     ]
  //   );
  // };

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
              value={username}
              onChangeText={setUsername}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Password"
              placeholderTextColor={colors.text}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          
          <TouchableOpacity>
            <Text style={[sharedStyles.link, { marginBottom: spacing.medium }]}>I forgot my password</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleSignIn}>
            <Text style={sharedStyles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push("/dbdev")}
            style={{ position: 'absolute', top: 10, right: 10, padding: 10 }}
          >
            <Ionicons name="construct-outline" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ position: 'absolute', top: 10, right: 50, padding: 10 }}
          >
            <Ionicons name="refresh-outline" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text>{dbStatus}</Text>
          
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