# PR #607: Critical Testing Checklist

## 🚨 HIGH PRIORITY - Could Cause Serious Issues

### 1. **VAD Settings Drawer - Ref-Based State Management** ⚠️ CRITICAL
**Risk:** Stale closures, race conditions, memory leaks

**Test Scenarios:**
- [ ] **Rapid open/close**: Open and close drawer rapidly multiple times
  - Verify energy detection starts/stops correctly each time
  - Check for memory leaks (no intervals/timeouts left running)
  - Verify calibration cancels properly on close

- [x] **Calibration cleanup**: Start calibration, then immediately close drawer
  - Verify all intervals/timeouts are cleared
  - Verify no errors in console
  - Reopen drawer - should work normally

- [ ] **VAD Locked state**: 
  - Open drawer while VAD is locked (during recording)
  - Close drawer - energy detection should NOT stop
  - Unlock VAD, close drawer - energy detection SHOULD stop
  - Verify no double-stops or memory leaks

- [ ] **Callback refs**: Change threshold/silence duration while drawer is open
  - Verify changes persist correctly
  - Verify callbacks aren't stale (use latest values)
  - Test rapid changes

- [ ] **Auto-calibrate on open**: 
  - Open drawer with `autoCalibrateOnOpen={true}`
  - Verify calibration starts automatically
  - Close drawer before calibration completes
  - Reopen - verify no duplicate calibrations

- [ ] **React.memo edge cases**:
  - Change callback props (onThresholdChange, onSilenceDurationChange) while drawer closed
  - Open drawer - verify new callbacks are used
  - Verify drawer still re-renders when `isOpen` changes

### 2. **Energy Detection Lifecycle** ⚠️ CRITICAL
**Risk:** Microphone permissions, resource leaks, battery drain

**Test Scenarios:**
- [ ] **Permission denied**: Deny microphone permission
  - Open VAD drawer - should handle gracefully
  - No crashes or infinite loops

- [ ] **Multiple drawers**: Open VAD drawer, then open another drawer
  - Verify energy detection stops when VAD drawer closes
  - No conflicts between drawers

- [ ] **App backgrounding**: 
  - Open VAD drawer with energy detection active
  - Background app
  - Foreground app
  - Verify energy detection state is correct

- [ ] **Component unmount**: 
  - Open VAD drawer
  - Navigate away (unmount component)
  - Verify cleanup happens (check console logs)
  - No memory leaks

### 3. **Modal → Drawer Migration - Data Persistence** ⚠️ CRITICAL
**Risk:** Data loss, unsaved changes, form submission issues

**Test Scenarios:**

**AssetSettingsModal:**
- [ ] Toggle visibility/active switches
  - Verify changes save correctly
  - Close drawer mid-toggle - verify state consistency
  - Test error handling (network failure)

