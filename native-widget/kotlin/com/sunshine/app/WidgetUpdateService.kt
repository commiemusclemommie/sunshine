package com.sunshine.app

import android.app.Service
import android.content.Intent
import android.content.Context
import android.appwidget.AppWidgetManager
import android.content.SharedPreferences
import java.util.Timer
import java.util.TimerTask

class WidgetUpdateService : Service() {
    
    private var updateTimer: Timer? = null
    
    companion object {
        const val ACTION_START = "com.sunshine.app.START_WIDGET_UPDATE"
        const val ACTION_STOP = "com.sunshine.app.STOP_WIDGET_UPDATE"
        const val ACTION_UPDATE = "com.sunshine.app.UPDATE_WIDGET"
        const val EXTRA_STATUS = "status"
        const val EXTRA_EMOJI = "emoji"
        const val EXTRA_NEXT_BREAK = "nextBreak"
        const val EXTRA_TEMP = "temp"
        
        private const val UPDATE_INTERVAL = 5 * 60 * 1000L // 5 minutes
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startUpdates()
            ACTION_STOP -> stopUpdates()
            ACTION_UPDATE -> {
                val status = intent.getStringExtra(EXTRA_STATUS) ?: "Loading..."
                val emoji = intent.getStringExtra(EXTRA_EMOJI) ?: "?"
                val nextBreak = intent.getStringExtra(EXTRA_NEXT_BREAK) ?: "--"
                val temp = intent.getStringExtra(EXTRA_TEMP) ?: "--"
                updateWidget(this, status, emoji, nextBreak, temp)
            }
        }
        return START_STICKY
    }
    
    private fun startUpdates() {
        if (updateTimer == null) {
            updateTimer = Timer()
            updateTimer?.scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    // Request update from React Native
                    requestUpdateFromApp()
                }
            }, 0, UPDATE_INTERVAL)
        }
    }
    
    private fun stopUpdates() {
        updateTimer?.cancel()
        updateTimer = null
        stopSelf()
    }
    
    private fun requestUpdateFromApp() {
        // Send broadcast to app to request data update
        val intent = Intent("com.sunshine.app.WIDGET_UPDATE_REQUEST")
        sendBroadcast(intent)
    }
    
    private fun updateWidget(context: Context, status: String, emoji: String, nextBreak: String, temp: String) {
        val prefs = context.getSharedPreferences("sunshine_widget", Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString("status", status)
            putString("emoji", emoji)
            putString("nextBreak", nextBreak)
            putString("temp", temp)
            apply()
        }
        
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val widgetIds = appWidgetManager.getAppWidgetIds(
            android.content.ComponentName(context, SunshineWidget::class.java)
        )
        
        for (id in widgetIds) {
            SunshineWidget.updateAppWidget(context, appWidgetManager, id)
        }
    }
    
    override fun onBind(intent: Intent?) = null
}