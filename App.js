import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import * as Location from 'expo-location';
import { computeCloudBreaks, findNextBreak } from './src/cloudBreakEngine.js';
import { geocodeLocation } from './src/openMeteo.js';
import { getSunPosition } from './src/sunGeometry.js';
import { Widget } from './src/widget.js';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getWeatherIcon(breakItem) {
  if (!breakItem) return '?';
  if (breakItem.isNight) return '🌙';
  if (!breakItem.bandResults) return '⏳';
  if (breakItem.cloudBreak) return '☀️';
  const blockedCount = Object.values(breakItem.bandResults).filter(b => b.blocked).length;
  if (blockedCount === 3) return '☁️';
  return '⛅';
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [sunPosition, setSunPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Current Location' };
      setLocation(loc);
      await loadForecast(loc.lat, loc.lon);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const loadForecast = async (lat, lon) => {
    try {
      const breaks = await computeCloudBreaks(lat, lon);
      setForecast(breaks);
      setSunPosition(getSunPosition(new Date(), lat, lon));
    } catch (e) {
      setError(e.message);
    }
  };

  const selectLocation = (loc) => {
    const newLoc = { lat: loc.lat, lon: loc.lon, name: loc.name + (loc.country ? `, ${loc.country}` : '') };
    setLocation(newLoc);
    setSearchResults([]);
    setSearchQuery('');
    loadForecast(loc.lat, loc.lon);
  };

  useEffect(() => { getLocation(); }, []);
  
  // Update widget when forecast changes
  useEffect(() => {
    if (forecast && forecast.length > 0) {
      updateWidget();
    }
  }, [forecast]);
  
  const updateWidget = async () => {
    if (!currentData) return;
    const status = currentData.isNight ? 'Night' : currentData.cloudBreak ? 'Clear Sun' : 'Cloudy';
    const emoji = getWeatherIcon(currentData);
    const nextBreakTime = nextBreak ? `${formatDate(nextBreak.timestamp)} ${formatTime(nextBreak.timestamp)}` : '--';
    const temp = currentData?.bandResults?.low?.correctedCover?.toFixed(0) ?? '?';
    
    try {
      await Widget.update(status, emoji, nextBreakTime, `${temp}%`);
    } catch (e) {
      // Widget update failed silently
    }
  };

  const now = new Date();
  const currentData = forecast?.[0];
  const nextBreak = forecast ? findNextBreak(forecast) : null;
  const hourlyData = forecast?.slice(0, 24) || [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Getting forecast...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Sunshine</Text>
        <Text style={styles.status}>{getWeatherIcon(currentData)} {currentData?.isNight ? 'Night' : currentData?.cloudBreak ? 'Clear' : 'Cloudy'}</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search location..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={async () => {
            const results = await geocodeLocation(searchQuery);
            setSearchResults(results);
          }}
        />
        <TouchableOpacity style={styles.gpsBtn} onPress={getLocation}>
          <Text>📍</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} nestedScrollEnabled>
          {searchResults.map((r, i) => (
            <TouchableOpacity key={i} style={styles.searchItem} onPress={() => selectLocation(r)}>
              <Text style={styles.searchItemName}>{r.name}</Text>
              <Text style={styles.searchItemDetail}>{r.admin1 ? r.admin1 + ', ' : ''}{r.country}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.locationText}>{location?.name || 'Unknown'}</Text>
            <Text style={styles.dateText}>{formatDate(now)}</Text>
          </View>
          
          <View style={styles.sunRow}>
            <Text style={styles.sunEmoji}>{getWeatherIcon(currentData)}</Text>
            <View style={styles.sunInfo}>
              <Text style={styles.sunElev}>Sun {currentData?.sunElevation?.toFixed(1) ?? '?'}°</Text>
              <Text style={styles.sunAz}>Az {currentData?.sunAzimuth?.toFixed(0) ?? '?'}°</Text>
            </View>
          </View>

          <View style={styles.cloudRow}>
            {['low', 'mid', 'high'].map(band => {
              const data = currentData?.bandResults?.[band];
              const blocked = data?.blocked;
              return (
                <View key={band} style={[styles.cloudItem, blocked && styles.cloudBlocked]}>
                  <Text style={styles.cloudBand}>{band}</Text>
                  <Text style={styles.cloudPct}>{data?.correctedCover?.toFixed(0) ?? '?'}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        {nextBreak && (
          <View style={styles.breakCard}>
            <Text style={styles.breakLabel}>☀️ Next Clear Sun</Text>
            <Text style={styles.breakTime}>{formatDate(nextBreak.timestamp)} {formatTime(nextBreak.timestamp)}</Text>
          </View>
        )}

        <View style={styles.hourlySection}>
          <Text style={styles.sectionTitle}>Hourly</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {hourlyData.map((item, i) => (
              <View key={i} style={[styles.hourItem, item.cloudBreak && !item.isNight && styles.hourClear, item.isNight && styles.hourNight]}>
                <Text style={styles.hourTime}>{formatTime(item.timestamp)}</Text>
                <Text style={styles.hourIcon}>{getWeatherIcon(item)}</Text>
                <Text style={styles.hourElev}>{item.sunElevation?.toFixed(0)}°</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={getLocation}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>

        <Text style={styles.attribution}>Weather: Open-Meteo (CC-BY 4.0)</Text>
      </ScrollView>

      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={getLocation}>
            <Text style={styles.errorBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fbbf24' },
  status: { fontSize: 20 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15 },
  gpsBtn: { backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  searchResults: { maxHeight: 180, marginHorizontal: 20, marginBottom: 8 },
  searchItem: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 4 },
  searchItemName: { color: '#fff', fontWeight: '600' },
  searchItemDetail: { color: '#64748b', fontSize: 12, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, marginTop: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  locationText: { color: '#94a3b8', fontSize: 14 },
  dateText: { color: '#64748b', fontSize: 13 },
  sunRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sunEmoji: { fontSize: 40, marginRight: 12 },
  sunInfo: { flex: 1 },
  sunElev: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sunAz: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  cloudRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  cloudItem: { alignItems: 'center', padding: 8, borderRadius: 8, minWidth: 70 },
  cloudBlocked: { backgroundColor: '#450a0a' },
  cloudBand: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  cloudPct: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  breakCard: { backgroundColor: '#14532d', borderRadius: 12, padding: 14, marginTop: 12 },
  breakLabel: { color: '#4ade80', fontSize: 13 },
  breakTime: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 4 },
  hourlySection: { marginTop: 16 },
  sectionTitle: { color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  hourItem: { backgroundColor: '#1e293b', borderRadius: 10, padding: 10, marginRight: 6, alignItems: 'center', minWidth: 52 },
  hourClear: { backgroundColor: '#14532d' },
  hourNight: { backgroundColor: '#0c1929' },
  hourTime: { color: '#94a3b8', fontSize: 11 },
  hourIcon: { fontSize: 16, marginVertical: 4 },
  hourElev: { color: '#fff', fontSize: 11 },
  refreshBtn: { backgroundColor: '#334155', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 16, marginBottom: 20 },
  refreshBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  attribution: { color: '#475569', fontSize: 11, textAlign: 'center', paddingBottom: 30 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  errorOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.95)', justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: '#fbbf24', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  errorBtnText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
});