# Alert Testing Checklist

This document outlines all areas that need testing after migrating from React Native's `Alert` to `@blazejkustra/react-native-alert` for cross-platform support.

## Critical Areas to Test

### 1. Authentication & User Management

#### Sign In (`views/SignInView.tsx`)
- [ ] Error alert when sign-in fails
- [ ] Test on iOS, Android, and Web

#### Registration (`views/RegisterView.tsx`)
- [ ] Error alert when registration fails
- [ ] Test on iOS, Android, and Web

#### Forgot Password (`views/ForgotPasswordView.tsx`)
- [ ] Success alert after sending reset email
- [ ] Error alert on failure
- [ ] Test on iOS, Android, and Web

#### Reset Password (`views/ResetPasswordView.tsx`)
- [ ] Success alert after password reset
- [ ] Error alert on failure
- [ ] Test on iOS, Android, and Web

#### Account Deletion (`views/AccountDeletionView.tsx`)
- [ ] Error alert when offline
- [ ] Confirmation dialog before deletion (2 buttons: Cancel, Delete)
- [ ] Success alert after deletion
- [ ] Error alert on deletion failure
- [ ] Test on iOS, Android, and Web

#### Account Restore (`components/AccountDeletedOverlay.tsx`)
- [ ] Success alert after account restore
- [ ] Confirmation dialogs
- [ ] Test on iOS, Android, and Web

### 2. Profile & Settings

#### Profile View (`views/ProfileView.tsx`)
- [ ] Error alert when saving analytics preference fails
- [ ] Success alert when profile update succeeds
- [ ] Error alert when profile update fails
- [ ] **DEV MODE**: Confirmation dialogs for:
  - [ ] Seed data (2 buttons: Cancel, Confirm)
  - [ ] Delete data (2 buttons: Cancel, Confirm)
  - [ ] Delete local attachments (2 buttons: Cancel, Confirm)
- [ ] Test on iOS, Android, and Web

#### Settings View (`views/SettingsView.tsx`)
- [ ] Confirmation dialog for clearing cache (2 buttons: Cancel, Clear)
- [ ] Success alert after cache cleared
- [ ] Error alert when export requires internet
- [ ] Info alerts for coming soon features:
  - [ ] Export data
  - [ ] Help center
  - [ ] Contact support
  - [ ] Terms and conditions
- [ ] Test on iOS, Android, and Web

### 3. Projects & Quests

#### Project Directory (`views/new/ProjectDirectoryView.tsx`)
- [ ] Error alert when non-members try to create (membersOnlyCreate)
- [ ] Error alert on offload failure
- [ ] Test on iOS, Android, and Web

#### Quest Tree Row (`views/new/QuestTreeRow.tsx`)
- [ ] Alert when user tries to view cloud quest without downloading (2 buttons: Cancel, Download Now)
- [ ] Test on iOS, Android, and Web

#### Quest Settings (`components/QuestSettingsModal.tsx`)
- [ ] Error alert when settings fail to load
- [ ] Success/error alerts when updating quest settings
- [ ] Success alert when offload completes
- [ ] Error alert when offload fails
- [ ] Test on iOS, Android, and Web

#### NextGen Assets View (`views/new/NextGenAssetsView.tsx`) ⚠️ **CRITICAL**
- [ ] **Publish Quest**: Confirmation dialog now shows on ALL platforms (previously skipped on web)
  - [ ] Error alert when offline (cannotPublishWhileOffline)
  - [ ] Error alert when not a member (membersOnlyPublish)
  - [ ] Confirmation dialog with quest name (2 buttons: Cancel, Publish)
  - [ ] Success alert after publishing
  - [ ] Error alert on publish failure
- [ ] **Offload Quest**: Success/error alerts
- [ ] Test on iOS, Android, and **especially Web** (this was the main change)

### 4. Translations & Assets

#### New Translation Modal (`views/new/NextGenNewTranslationModal.tsx`)
- [ ] Alert when sign-in required
- [ ] Error alert when members only
- [ ] Success alert when translation submitted
- [ ] Error alerts for various validation failures
- [ ] Test on iOS, Android, and Web

