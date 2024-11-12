import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { userRepository } from '@/database_components/repositories';
import { initDatabase } from '@/database_components/dbInit';

import * as SQLite from 'expo-sqlite';
import { usersTable } from '../db/drizzleSchema';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { drizzle } from 'drizzle-orm/expo-sqlite';

const expo = SQLite.openDatabaseSync('db.db');
const db = drizzle(expo);

// const userRepository = new UserRepository();

export default function Index() {
  const router = useRouter();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const { success, error } = useMigrations(db, migrations);
  const [items, setItems] = useState<typeof usersTable.$inferSelect[] | null>(null);

  useEffect(() => {
    let isMounted = true;

    const initDb = async () => {
      try {
        await initDatabase();
        if (isMounted) {
          setDbStatus('Database initialized successfully');
        }
      } catch (error) {
        console.error('Error initializing database:', error);
        if (isMounted) {
          setDbStatus(`Error initializing database: ${error}`);
          Alert.alert('Error', 'Failed to initialize the database.');
        }
      }
    };

    initDb();

    return () => {
      isMounted = false;
    };
  }, []);


  useEffect(() => {
    if (!success) return;

    (async () => {
      await db.delete(usersTable);

      await db.insert(usersTable).values([
        {
            name: 'John',
            age: 30,
            email: 'john@example.com',
        },
      ]);

      const users = await db.select().from(usersTable);
      setItems(users);
    })();
  }, [success]);

  if (error) {
    return (
      <View>
        <Text>Migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View>
        <Text>Migration is in progress...</Text>
      </View>
    );
  }

  if (items === null || items.length === 0) {
    return (
      <View>
        <Text>Empty</Text>
      </View>
    );
  }


  const handleSignIn = async () => {
    try {
      const user = await userRepository.validateCredentials(username, password);
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

  const handleResetDatabase = async () => {
    Alert.alert(
      'Reset Database',
      'Are you sure you want to reset the entire database? This will delete all data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await initDatabase(true);
              setDbStatus('Database reset successfully');
            } catch (error) {
              console.error('Error resetting database:', error);
              setDbStatus(`Error resetting database: ${error}`);
            }
          },
        },
      ]
    );
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
            onPress={handleResetDatabase}
            style={{ position: 'absolute', top: 10, right: 50, padding: 10 }}
          >
            <Ionicons name="refresh-outline" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text>{dbStatus}</Text>

          {items.map((item) => (
            <Text key={item.id}>{item.email}</Text>
          ))}
          
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