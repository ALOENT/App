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
  let hash = 0;
  for (let i = 0; i < task.id.length; i++) {
    hash = ((hash << 5) - hash) + task.id.charCodeAt(i);
    hash |= 0; 
  }
  const notificationId = Math.abs(hash) % 2147483647;

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

      // 3. Ensure the date is still in the future
      const now = Date.now();
      const scheduledDate = new Date(reminderDate.getTime());
      
      console.log('[DEBUG] Scheduling native notification:', {
        taskId: task.id,
        notificationId: notificationId,
        reminderTime: task.reminderTime,
        scheduledFor: scheduledDate.toString(),
        msUntil: scheduledDate.getTime() - now
      });

      // 4. Schedule via Capacitor
      await LocalNotifications.schedule({
        notifications: [{
          id: notificationId,
          title: 'TaskFlow Reminder 🔔',
          body: `Time to: ${task.title}`,
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
                title: 'TaskFlow Reminder 🔔',
                body: `Time to: ${task.title}`,
                taskId: task.id
              });
            } else {
              new Notification('TaskFlow Reminder 🔔', {
                body: `Time to: ${task.title}`,
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

// ============================================
//  RESCHEDULE ALL REMINDERS (on app startup)
//
//  Takes the full tasks array from Firestore.
//  Filters for tasks that:
//    - Have a reminderTime set
//    - reminderTime is in the future
//    - Task is not completed
//  Schedules each one and returns a Map of taskId → notificationId
//
//  This is critical after phone restart or browser reload,
//  because all in-memory timers / native notifications are lost.
// ============================================
export async function rescheduleAllReminders(tasks) {
  const results = new Map();

  const pending = tasks.filter(t =>
    t.reminderTime &&
    !t.completed &&
    new Date(t.reminderTime).getTime() > Date.now()
  );

  for (const task of pending) {
    const notificationId = await scheduleTaskReminder(task);
    if (notificationId != null) {
      results.set(task.id, notificationId);
    }
  }

  return results;
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
    title: 'Test Notification 🧪',
    reminderTime: tenSecsFromNow.toISOString()
  });
}
