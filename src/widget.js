import { NativeModules, Platform } from 'react-native';

const { SunshineWidget } = NativeModules;

export const Widget = {
  update: async (status, emoji, nextBreak, temp) => {
    if (Platform.OS === 'android' && SunshineWidget) {
      return SunshineWidget.updateWidget(status, emoji, nextBreak, temp);
    }
    return null;
  },
  
  startUpdates: async () => {
    if (Platform.OS === 'android' && SunshineWidget) {
      return SunshineWidget.startWidgetUpdates();
    }
    return null;
  },
  
  stopUpdates: async () => {
    if (Platform.OS === 'android' && SunshineWidget) {
      return SunshineWidget.stopWidgetUpdates();
    }
    return null;
  },
};