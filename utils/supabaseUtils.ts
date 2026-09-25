import AsyncStorage from '@react-native-async-storage/async-storage';

export const getSupabaseAuthKey = async () => {
  const supabaseAuthKey = (await AsyncStorage.getAllKeys()).find(
    (key) => key.startsWith('sb-') && key.endsWith('-auth-token')
  );
  return supabaseAuthKey;
};
