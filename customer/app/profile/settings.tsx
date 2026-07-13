import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import ScreenHeader from '@/components/ScreenHeader';
import { STORAGE_KEYS } from '@/constants/profile';
import { disableOrderNotifications, registerForPushNotifications } from '@/lib/pushNotifications';

interface Settings {
  pushNotifications: boolean;
  emailUpdates: boolean;
  smsUpdates: boolean;
  locationAccess: boolean;
  darkMode: boolean;
  language: string;
}

const DEFAULTS: Settings = {
  pushNotifications: true,
  emailUpdates: true,
  smsUpdates: false,
  locationAccess: true,
  darkMode: false,
  language: 'English',
};

const LANGUAGES = ['English', 'Español', 'Français', '中文', 'العربية'];

export default function SettingsScreen() {
  const colors = useColors();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
        if (raw) setSettings({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
      } catch {
        // start from defaults on read failure
      }
    })();
  }, []);

  const setToggle = (key: keyof Settings, value: boolean) => {
    setSaved(false);
    setSaveError('');
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const cycleLanguage = () => {
    setSaved(false);
    setSaveError('');
    setSettings((prev) => {
      const idx = LANGUAGES.indexOf(prev.language);
      return { ...prev, language: LANGUAGES[(idx + 1) % LANGUAGES.length] };
    });
  };

  const handleSave = async () => {
    try {
      // Persist the preference first so the push library reads the new value
      // when (re)registering this device's token below.
      await AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
      if (settings.pushNotifications) {
        await registerForPushNotifications();
      } else {
        await disableOrderNotifications();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      setSaveError('');
    } catch {
      setSaveError('Could not save your settings. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Account deletion is not available in this demo. In the full app this would permanently remove your account and data.',
      [{ text: 'OK', style: 'cancel' }],
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      'Privacy Settings',
      'Manage how your data is used. Detailed privacy controls are coming soon.',
      [{ text: 'OK', style: 'cancel' }],
    );
  };

  const toggleRows: { key: keyof Settings; icon: string; label: string; desc: string }[] = [
    { key: 'pushNotifications', icon: 'notifications-outline', label: 'Order updates', desc: 'Order status alerts on this device' },
    { key: 'emailUpdates', icon: 'mail-outline', label: 'Email updates', desc: 'News, offers & receipts by email' },
    { key: 'smsUpdates', icon: 'chatbubble-outline', label: 'SMS updates', desc: 'Text alerts for your orders' },
    { key: 'locationAccess', icon: 'location-outline', label: 'Location access', desc: 'Use your location for nearby spots' },
    { key: 'darkMode', icon: 'moon-outline', label: 'Dark mode', desc: 'Coming soon' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 20 }}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {toggleRows.map((row, idx) => (
            <View
              key={row.key}
              style={[styles.row, idx < toggleRows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={row.icon as any} size={22} color={colors.foreground} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>{row.desc}</Text>
              </View>
              <Switch
                value={settings[row.key] as boolean}
                onValueChange={(v) => setToggle(row.key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                accessibilityLabel={row.label}
              />
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={cycleLanguage}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="language-outline" size={22} color={colors.foreground} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Language</Text>
            </View>
            <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{settings.language}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={handlePrivacy}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.foreground} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Privacy settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={styles.rowIcon}>
              <Ionicons name="trash-outline" size={22} color={colors.destructive} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: colors.destructive }]}>Delete account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {saved ? (
          <Text style={[styles.savedText, { color: colors.success }]}>Settings saved</Text>
        ) : null}
        {saveError ? (
          <Text style={[styles.savedText, { color: colors.destructive }]}>{saveError}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  rowIcon: { width: 32, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  rowDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowValue: { fontSize: 15, fontFamily: 'Inter_500Medium', marginRight: 4 },
  savedText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  saveBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
