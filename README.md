# TaskFlow ✅

> **Stay organized, stay productive.**  
> A full-stack, cross-platform task management app built with Vanilla JS, Firebase, and Capacitor.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)

---

## 📱 Overview

TaskFlow is a production-grade task management application that works seamlessly across web, Android, and iOS. Built with a focus on security, performance, and a clean user experience — it supports real-time sync, smart reminders, subtasks, recurring tasks, and a fully responsive interface with dark/light mode.

---

## ✨ Features

### Core
- **Google Sign-In & Email/Password Auth** via Firebase Authentication
- **Real-time Sync** — changes reflect instantly across all devices via Firestore
- **CRUD Operations** — create, edit, delete, and complete tasks
- **Categories** — Work, Personal, Shopping, Health, Other
- **Task Priority** — High 🔴, Medium 🟠, Low 🟢 with color-coded badges
- **Subtasks** — nested checklists with progress tracking inside each task
- **Task Notes** — expandable description field per task
- **Recurring Tasks** — Daily / Weekly / Monthly auto-repeat on completion
- **Drag to Reorder** — HTML5 drag & drop with touch support
- **Search & Filter** — real-time search across title, notes, and category

### Notifications & Reminders
- **Scheduled Reminders** — set a date/time for any task
- **Local Notifications** — via Capacitor for native Android/iOS alerts
- **Web Notifications** — browser-based fallback via Service Worker
- **Auto-reschedule** — all pending reminders re-registered on app launch

### UI/UX
- **Dark / Light Mode** — persistent theme preference with smooth transition
- **Desktop Sidebar Layout** — two-column layout with navigation, categories, and stats
- **Mobile App Layout** — greeting, progress bar, FAB button, bottom sheet, drawer
- **Responsive Design** — fully optimized from 390px to 1440px
- **Today / Upcoming / Completed Views** — smart task filtering

### Security
- **Firestore Rules** — strict per-user data isolation
- **XSS Prevention** — all inputs sanitized with DOMPurify before DB writes
- **Content Security Policy** — strict CSP meta tags in HTML
- **Auth Guards** — all Firestore operations gated behind auth state checks
- **Anti-tracking** — no third-party analytics, referrer policy enforced

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Bundler | Vite 8 |
| Backend | Firebase (Auth + Firestore) |
| Mobile | Capacitor 8 (Android + iOS) |
| Notifications | @capacitor/local-notifications |
| Date Picker | flatpickr |
| Sanitization | DOMPurify |

---

## 📁 Project Structure

```
TaskFlow/
├── app.js                  # Main app logic, UI rendering, event handling
├── index.html              # HTML structure (auth screen + dashboard)
├── style.css               # Design system, responsive layout, themes
├── firebase-config.js      # Firebase SDK initialization
├── notifications.js        # Capacitor local notifications wrapper
├── sanitize.js             # DOMPurify XSS sanitization utility
├── vite.config.js          # Vite bundler config
├── capacitor.config.json   # Capacitor mobile config
├── firebase.json           # Firebase Hosting config
├── firestore.rules         # Firestore security rules
├── public/
│   └── sw.js               # Service worker for web notifications
├── android/                # Capacitor Android native project
└── ios/                    # Capacitor iOS native project
```

---

## 🗃️ Firestore Schema

**Collection:** `/users/{userId}/tasks/{taskId}`

```javascript
{
  text:           String,    // Task title
  notes:          String,    // Optional description
  category:       String,    // 'work' | 'personal' | 'shopping' | 'health' | 'other'
  priority:       String,    // 'high' | 'medium' | 'low' | 'none'
  completed:      Boolean,   // Completion status
  subtasks:       Array,     // [{ id, text, completed }]
  recurrence:     String,    // 'none' | 'daily' | 'weekly' | 'monthly'
  reminderTime:   String,    // ISO timestamp for reminder
  notificationId: Number,    // Capacitor notification ID for cancellation
  order:          Number,    // Timestamp for sorting
  createdAt:      Timestamp  // Firestore server timestamp
}
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Android Studio (for Android builds)
- Xcode on macOS (for iOS builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/ALOENT/TaskFlow.git
cd TaskFlow

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

Create a `.env` file in the root directory and add your Firebase config to `firebase-config.js`.

> ⚠️ Never commit `.env` or sensitive keys to version control.

---

## 📦 Available Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production → dist/
npm run preview      # Preview production build locally
npm run sync         # Build + sync to Android & iOS
npm run open:android # Open Android project in Android Studio
npm run open:ios     # Open iOS project in Xcode (macOS only)
```

---

## 📲 Mobile Build (Android)

```bash
# Build web app and sync to native
npm run sync

# Open in Android Studio
npm run open:android
```

In Android Studio: **Build → Build Bundle/APK → Build APK**

### Required Android Permissions
Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.USE_EXACT_ALARM" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

## 🔒 Architecture & Security

### Performance & Error Handling
- **Serverless Architecture:** Entirely powered by Firebase (Auth + Firestore). No custom middleware required; Firebase handles rate-limiting, DDoS protection, and scaling automatically.
- **Offline-First Caching:** Firestore automatically caches fetched data locally for instant loads and seamless offline support.
- **Optimized UI:** Implements 200ms debouncing for real-time search and custom throttling for window resize events to prevent layout thrashing.
- **Robust Error Handling:** Comprehensive `try/catch` wrappers around all network requests, dynamic imports, and sensitive auth flows to prevent silent failures.

### Security Implementation
- **Data Isolation:** All user data is isolated per UID via strict Firestore Security Rules.
- **XSS Prevention:** All text inputs are aggressively sanitized with DOMPurify before any database write and DOM injection.
- **Content Security Policy:** Strict CSP meta tags prevent unauthorized script execution.
- **No Third-Party Tracking:** Zero analytics or tracking scripts; strict referrer policy enforced.

---

## ⚠️ Known Limitations

- **Recurring tasks** rely on client-side execution — may miss if app is closed at completion time
- **Notifications** are local only — no server-side FCM push (requires Firebase Blaze plan)
- **Drag & drop** ordering may not persist across all filtered views
- **iOS builds** require macOS with Xcode

---

## 🗺️ Roadmap

- [ ] Calendar view for tasks with reminders
- [ ] Weekly statistics chart
- [ ] FCM push notifications (server-side)
- [ ] Workspace / team collaboration features
- [ ] PWA offline-first support

---

## 🏗️TaskFlow Architecture Diagram

<img width="2560" height="2624" alt="_C__Users_ISHANT_Downloads_taskflow-architecture html" src="https://github.com/user-attachments/assets/0ddd28f0-f961-47af-9baf-33ee0e7a7e3e" />

---


## 👤 Author

**Kanishk Garg**  
[GitHub](https://github.com/ALOENT)

---

## 📄 License

This project is for personal and portfolio use.

