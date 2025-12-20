# PR #607: Video Showcase Guide

## Overview
This PR introduces a comprehensive UI refactor with a new tooltip system, modal-to-drawer migrations, and a major VAD settings overhaul with interactive energy visualization.

---

## 🎬 Key UI Changes to Showcase

### 1. **New Tooltip System** ⭐ (HIGH PRIORITY)
**What Changed:**
- Brand new native-aware tooltip component (`components/ui/tooltip.tsx`)
- Smooth animations with origin-aware scaling
- Platform-specific delays (400ms on web, instant on native)
- Works seamlessly across iOS, Android, and Web

**Where to Show:**
- **VAD Settings Drawer**: Hover/tap the help icon (❓) next to the title
- **Project Membership Modal**: Look for tooltips on various action buttons
- Any other components that now have tooltips

**What to Demonstrate:**
- Show tooltip appearing/disappearing smoothly
- Show different tooltip positions (top, bottom, left, right)
- Note the smooth animation and proper positioning
- Show on both native and web if possible

---

### 2. **Modal → Drawer Migration** ⭐ (HIGH PRIORITY)
**What Changed:**
Multiple modals converted to bottom drawers for better mobile UX:
- `AssetSettingsModal` → Drawer
- `ProjectMembershipModal` → Drawer  
- `ProjectSettingsModal` → Drawer
- `QuestSettingsModal` → Drawer
- `AuthModal` → Drawer

**Where to Show:**
1. **Asset Settings**:
   - Navigate to any asset
   - Open asset settings
   - Show the new drawer sliding up from bottom
   - Demonstrate swipe-to-close gesture

2. **Project Membership**:
   - Open project settings
   - Navigate to members section
   - Show the drawer with tabs (Members, Invited, Requests)
   - Show smooth transitions between tabs

3. **Project/Quest Settings**:
   - Open any project or quest settings
   - Show drawer layout improvements

**What to Demonstrate:**
- Smooth drawer animations
- Swipe gestures to close
- Better mobile-friendly layout
- Improved spacing and padding

---

### 3. **VAD Settings Drawer - Major Revamp** ⭐⭐⭐ (HIGHEST PRIORITY)
**What Changed:**
Complete redesign of the Voice Activity Detection (VAD) settings with:
- **Interactive Energy Visualization**: Real-time segmented energy bar
- **Live Microphone Energy Display**: Shows current audio levels
- **Animated Status Indicators**: Recording/Waiting/Paused states
- **Improved Threshold Control**: Visual sensitivity bar with gradient
- **Performance Optimizations**: Reduced re-renders, worklet-based animations

**Where to Show:**
- Navigate to recording screen
- Open VAD settings drawer
- Start speaking into microphone

**What to Demonstrate:**
1. **Energy Bar Visualization**:
   - Show the segmented energy bar filling up as you speak
   - Show the gradient colors (green → yellow → red)
   - Show the threshold marker (red line) moving
   - Demonstrate how it responds in real-time to your voice

2. **Status Indicators**:
   - Show "💤 Waiting" when below threshold
   - Show "🎤 Recording Now" when above threshold
   - Show "⏸️ Paused" when dragging the drawer
   - Smooth transitions between states

3. **Threshold Control**:
   - Show the sensitivity bar with gradient background
   - Demonstrate adjusting threshold with +/- buttons
   - Show threshold marker moving on both bars
   - Show auto-calibrate feature

4. **Performance**:
   - Note smooth animations even during high-frequency updates
   - Show drawer can be dragged without lag
   - Energy visualization pauses during drag (performance optimization)

---

### 4. **SwitchBox Component Updates** ⭐
**What Changed:**
- Added icon support (Eye/EyeOff, CheckCircle/XCircle)
- Improved spacing and layout
- Better visual hierarchy

**Where to Show:**
- **Asset Settings Drawer**:
  - Show visibility toggle with Eye/EyeOff icon
  - Show active toggle with CheckCircle/XCircle icon
  - Note improved spacing between switches

