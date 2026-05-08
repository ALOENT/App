// ============================================
//  TaskFlow — Notification Scheduling (Platform-Aware)
//
//  This module handles task reminder notifications.
//  On native platforms (Android/iOS via Capacitor):
//    → Uses @capacitor/local-notifications for real OS-level alerts
//  On web (browser):
//    → Uses the Web Notifications API + setTimeout for timed alerts
//    → Falls back gracefully if permissions are denied
//
//  BROWSER LIMITATION: If the tab is fully closed (not just minimized),
//  web notifications scheduled via setTimeout will NOT fire.
//  This is inherent to how browsers work — not a bug.
//  For reliable background notifications, use the native mobile app.
// ============================================

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// ============================================
//  In-memory store for web setTimeout IDs
//  Maps taskId → timeoutId so we can cancel timers
// ============================================
const webTimerMap = new Map();

// ============================================
//  ID GENERATION
//  Returns a unique numeric ID for a task string ID
// ============================================
function getNotificationId(taskId) {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = ((hash << 5) - hash) + taskId.charCodeAt(i);
    hash |= 0; 
  }
  return Math.abs(hash) % 2147483647;
}

// ============================================
//  PLATFORM DETECTION
//  Returns true when running inside the Capacitor native shell
// ============================================
function isNative() {
  return Capacitor.isNativePlatform();
}

// ============================================
//  SCHEDULE A TASK REMINDER
//
//  Takes a task object with { id, title, reminderTime }
//  Returns a numeric notificationId (to save in Firestore)
//
//  On native: schedules a real OS notification via Capacitor
//  On web: uses setTimeout + Web Notifications API
// ============================================
export async function scheduleTaskReminder(task) {
  if (!task.reminderTime) return null;

  const reminderDate = new Date(task.reminderTime);
  const msUntil = reminderDate.getTime() - Date.now();

  // Don't schedule notifications for past times
  if (msUntil <= 0) return null;

  // Generate a unique numeric notification ID using a hash of task.id
  const notificationId = getNotificationId(task.id);

  if (isNative()) {
    // ── NATIVE (Capacitor) ──
    try {
      // 1. Check current permission status
      const check = await LocalNotifications.checkPermissions();
      console.log('Current notification permissions:', check);

      // 2. Request permission if not already granted (Android 13+ support)
      if (check.display !== 'granted') {
        const request = await LocalNotifications.requestPermissions();
        if (request.display !== 'granted') {
          console.warn('Notification permission denied after request');
          return null;
        }
      }

      const now = Date.now();
      const scheduledDate = new Date(reminderDate.getTime());
      
      const notificationTitle = `⏰ ${task.text || task.title || 'Task Reminder'}`;
      const notificationBody = task.notes || task.description || 'You have a pending task';

      console.log('[DEBUG] Native Notification Prep:', {
        taskId: task.id,
        rawTask: task, // Log full object as requested
        finalTitle: notificationTitle,
        finalBody: notificationBody,
        scheduledFor: scheduledDate.toString()
      });

      // 4. Schedule via Capacitor
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: notificationTitle,
          body: notificationBody,
          schedule: { at: scheduledDate },
          sound: 'default',
          actionTypeId: '',
          extra: { taskId: task.id }
        }]
      });
      
      console.log(`[SUCCESS] Notification ${notificationId} scheduled for task ${task.id}`);
    } catch (err) {
      console.error('Error scheduling native notification:', err);
      return null;
    }
  } else {
    // ── WEB (Browser) ──
    try {
      // Request browser notification permission
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') {
        console.warn('Web notification permission denied');
        return null;
      }

      // Schedule the notification using setTimeout recursively if needed
      const MAX_TIMEOUT = 2147483647;
      
      const scheduleWebTimer = (delay) => {
        if (delay > MAX_TIMEOUT) {
          const timeoutId = setTimeout(() => {
            scheduleWebTimer(reminderDate.getTime() - Date.now());
          }, MAX_TIMEOUT);
          webTimerMap.set(task.id, timeoutId);
        } else {
          const timeoutId = setTimeout(() => {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  title: `⏰ ${task.text || task.title || 'Task Reminder'}`,
                  body: task.notes ? task.notes : 'Time to get things done!',
                  taskId: task.id
                });
              } else {
                new Notification(`⏰ ${task.text || task.title || 'Task Reminder'}`, {
                  body: task.notes ? task.notes : 'Time to get things done!',
                  icon: '/favicon.ico',
                  tag: `task-${task.id}`
                });
              }
            webTimerMap.delete(task.id);
          }, delay);
          webTimerMap.set(task.id, timeoutId);
        }
      };

      scheduleWebTimer(msUntil);
    } catch (err) {
      console.error('Error scheduling web notification:', err);
      return null;
    }
  }

  return notificationId;
}

