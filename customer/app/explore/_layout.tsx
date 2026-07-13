import { Stack } from 'expo-router';
import React from 'react';
import { ExploreProvider } from '@/context/ExploreContext';

export default function ExploreLayout() {
  return (
    <ExploreProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="questions" />
        <Stack.Screen name="edit" />
        <Stack.Screen name="results" />
      </Stack>
    </ExploreProvider>
  );
}
