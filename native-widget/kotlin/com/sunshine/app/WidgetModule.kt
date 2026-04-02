package com.sunshine.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String {
        return "SunshineWidget"
    }
    
    @ReactMethod
    fun updateWidget(status: String, emoji: String, nextBreak: String, temp: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            
            // Save to shared preferences
            val prefs = context.getSharedPreferences("sunshine_widget", Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString("status", status)
                putString("emoji", emoji)
                putString("nextBreak", nextBreak)
                putString("temp", temp)
                apply()
            }
            
            // Update all widget instances
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val widgetIds = appWidgetManager.getAppWidgetIds(
                ComponentName(context, SunshineWidget::class.java)
            )
            
            for (id in widgetIds) {
                SunshineWidget.updateAppWidget(context, appWidgetManager, id)
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun startWidgetUpdates(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, WidgetUpdateService::class.java)
            intent.action = WidgetUpdateService.ACTION_START
            context.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
    
    @ReactMethod
    fun stopWidgetUpdates(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, WidgetUpdateService::class.java)
            intent.action = WidgetUpdateService.ACTION_STOP
            context.startService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
}