// ============================================
//  CANCEL A TASK REMINDER
//
//  Takes the notificationId (from Firestore) and the taskId
//  On native: cancels the Capacitor local notification
//  On web: clears the setTimeout timer
// ============================================
export async function cancelTaskReminder(notificationId, taskId) {
  if (isNative()) {
    // ── NATIVE ──
    if (notificationId != null) {
      try {
        await LocalNotifications.cancel({
          notifications: [{ id: notificationId }]
        });
      } catch (err) {
        console.error('Error cancelling native notification:', err);
      }
    }
  } else {
    // ── WEB ──
    if (taskId && webTimerMap.has(taskId)) {
      clearTimeout(webTimerMap.get(taskId));
      webTimerMap.delete(taskId);
    }
  }
}

export async function rescheduleAllReminders(tasks) {
  const results = new Map();

  // On native, we can check what's already scheduled to avoid duplicates
  let pendingNativeIds = new Set();
  if (isNative()) {
    try {
      const pending = await LocalNotifications.getPending();
      pendingNativeIds = new Set(pending.notifications.map(n => n.id));
      console.log(`[SYNC] Found ${pendingNativeIds.size} pending native notifications`);
    } catch (err) {
      console.warn('Failed to fetch pending notifications:', err);
    }
  }

  const now = Date.now();
  const tasksToSchedule = tasks.filter(t =>
    t.reminderTime &&
    !t.completed &&
    new Date(t.reminderTime).getTime() > now
  );

  for (const task of tasksToSchedule) {
    const notificationId = getNotificationId(task.id);
    
    // Skip if already scheduled on native
    if (isNative() && pendingNativeIds.has(notificationId)) {
      results.set(task.id, notificationId);
      continue;
    }

    // Skip if already scheduled on web (simple check)
    if (!isNative() && webTimerMap.has(task.id)) {
      results.set(task.id, notificationId);
      continue;
    }

    const scheduledId = await scheduleTaskReminder(task);
    if (scheduledId != null) {
      results.set(task.id, scheduledId);
    }
  }

  // Also clean up notifications for tasks that were completed on another device
  const completedTasksWithReminders = tasks.filter(t => t.completed && t.reminderTime);
  for (const task of completedTasksWithReminders) {
    const notificationId = getNotificationId(task.id);
    if (isNative() && pendingNativeIds.has(notificationId)) {
      console.log(`[SYNC] Cancelling completed task reminder: ${task.id}`);
      await cancelTaskReminder(notificationId, task.id);
    } else if (!isNative() && webTimerMap.has(task.id)) {
      await cancelTaskReminder(notificationId, task.id);
    }
  }

  return results;
}

// ============================================
//  INITIALIZE PERMISSIONS (on app start)
// ============================================
export async function initNotifications() {
  if (isNative()) {
    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.error('Failed to init notifications:', err);
    }
  }
}

// ============================================
//  REGISTER SERVICE WORKER (web only)
//
//  Registers sw.js for background web notifications.
//  Called once on app startup when running in browser.
// ============================================
export async function registerServiceWorker() {
  if (!isNative() && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered for web notifications');
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

// ============================================
//  TEST NOTIFICATION
//  Schedules a dummy notification 10 seconds from now
// ============================================
export async function testNotification() {
  const tenSecsFromNow = new Date(Date.now() + 10000);
  console.log('Scheduling test notification for:', tenSecsFromNow.toString());
  
  return await scheduleTaskReminder({
    id: 'test-notif-' + Date.now(),
    text: 'Test Notification 🧪',
    notes: 'This is a test to verify your notification settings.',
    reminderTime: tenSecsFromNow.toISOString()
  });
}
