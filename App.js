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
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { computeCloudBreaks, findNextBreak, findBreakWindows } from './src/cloudBreakEngine.js';
import { geocodeLocation } from './src/openMeteo.js';
import { getSunPosition } from './src/sunGeometry.js';

const { width } = Dimensions.get('window');

const WEATHER_EMOJIS = {
  clear: '☀️',
  partlyCloudy: '⛅',
  overcast: '☁️',
  night: '🌙',
  lowClouds: '🌫',
};

function getWeatherEmoji(breakItem) {
  if (!breakItem) return '?';
  if (breakItem.isNight) return '🌙';
  if (!breakItem.bandResults) return '?';
  if (breakItem.cloudBreak) return '☀️';
  const blockedCount = Object.values(breakItem.bandResults).filter(b => b.blocked).length;
  if (blockedCount === 3) return '☁️';
  return '⛅';
}

function getWeatherLabel(breakItem) {
  if (!breakItem) return 'Unknown';
  if (breakItem.isNight) return 'Night';
  if (!breakItem.bandResults) return 'Loading...';
  if (breakItem.cloudBreak) return 'Direct Sun';
  const blockedCount = Object.values(breakItem.bandResults).filter(b => b.blocked).length;
  if (blockedCount === 3) return 'Overcast';
  return 'Partly Cloudy';
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHour(date) {
  return date.toLocaleTimeString([], { hour: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function WidgetCard({ forecast, location, sunPosition }) {
  const nextBreak = forecast ? findNextBreak(forecast) : null;
  const now = new Date();
  const currentHour = forecast?.find((item, i) => {
    const itemTime = new Date(now);
    itemTime.setHours(itemTime.getHours() + Math.floor(item.timestamp.getTime() / 3600000));
    return item.timestamp <= now && new Date(now.getTime() + 3600000) > item.timestamp;
  });
  
  const currentItem = forecast?.[0];
  const blockedCount = currentItem?.bandResults ? Object.values(currentItem.bandResults).filter(b => b.blocked).length : 0;
  const cloudBreak = currentItem?.cloudBreak && !currentItem?.isNight;
  
  const sunElev = sunPosition?.elevationDeg?.toFixed(1) ?? '?';
  const sunAz = sunPosition?.azimuthDeg?.toFixed(0) ?? '?';

  return (
    <View style={styles.widget}>
      <View style={styles.widgetHeader}>
        <View style={styles.widgetLocation}>
          <Text style={styles.widgetLocationIcon}>📍</Text>
          <Text style={styles.widgetLocationText} numberOfLines={1}>
            {location?.name || 'Detecting...'}
          </Text>
        </View>
        <Text style={styles.widgetDate}>{formatDate(now)}</Text>
      </View>
      
      <View style={styles.widgetBody}>
        <View style={styles.widgetMain}>
          <Text style={styles.widgetEmoji}>
            {currentItem ? getWeatherEmoji(currentItem) : '⏳'}
          </Text>
          <View style={styles.widgetStatus}>
            <Text style={styles.widgetStatusLabel}>
              {currentItem ? getWeatherLabel(currentItem) : 'Loading...'}
            </Text>
            {currentItem?.isNight ? (
              <Text style={styles.widgetSunInfo}>Sun rise: soon</Text>
            ) : (
              <Text style={styles.widgetSunInfo}>
                ☀️ {sunElev}° ↑{sunAz}°
              </Text>
            )}
          </View>
        </View>
        
        {nextBreak && !currentItem?.isNight && (
          <View style={styles.widgetNext}>
            <Text style={styles.widgetNextLabel}>Next Clear Sun</Text>
            <Text style={styles.widgetNextTime}>
              {formatDate(nextBreak.timestamp)} {formatTime(nextBreak.timestamp)}
            </Text>
          </View>
        )}
        
        {currentItem?.isNight && nextBreak && (
          <View style={styles.widgetNext}>
            <Text style={styles.widgetNextLabel}>Sunrise Window</Text>
            <Text style={styles.widgetNextTime}>
              {formatTime(nextBreak.timestamp)}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.widgetClouds}>
        {['low', 'mid', 'high'].map(band => {
          const data = currentItem?.bandResults?.[band];
          const blocked = data?.blocked;
          const cover = data?.correctedCover?.toFixed(0) ?? '?';
          return (
            <View key={band} style={[styles.widgetCloudItem, blocked && styles.widgetCloudBlocked]}>
              <Text style={styles.widgetCloudBand}>{band.toUpperCase()}</Text>
              <Text style={styles.widgetCloudCover}>{cover}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FiveMinuteTimeline({ forecast, now }) {
  if (!forecast) return null;
  
  const intervals = [];
  for (let i = 0; i < 24; i++) { // 2 hours, 5-min intervals
    const time = new Date(now.getTime() + i * 5 * 60 * 1000);
    const hourIndex = Math.floor(i / 12);
    const minuteIndex = i % 12;
    
    // Find the closest forecast item
    const forecastItem = forecast.find(item => {
      const diff = Math.abs(item.timestamp.getTime() - time.getTime());
      return diff < 30 * 60 * 1000; // within 30 min
    });
    
    intervals.push({
      time,
      item: forecastItem,
      isNow: i === 0,
    });
  }

  return (
    <View style={styles.timeline}>
      <Text style={styles.timelineTitle}>Next 2 Hours</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeline}>
        {intervals.map((int, i) => {
          const emoji = getWeatherEmoji(int.item);
          const isBlocked = int.item && !int.item.isNight && !int.item.cloudBreak;
          const isClear = int.item && !int.item.isNight && int.item.cloudBreak;
          const isNight = int.item?.isNight;
          
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.minuteItem,
                int.isNow && styles.minuteItemNow,
                isClear && styles.minuteItemClear,
                isBlocked && styles.minuteItemBlocked,
              ]}
            >
              <Text style={[styles.minuteTime, int.isNow && styles.minuteTimeNow]}>
                {int.isNow ? 'Now' : formatTime(int.time)}
              </Text>
              <Text style={styles.minuteEmoji}>{emoji}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function HourlyForecast({ forecast }) {
  const windows = forecast ? findBreakWindows(forecast) : [];
  const now = new Date();
  const hours = forecast?.slice(0, 48) || [];
  
  const groupedByDay = {};
  hours.forEach((item, i) => {
    const day = formatDate(item.timestamp);
    if (!groupedByDay[day]) groupedByDay[day] = [];
    groupedByDay[day].push({ ...item, index: i });
  });

  return (
    <View style={styles.hourly}>
      <Text style={styles.hourlyTitle}>48-Hour Forecast</Text>
      
      {windows.length > 0 && (
        <View style={styles.breakWindows}>
          <Text style={styles.breakWindowsTitle}>☀️ Upcoming Cloud Breaks</Text>
          {windows.slice(0, 4).map((w, i) => (
            <View key={i} style={styles.breakWindowItem}>
              <Text style={styles.breakWindowText}>
                {formatDate(w.start)} {formatTime(w.start)} - {formatTime(w.end)}
              </Text>
              <Text style={styles.breakWindowDuration}>{Math.round(w.duration)} min</Text>
            </View>
          ))}
        </View>
      )}
      
      {Object.entries(groupedByDay).map(([day, items]) => (
        <View key={day} style={styles.dayGroup}>
          <Text style={styles.dayLabel}>{day}</Text>
          <View style={styles.hourGrid}>
            {items.map((item) => {
              const isNow = Math.abs(item.timestamp.getTime() - now.getTime()) < 30 * 60 * 1000;
              const isNight = item.isNight;
              const isClear = item.cloudBreak && !isNight;
              const isBlocked = !isNight && !item.cloudBreak;
              
              return (
                <View
                  key={item.index}
                  style={[
                    styles.hourItem,
                    isNow && styles.hourItemNow,
                    isClear && styles.hourItemClear,
                    isBlocked && styles.hourItemBlocked,
                    isNight && styles.hourItemNight,
                  ]}
                >
                  <Text style={styles.hourTime}>{formatHour(item.timestamp)}</Text>
                  <Text style={styles.hourEmoji}>{getWeatherEmoji(item)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
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
        setError('Location permission denied. Please enable location access.');
        setLoading(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const loc = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        name: 'Current Location',
      };
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
      updateSunPosition(lat, lon);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateSunPosition = (lat, lon) => {
    const sun = getSunPosition(new Date(), lat, lon);
    setSunPosition(sun);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await geocodeLocation(searchQuery);
      setSearchResults(results);
    } catch (e) {
      setError(e.message);
    }
  };

  const selectLocation = (loc) => {
    const newLoc = {
      lat: loc.lat,
      lon: loc.lon,
      name: loc.name + (loc.country ? `, ${loc.country}` : ''),
    };
    setLocation(newLoc);
    setSearchResults([]);
    setSearchQuery('');
    loadForecast(loc.lat, loc.lon);
  };

  useEffect(() => {
    getLocation();
  }, []);

  // Update sun position every minute
  useEffect(() => {
    if (!location) return;
    const interval = setInterval(() => {
      updateSunPosition(location.lat, location.lon);
    }, 60000);
    return () => clearInterval(interval);
  }, [location]);

  const now = new Date();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Sunshine</Text>
        <Text style={styles.subtitle}>Cloud Break Predictor</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search location..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <ScrollView style={styles.searchResults} nestedScrollEnabled>
          {searchResults.map((r, i) => (
            <TouchableOpacity key={i} style={styles.searchResultItem} onPress={() => selectLocation(r)}>
              <Text style={styles.searchResultName}>{r.name}</Text>
              <Text style={styles.searchResultDetail}>{r.admin1 ? r.admin1 + ', ' : ''}{r.country}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <WidgetCard forecast={forecast} location={location} sunPosition={sunPosition} />
        
        <FiveMinuteTimeline forecast={forecast} now={now} />
        
        <HourlyForecast forecast={forecast} />
        
        <TouchableOpacity style={styles.refreshBtn} onPress={getLocation}>
          <Text style={styles.refreshBtnText}>🔄 Refresh Forecast</Text>
        </TouchableOpacity>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Data: Open-Meteo (CC-BY) • SunCalc (MIT)
          </Text>
          <Text style={styles.footerText}>
            Updates every 5 minutes for best accuracy
          </Text>
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Loading forecast...</Text>
        </View>
      )}

      {error && !loading && (
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
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 18,
  },
  searchResults: {
    maxHeight: 200,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  searchResultItem: {
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  searchResultName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  searchResultDetail: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  
  // Widget styles
  widget: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  widgetLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  widgetLocationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  widgetLocationText: {
    color: '#94a3b8',
    fontSize: 14,
    flex: 1,
  },
  widgetDate: {
    color: '#64748b',
    fontSize: 13,
  },
  widgetBody: {
    marginBottom: 12,
  },
  widgetMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  widgetEmoji: {
    fontSize: 48,
    marginRight: 16,
  },
  widgetStatus: {
    flex: 1,
  },
  widgetStatusLabel: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  widgetSunInfo: {
    color: '#fbbf24',
    fontSize: 14,
    marginTop: 4,
  },
  widgetNext: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  widgetNextLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  widgetNextTime: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  widgetClouds: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  widgetCloudItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    minWidth: 80,
  },
  widgetCloudBlocked: {
    backgroundColor: '#7f1d1d',
  },
  widgetCloudBand: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  widgetCloudCover: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Timeline styles
  timeline: {
    marginBottom: 16,
  },
  timelineTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  minuteItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 50,
  },
  minuteItemNow: {
    backgroundColor: '#fbbf24',
  },
  minuteItemClear: {
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  minuteItemBlocked: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  minuteTime: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  minuteTimeNow: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  minuteEmoji: {
    fontSize: 16,
  },
  
  // Hourly styles
  hourly: {
    marginBottom: 16,
  },
  hourlyTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  breakWindows: {
    backgroundColor: '#1e3a2f',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  breakWindowsTitle: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  breakWindowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakWindowText: {
    color: '#fff',
    fontSize: 14,
  },
  breakWindowDuration: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dayGroup: {
    marginBottom: 12,
  },
  dayLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  hourItem: {
    width: width / 8 - 12,
    marginHorizontal: 4,
    marginVertical: 4,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
  },
  hourItemNow: {
    backgroundColor: '#fbbf24',
  },
  hourItemClear: {
    backgroundColor: '#14532d',
  },
  hourItemBlocked: {
    backgroundColor: '#450a0a',
  },
  hourItemNight: {
    backgroundColor: '#0c1929',
  },
  hourTime: {
    color: '#94a3b8',
    fontSize: 10,
    marginBottom: 2,
  },
  hourEmoji: {
    fontSize: 14,
  },
  
  refreshBtn: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  footerText: {
    color: '#475569',
    fontSize: 11,
    marginTop: 4,
  },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBtn: {
    backgroundColor: '#fbbf24',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  errorBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
});