**What to Demonstrate:**
- Icons change based on state
- Better visual feedback
- Cleaner layout

---

### 5. **Form & Input Improvements** ⭐
**What Changed:**
- Refined spacing and padding across forms
- Improved input styling
- Better form layouts

**Where to Show:**
- Any form in the app (sign in, project settings, etc.)
- Show improved spacing
- Show better visual consistency

---

### 6. **Drawer Component Enhancements**
**What Changed:**
- Exported `DrawerView` component
- Better gesture handling
- Improved keyboard behavior
- Custom gesture event handlers support

**Where to Show:**
- Any drawer in the app
- Show smooth gestures
- Show keyboard handling improvements

---

## 📋 Video Script Suggestions

### Opening (0:00 - 0:15)
"Today we're showcasing a major UI refactor that improves the mobile experience across the app. Let's dive into the key changes."

### 1. Tooltip System (0:15 - 0:45)
"First up, we've added a brand new tooltip system that works seamlessly across iOS, Android, and Web. Notice the smooth animations and proper positioning. Here in the VAD settings, you can see helpful tooltips when you tap the help icon."

### 2. Modal to Drawer Migration (0:45 - 1:30)
"One of the biggest changes is migrating modals to bottom drawers for better mobile UX. Here's the asset settings - notice how it slides up smoothly and you can swipe to close. The same improvement applies to project membership, project settings, and quest settings."

### 3. VAD Settings Revamp (1:30 - 3:00) ⭐ MAIN FEATURE
"This is the star of the show - a complete redesign of our VAD settings. Watch as I speak - you can see the energy bar filling up in real-time with a beautiful gradient. The threshold marker shows where recording will trigger. Notice the smooth status transitions - waiting, recording, and paused states. The entire visualization runs smoothly even with high-frequency updates thanks to performance optimizations."

### 4. SwitchBox & Form Improvements (3:00 - 3:30)
"Throughout the app, you'll notice improved switch components with icons, better spacing, and cleaner layouts. Forms have been refined for better consistency."

### Closing (3:30 - 3:45)
"These changes make the app more intuitive and performant, especially on mobile devices. Thanks for watching!"

---

## 🎯 Priority Order for Video

1. **VAD Settings Drawer** (MUST SHOW) - Most impressive visual change
2. **Tooltip System** - New feature, easy to demonstrate
3. **Modal → Drawer Migration** - Major UX improvement
4. **SwitchBox Updates** - Quick visual polish
5. **Form Improvements** - Subtle but important

---

## 📝 Technical Highlights to Mention (Optional)

- Native-aware animations using React Native Reanimated
- Worklet-based performance optimizations
- Reduced re-renders through memoization
- Platform-specific optimizations (iOS, Android, Web)
- Improved gesture handling
- Better keyboard management

---

## 🔍 Files Changed Summary

**New Files:**
- `components/ui/tooltip.tsx` - Tooltip component
- `components/ui/native-only-animated-view.tsx` - Native animation wrapper

**Major Refactors:**
- `views/new/recording/components/VADSettingsDrawer.tsx` - Complete redesign
- `components/AssetSettingsModal.tsx` - Modal → Drawer
- `components/ProjectMembershipModal.tsx` - Modal → Drawer
- `components/SwitchBox.tsx` - Added icons

**UI Component Updates:**
- Drawer component enhancements
- Form, Input, Select, Textarea improvements
- Button, Switch, Radio Group updates

---

## 💡 Tips for Recording

1. **VAD Settings**: Make sure microphone permissions are granted
2. **Speak clearly** when demonstrating the energy visualization
3. **Show gestures**: Demonstrate swipe-to-close on drawers
4. **Compare before/after**: If possible, show old modal vs new drawer
5. **Highlight smoothness**: Emphasize the smooth animations throughout

