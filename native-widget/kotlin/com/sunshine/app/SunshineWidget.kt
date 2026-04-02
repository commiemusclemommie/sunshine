package com.sunshine.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.content.Intent
import android.app.PendingIntent
import android.content.SharedPreferences

class SunshineWidget : AppWidgetProvider() {
    
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    override fun onEnabled(context: Context) {
        // Start update service when first widget is added
        val intent = Intent(context, WidgetUpdateService::class.java)
        intent.action = WidgetUpdateService.ACTION_START
        context.startService(intent)
    }
    
    override fun onDisabled(context: Context) {
        // Stop update service when last widget is removed
        val intent = Intent(context, WidgetUpdateService::class.java)
        intent.action = WidgetUpdateService.ACTION_STOP
        context.startService(intent)
    }
    
    companion object {
        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences("sunshine_widget", Context.MODE_PRIVATE)
            val status = prefs.getString("status", "Loading...") ?: "Loading..."
            val emoji = prefs.getString("emoji", "?") ?: "?"
            val nextBreak = prefs.getString("nextBreak", "--") ?: "--"
            val temp = prefs.getString("temp", "--") ?: "--"
            
            val views = RemoteViews(context.packageName, R.layout.widget_layout)
            
            views.setTextViewText(R.id.widget_emoji, emoji)
            views.setTextViewText(R.id.widget_status, status)
            views.setTextViewText(R.id.widget_next, "Next: $nextBreak")
            views.setTextViewText(R.id.widget_temp, "${temp}°")
            
            // Tap to open app
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}