#### Translation Modal Alt (`views/new/NextGenTranslationModalAlt.tsx`)
- [ ] Error alert when user not logged in to vote
- [ ] Success alert when transcription submitted
- [ ] Error alert when transcription creation fails
- [ ] Test on iOS, Android, and Web

#### Translation Settings (`components/TranslationSettingsModal.tsx`)
- [ ] Error alert when settings fail to load
- [ ] Success alert when status updated
- [ ] Error alert when update fails
- [ ] Test on iOS, Android, and Web

#### Asset Settings (`components/AssetSettingsModal.tsx`)
- [ ] Error alert when settings fail to load
- [ ] Success alerts when settings updated
- [ ] Error alerts when update fails
- [ ] Test on iOS, Android, and Web

### 5. Bible & Content Creation

#### Bible Chapter List (`views/new/BibleChapterList.tsx`)
- [ ] Error alert when non-members try to create
- [ ] Confirmation dialog when creating new chapter (2 buttons: Cancel, Create)
- [ ] Test on iOS, Android, and Web

### 6. Recording

#### Recording View Simplified (`views/new/recording/components/RecordingViewSimplified.tsx`)
- [ ] Confirmation dialogs for various actions
- [ ] Error alerts during recording operations
- [ ] Test on iOS, Android, and Web

#### Energy VAD Recorder (`components/EnergyVADRecorder.tsx`)
- [ ] Error alert when energy detection toggle fails
- [ ] Test on iOS, Android, and Web

### 7. Notifications & Invitations

#### Notifications View (`views/NotificationsView.tsx`)
- [ ] Success alert when invitation accepted
- [ ] Error alert when accept fails
- [ ] Success alert when invitation declined
- [ ] Error alert when decline fails
- [ ] Test on iOS, Android, and Web

#### Project Membership Modal (`components/ProjectMembershipModal.tsx`)
- [ ] Confirmation dialogs for:
  - [ ] Removing member
  - [ ] Promoting member
  - [ ] Leaving project
  - [ ] Withdrawing invitation
- [ ] Success/error alerts for all membership actions
- [ ] Error alert when cannot leave as only owner
- [ ] Error alert for invalid email
- [ ] Success alerts for invitation sent/resent
- [ ] Error alerts for max invite attempts
- [ ] Test on iOS, Android, and Web

#### Private Access Gate (`components/PrivateAccessGate.tsx`)
- [ ] Success alert when membership request sent
- [ ] Error alert when request fails
- [ ] Confirmation dialog for withdrawing request (2 buttons: Cancel, Confirm)
- [ ] Success alert when request withdrawn
- [ ] Error alert when withdrawal fails
- [ ] Test on iOS, Android, and Web

### 8. Reporting & Moderation

#### Report Modal (`components/ReportModal.tsx`)
- [ ] Error alert when user not logged in
- [ ] Error alert when reason not selected
- [ ] Success alert when report submitted
- [ ] Error alert when submission fails
- [ ] Test on iOS, Android, and Web

#### New Report Modal (`components/NewReportModal.tsx`)
- [ ] Confirmation dialog for sign-in requirement
- [ ] Error alert when reason not selected
- [ ] Success alert when report submitted
- [ ] Error alert when submission fails
- [ ] Test on iOS, Android, and Web

#### Vote Comment Modal (`components/VoteCommentModal.tsx`)
- [ ] Error alert when user not logged in
- [ ] Error alerts when vote fails
- [ ] Test on iOS, Android, and Web

### 9. System & Utilities

#### App Header (`components/AppHeader.tsx`)
- [ ] Error alert when sync error occurs
- [ ] Test on iOS, Android, and Web

#### Auth Context (`contexts/AuthContext.tsx`)
- [ ] Error alert when initialization fails
- [ ] Test on iOS, Android, and Web

#### Supabase Connector (`db/supabase/SupabaseConnector.ts`)
- [ ] Alert when upload issue occurs
- [ ] Test on iOS, Android, and Web

#### Corrupted Attachments (`views/CorruptedAttachmentsView.tsx`)
- [ ] Error alert when loading fails
- [ ] Confirmation dialogs for cleaning attachments
- [ ] Success/error alerts for cleanup operations
- [ ] Test on iOS, Android, and Web

