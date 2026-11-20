import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../context/AuthContext';
import { PontosProvider } from '../context/PontosContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PontosProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
        </PontosProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}