- [ ] **Independent toggles**: 
  - Toggle visibility independently (shouldn't affect active)
  - Toggle active independently (shouldn't affect visibility)
  - Verify logic matches new implementation

**ProjectMembershipModal:**
- [ ] **Invite user**: 
  - Send invitation
  - Close drawer before response
  - Verify invitation still processes
  - Verify UI updates correctly

- [x] **Remove member**: 
  - Remove member
  - Verify member list updates
  - Test error handling

- [x] **Tabs switching**: 
  - Switch between Members/Invited/Requests tabs
  - Verify data persists
  - Verify no data loss

**ProjectSettingsModal / QuestSettingsModal:**
- [x] Toggle settings
  - Verify changes save
  - Test error scenarios
  - Verify UI reflects saved state

### 4. **Worklet/SharedValue Synchronization** ⚠️ CRITICAL
**Risk:** UI thread crashes, incorrect values, performance issues

**Test Scenarios:**
- [ ] **Energy bar visualization**:
  - Speak into microphone
  - Verify energy bar updates smoothly
  - Verify threshold marker moves correctly
  - Test rapid speech (high frequency updates)

- [ ] **Dragging drawer**:
  - Drag drawer while energy visualization is active
  - Verify visualization pauses (dimmed colors)
  - Verify resumes when drag ends
  - No crashes or freezes

- [ ] **scheduleOnRN bridge**:
  - Verify energy values sync from UI thread to JS thread
  - Test calibration sampling (uses latestEnergyRef)
  - Verify no race conditions

- [ ] **Frame skipping**:
  - Verify energy bar updates at ~20fps (not 60fps)
  - Check performance (should be smooth)
  - Verify cached values work correctly

### 5. **Keyboard Handling in Drawers** ⚠️ HIGH
**Risk:** Keyboard covering inputs, layout issues

**Test Scenarios:**
- [ ] **ProjectMembershipModal**: 
  - Open drawer
  - Tap email input
  - Verify keyboard doesn't cover input
  - Verify drawer adjusts correctly
  - Test on iOS and Android

- [ ] **All drawer forms**:
  - Test all text inputs in drawers
  - Verify keyboard behavior
  - Test submit buttons remain accessible

### 6. **Tooltip System** ⚠️ MEDIUM-HIGH
**Risk:** Z-index issues, portal rendering problems, performance

**Test Scenarios:**
- [ ] **Portal rendering**:
  - Open tooltip in drawer
  - Verify tooltip renders above drawer
  - Verify z-index correct (6000+)

- [ ] **Multiple tooltips**:
  - Open multiple tooltips rapidly
  - Verify only one shows at a time
  - Verify cleanup happens

- [ ] **Platform differences**:
  - Test tooltip delay (400ms web, 0ms native)
  - Verify animations work on all platforms
  - Test positioning (top/bottom/left/right)

- [ ] **Memory leaks**:
  - Open/close tooltips repeatedly
  - Check for memory leaks
  - Verify portals cleanup

### 7. **Gesture Handling** ⚠️ MEDIUM
**Risk:** Drawer gestures broken, conflicts with other gestures

**Test Scenarios:**
- [ ] **Swipe to close**:
  - Open any drawer
  - Swipe down to close
  - Verify smooth animation
  - Verify onClose callback fires

- [ ] **Custom gesture handler (VAD)**:
  - Open VAD drawer
  - Drag drawer
  - Verify isDragging state updates
  - Verify energy visualization pauses
  - No conflicts with other gestures

- [ ] **Dismissible prop**:
  - Test drawers with `dismissible={false}`
  - Verify can't swipe to close
  - Verify close button still works

### 8. **Form Validation & Error Handling** ⚠️ MEDIUM
**Risk:** Invalid data submission, poor error UX

**Test Scenarios:**
- [ ] **Network errors**:
  - Disable network
  - Try to save settings
  - Verify error message shows
  - Verify state doesn't corrupt

- [ ] **Validation errors**:
  - Submit invalid data
  - Verify validation works
  - Verify error messages display

- [ ] **Loading states**:
  - Verify loading indicators show
  - Verify buttons disabled during submission
  - Verify no double-submissions

## 🔍 Edge Cases to Test

### Performance
- [ ] **High-frequency updates**: VAD energy bar with rapid speech
- [ ] **Multiple drawers**: Open multiple drawers in sequence
- [ ] **Long sessions**: Keep VAD drawer open for extended period

### State Management
- [ ] **Prop changes while closed**: Change props, then open drawer
- [ ] **Unmount during operation**: Navigate away during calibration
- [ ] **Concurrent operations**: Multiple async operations simultaneously

### Platform-Specific
- [ ] **iOS**: Test all features on iOS
- [ ] **Android**: Test all features on Android  
- [ ] **Web**: Test tooltip delays, drawer behavior

### Accessibility
- [ ] **Screen readers**: Test with VoiceOver/TalkBack
- [ ] **Keyboard navigation**: Tab through drawer content
- [ ] **Touch targets**: Verify all buttons are tappable

## 🐛 Known Issues to Watch For

1. **Stale callback refs**: If callbacks change but refs don't update
2. **Memory leaks**: Intervals/timeouts not cleaned up
3. **Race conditions**: Energy detection start/stop conflicts
4. **Z-index conflicts**: Tooltips rendering behind drawers
5. **Keyboard issues**: Inputs covered by keyboard in drawers

## 📝 Testing Commands

```bash
# Test on iOS
npm run ios

# Test on Android  
npm run android

# Test on Web
npm run web
```

## ✅ Sign-Off Checklist

Before merging, verify:
- [ ] All critical test scenarios pass
- [ ] No console errors or warnings
- [ ] No memory leaks detected
- [ ] Performance is acceptable
- [ ] Works on iOS, Android, and Web
- [ ] Accessibility tested
- [ ] Error handling works correctly
