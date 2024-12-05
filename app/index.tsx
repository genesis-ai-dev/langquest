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
import { db } from '../db/database';
import { userService } from '@/database_services/userService';
import { handleMigrations } from '@/db/migrationHandler';
import { seedDatabase } from '../db/seedDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';

const { user, language } = schema;


// const userRepository = new UserRepository();

export default function Index() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isDbReady, setIsDbReady] = useState(false);
  
  const { success, error } = useMigrations(db, migrations);

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      setPassword('');
    };
  }, []);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        setDbStatus('Running migrations...');
        const { success, error } = await handleMigrations();
        
        if (!success) {
          setDbStatus(`Migration error: ${error}`);
          console.error('Migration error:', error);
          return;
        }

        setDbStatus('Seeding database...');
        await seedDatabase();
        
        setDbStatus('Database initialized successfully');
        setIsDbReady(true);
      } catch (error) {
        console.error('Database initialization error:', error);
        setDbStatus(`Database initialization failed: ${error}`);
      }
    };

    initializeDatabase();
  }, []);


  const handleSignIn = async () => {
    if (!isDbReady) {
      Alert.alert('Error', t('databaseNotReady'));
      return;
    }

    try {
      const authenticatedUser = await userService.validateCredentials(username, password);
      if (authenticatedUser) {
        setPassword('');
        setCurrentUser(authenticatedUser);
        router.push("/projects");
      } else {
        Alert.alert('Error', t('invalidAuth'));
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      Alert.alert('Error', t('signInError'));
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
            <Text style={sharedStyles.subtitle}>{t('welcome')}</Text>
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder={t('username')}
              placeholderTextColor={colors.text}
              value={username}
              onChangeText={setUsername}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder={t('password')}
              placeholderTextColor={colors.text}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          
          <TouchableOpacity>
            <Text style={[sharedStyles.link, { marginBottom: spacing.medium }]}>{t('forgotPassword')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleSignIn}>
            <Text style={sharedStyles.buttonText}>{t('signIn')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, marginRight: spacing.small }}>{t('newUser')}</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={sharedStyles.link}>{t('register')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}