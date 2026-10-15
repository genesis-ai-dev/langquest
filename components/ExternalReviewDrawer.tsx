import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerView
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useReviewDraft, useReviewDraftStore } from '@/hooks/useReviewEditor';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { deleteIfExists, getLocalAttachmentUri } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { CopyIcon, Share2Icon } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import { toast } from 'sonner-native';

function createAccessToken() {
  return Array.from(Crypto.getRandomBytes(32))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function siteUrl() {
  return (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
}

function externalReviewLink(reviewId: string, token: string) {
  const site = siteUrl();
  if (!site) return null;
  const params = new URLSearchParams({ token });
  return `${site}/review/${reviewId}?${params.toString()}`;
}

function deleteAudioFiles(values: string[]) {
  for (const value of values) {
    void deleteIfExists(getLocalAttachmentUri(value));
  }
}

export function ExternalReviewDrawer({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const store = useReviewDraftStore();
  const accessToken = useReviewDraft((state) => state.accessToken);
  const reviewId = useReviewDraft((state) => state.reviewId);
  const isOnline = useNetworkStatus();
  const [isWorking, setIsWorking] = useState(false);

  const hasLink = accessToken != null;
  const link =
    reviewId && accessToken ? externalReviewLink(reviewId, accessToken) : null;

  const fail = (error: unknown, fallback: string) => {
    console.error('[ExternalReview]', error);
    toast.error(
      error instanceof Error && error.message === 'OFFLINE'
        ? 'You need to be online to share this review.'
        : fallback
    );
  };

  const createLink = async () => {
    if (!isOnline) {
      toast.error('You need to be online to share this review.');
      return;
    }
    if (!siteUrl()) {
      toast.error('The website address is not configured.');
      return;
    }
    const token = createAccessToken();
    setIsWorking(true);
    try {
      const audio = await store.getState().requestExternalReview(token);
      deleteAudioFiles(audio);
      toast.success('Link created');
    } catch (error) {
      fail(error, 'Could not create the link. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const confirmCreate = () => {
    Alert.alert(
      'Request external review',
      'Any feedback already entered in this review will be discarded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard and create link',
          style: 'destructive',
          onPress: () => void createLink()
        }
      ]
    );
  };

  const replaceLink = async () => {
    if (!isOnline) {
      toast.error('You need to be online to share this review.');
      return;
    }
    setIsWorking(true);
    try {
      await store.getState().replaceExternalReviewToken(createAccessToken());
      toast.success('New link created');
    } catch (error) {
      fail(error, 'Could not create a new link. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const confirmReplace = () => {
    Alert.alert('Create a new link', 'The current link will stop working.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Create new link', onPress: () => void replaceLink() }
    ]);
  };

  const revokeLink = async () => {
    if (!isOnline) {
      toast.error('You need to be online to share this review.');
      return;
    }
    setIsWorking(true);
    try {
      await store.getState().revokeExternalReviewLink();
      toast.success('Link revoked');
    } catch (error) {
      fail(error, 'Could not revoke the link. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const confirmRevoke = () => {
    Alert.alert(
      'Revoke link',
      'The current link will stop working and you can edit this review again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => void revokeLink()
        }
      ]
    );
  };

  const copyLink = async () => {
    if (!link) {
      toast.error('The website address is not configured.');
      return;
    }
    await Clipboard.setStringAsync(link);
    toast.success('Link copied');
  };

  const shareLink = async () => {
    if (!link) {
      toast.error('The website address is not configured.');
      return;
    }
    try {
      // iOS shows url as a link preview. Android only reads message.
      await Share.share(
        Platform.OS === 'ios'
          ? { url: link }
          : { message: link, title: 'External review' },
        { dialogTitle: 'Share review link', subject: 'External review' }
      );
    } catch (error) {
      console.error('[ExternalReview]', error);
      toast.error('Could not open the share options.');
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={['80%']}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
    >
      <DrawerContent asChild>
        <DrawerView className="gap-4">
          <DrawerHeader>
            <DrawerTitle>External review</DrawerTitle>
          </DrawerHeader>

          <Text className="text-sm text-muted-foreground">
            Share this link so the review can be filled in externally.
          </Text>
          <View className="rounded-md bg-muted px-3 py-3">
            <Text
              selectable={hasLink}
              className={cn(
                'text-sm',
                link ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {link ??
                (hasLink
                  ? 'The website address is not configured.'
                  : 'The link will appear here.')}
            </Text>
          </View>
          {hasLink ? (
            <View className="flex-row gap-2">
              <Button
                className="flex-1"
                disabled={!link}
                onPress={() => void shareLink()}
              >
                <Icon
                  as={Share2Icon}
                  size={18}
                  className="text-primary-foreground"
                />
                <Text>Share</Text>
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={!link}
                onPress={() => void copyLink()}
              >
                <Icon as={CopyIcon} size={18} className="text-foreground" />
                <Text>Copy link</Text>
              </Button>
            </View>
          ) : (
            <Button disabled={!isOnline || isWorking} onPress={confirmCreate}>
              <Text>{isWorking ? 'Creating link…' : 'Create link'}</Text>
            </Button>
          )}
          {!isOnline ? (
            <Text className="text-sm text-destructive">
              You need to be online to create or revoke a link.
            </Text>
          ) : null}
          <View className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!hasLink || !isOnline || isWorking}
              onPress={confirmReplace}
            >
              <Text>New link</Text>
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={!hasLink || !isOnline || isWorking}
              onPress={confirmRevoke}
            >
              <Text className="text-destructive">Revoke</Text>
            </Button>
          </View>
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