#### Restore Utils (`utils/restoreUtils.ts`)
- [ ] Error alert when restore attempted on non-Android
- [ ] Error alert when permission denied
- [ ] Confirmation dialogs for restore operations
- [ ] Success alert when restore starts
- [ ] Success alert when restore completes
- [ ] Error alert when restore fails
- [ ] Test on iOS, Android, and Web

### 10. Project Settings

#### Project Settings Modal (`components/ProjectSettingsModal.tsx`)
- [ ] Error alert when settings fail to load
- [ ] Success alert when settings updated
- [ ] Error alert when update fails
- [ ] Test on iOS, Android, and Web

## Cross-Platform Testing Requirements

### Web Platform (Previously Skipped)
The following alerts were previously skipped on web but now work:

1. **NextGenAssetsView.tsx - Publish Quest Confirmation**
   - Previously: Skipped confirmation, published directly
   - Now: Shows confirmation dialog on all platforms
   - **CRITICAL**: Verify the confirmation dialog appears and works correctly on web

### Platform-Specific Testing

#### iOS
- [ ] All alerts display correctly
- [ ] Button styles (cancel, destructive, default) work properly
- [ ] Alerts are dismissible
- [ ] Multiple button alerts work correctly

#### Android
- [ ] All alerts display correctly
- [ ] Button styles (cancel, destructive, default) work properly
- [ ] Alerts are dismissible
- [ ] Multiple button alerts work correctly

#### Web
- [ ] All alerts display correctly (previously many were skipped)
- [ ] Alert dialogs are styled appropriately
- [ ] Button styles work correctly
- [ ] Alerts are dismissible
- [ ] Multiple button alerts work correctly
- [ ] Dark/light theme support works
- [ ] Keyboard navigation works

## Alert Types to Test

### Single Button Alerts
- [ ] Simple success messages
- [ ] Simple error messages
- [ ] Simple info messages

### Two-Button Alerts (Confirm/Cancel)
- [ ] Cancel button works
- [ ] Confirm/Action button works
- [ ] Destructive actions (red button) display correctly
- [ ] Cancel button style displays correctly

### Multi-Button Alerts (3+ buttons)
- [ ] All buttons display correctly
- [ ] Each button's onPress handler works
- [ ] Button styles are correct

### Alerts with Options
- [ ] `cancelable: false` option works
- [ ] Alert cannot be dismissed by tapping outside

## Edge Cases to Test

1. **Rapid Alert Triggering**
   - [ ] Multiple alerts triggered quickly don't overlap incorrectly
   - [ ] Previous alerts are properly dismissed

2. **Network Errors**
   - [ ] Alerts work when offline
   - [ ] Error messages display correctly

3. **Long Text**
   - [ ] Alerts with long titles/messages display correctly
   - [ ] Text doesn't overflow or break layout

4. **Localization**
   - [ ] All alert messages are properly translated
   - [ ] Button text is translated correctly

5. **Theme Support**
   - [ ] Alerts work in light mode
   - [ ] Alerts work in dark mode
   - [ ] Colors are appropriate for each theme

## Regression Testing

Verify that the following still work as expected:

- [ ] No alerts are accidentally skipped on any platform
- [ ] All user flows that previously showed alerts still show them
- [ ] Alert callbacks (onPress handlers) execute correctly
- [ ] Navigation after alerts still works correctly
- [ ] State updates after alerts still work correctly

## Priority Testing Order

1. **HIGH PRIORITY**: NextGenAssetsView.tsx - Publish Quest (was skipped on web)
2. **HIGH PRIORITY**: All authentication flows (sign in, register, password reset)
3. **MEDIUM PRIORITY**: Profile and settings operations
4. **MEDIUM PRIORITY**: Project and quest management
5. **LOW PRIORITY**: Dev mode operations (seed data, wipe database)

## Notes

- The library `@blazejkustra/react-native-alert` is a drop-in replacement for React Native's Alert
- It provides the same API, so behavior should be identical
- Main difference: It now works on Web platform where React Native's Alert didn't
- All `Platform.OS === 'web'` checks that skipped alerts have been removed
