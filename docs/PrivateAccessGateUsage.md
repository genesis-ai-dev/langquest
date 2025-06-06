# PrivateAccessGate Usage Guide

The `PrivateAccessGate` component provides a centralized way to handle private project access control across the application.

## Basic Usage

```tsx
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { usePrivateProjectAccess } from '@/hooks/usePrivateProjectAccess';
```

## 1. Project Membership Modal (Inline)

```tsx
// In ProjectMembershipModal.tsx
<PrivateAccessGate
  projectId={projectId}
  projectName={project?.name || ''}
  isPrivate={project?.private || false}
  action="view-members"
  inline={true}
>
  {/* Protected content - member lists, invite form, etc. */}
</PrivateAccessGate>
```

## 2. Voting in TranslationModal

```tsx
// In TranslationModal.tsx
const { hasAccess } = usePrivateProjectAccess({ 
  projectId: translation.project_id, 
  isPrivate: translation.project?.private 
});

<PrivateAccessGate
  projectId={translation.project_id}
  projectName={translation.project?.name || ''}
  isPrivate={translation.project?.private || false}
  action="vote"
  renderTrigger={({ onPress, hasAccess }) => (
    <TouchableOpacity
      style={[styles.voteButton, !hasAccess && styles.lockedButton]}
      onPress={onPress}
      disabled={isVotePending}
    >
      <Ionicons
        name={hasAccess ? 'thumbs-up-outline' : 'lock-closed'}
        size={24}
        color={colors.buttonText}
      />
    </TouchableOpacity>
  )}
  onAccessGranted={() => handleVote({ voteType: 'up' })}
/>
```

## 3. Translation Submission in AssetView

```tsx
// In [assetId].tsx
<PrivateAccessGate
  projectId={projectId}
  projectName={project?.name || ''}
  isPrivate={project?.private || false}
  action="translate"
  renderTrigger={({ onPress, hasAccess }) => (
    <TouchableOpacity
      style={[styles.newTranslationButton, { flex: 1 }]}
      onPress={onPress}
    >
      {hasAccess ? (
        <KeyboardIcon fill={colors.buttonText} width={24} height={24} />
      ) : (
        <>
          <Ionicons name="lock-closed" size={16} color={colors.buttonText} />
          <KeyboardIcon fill={colors.buttonText} width={24} height={24} opacity={0.5} />
        </>
      )}
    </TouchableOpacity>
  )}
  onAccessGranted={() => {
    setIsTranslationModalVisible(true);
    setTranslationModalType(TranslationModalType.TEXT);
  }}
/>
```

## 4. Edit Transcription

```tsx
// In TranslationModal.tsx
<PrivateAccessGate
  projectId={translation.project_id}
  projectName={translation.project?.name || ''}
  isPrivate={translation.project?.private || false}
  action="edit-transcription"
  renderTrigger={({ onPress, hasAccess }) => (
    <TouchableOpacity 
      style={styles.editButton} 
      onPress={hasAccess ? toggleEdit : onPress}
    >
      <Ionicons 
        name={hasAccess ? "pencil" : "lock-closed"} 
        size={18} 
        color={colors.primary} 
      />
    </TouchableOpacity>
  )}
  onAccessGranted={toggleEdit}
/>
```

## 5. Download with Bypass Option

```tsx
// In DownloadIndicator.tsx
<PrivateAccessGate
  projectId={projectId}
  projectName={projectName}
  isPrivate={isPrivate}
  action="download"
  allowBypass={true}
  renderTrigger={({ onPress, hasAccess }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[!isConnected && !isDownloaded && styles.disabled]}
      disabled={!isConnected && !isDownloaded || isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size={size} color={colors.primary} />
      ) : (
        <Ionicons
          name={isDownloaded ? 'cloud-done' : 'cloud-download-outline'}
          size={size}
          color={hasAccess ? colors.text : colors.warning}
        />
      )}
    </TouchableOpacity>
  )}
  onAccessGranted={handleDownload}
  onBypass={handleDownloadAnyway}
/>
```

## Hook Usage

You can also use the `usePrivateProjectAccess` hook directly for custom logic:

```tsx
const { hasAccess, isMember, requiresAuth, requiresMembership } = usePrivateProjectAccess({
  projectId,
  isPrivate: project?.private || false
});

// Custom UI based on access status
if (!hasAccess) {
  return <LockedFeatureUI />;
}
```

## Action Types

- `view-members`: Viewing project members and invitations
- `vote`: Voting on translations
- `translate`: Submitting new translations
- `edit-transcription`: Editing translation text
- `download`: Downloading project/quest/asset content

## Props

- `projectId`: The ID of the project
- `projectName`: The name of the project (for display)
- `isPrivate`: Whether the project is private
- `action`: The type of action being gated
- `children`: Content to render when access is granted
- `onAccessGranted`: Callback when access is granted or user becomes member
- `renderTrigger`: Custom trigger component (receives onPress and hasAccess)
- `inline`: Show inline access UI instead of modal (default: false)
- `allowBypass`: Allow "proceed anyway" option (default: false, used for downloads)
- `onBypass`: Callback when user chooses to bypass (for downloads) 