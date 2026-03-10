import { recoverPublishedQuestAudio } from '@/utils/recoveryUtils';
import React from 'react';
import { View } from 'react-native';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from './ui/drawer';
import { Progress } from './ui/progress';
import { Text } from './ui/text';

type RecoveryStep =
  | 'validate_quest'
  | 'scan_expected_audio'
  | 'copy_missing_to_sync'
  | 'check_cloud'
  | 'queue_and_upload'
  | 'delete_originals'
  | 'finish';

const STEP_ORDER: RecoveryStep[] = [
  'validate_quest',
  'scan_expected_audio',
  'copy_missing_to_sync',
  'check_cloud',
  'queue_and_upload',
  'delete_originals',
  'finish'
];

const STEP_LABELS: Record<RecoveryStep, string> = {
  validate_quest: 'Validating quest',
  scan_expected_audio: 'Scanning expected audio',
  copy_missing_to_sync: 'Copying missing audio',
  check_cloud: 'Checking cloud files',
  queue_and_upload: 'Queueing/syncing upload',
  delete_originals: 'Cleaning recovered originals',
  finish: 'Finalizing report'
};

interface RecoveryPublishedQuestDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  questId: string;
  profileId: string;
  onCompleted?: () => void;
}

interface RecoveryIndicators {
  totalExpectedFiles: number;
  totalUnsyncedRecords: number;
  totalNotFoundOnDevice: number;
  totalCopyErrors: number;
  totalCopiedSuccessfully: number;
  totalNotFoundOnServer: number;
  totalUploadSyncErrors: number;
  totalDeleteErrors: number;
  totalDeleted: number;
}

const DEFAULT_INDICATORS: RecoveryIndicators = {
  totalExpectedFiles: 0,
  totalUnsyncedRecords: 0,
  totalNotFoundOnDevice: 0,
  totalCopyErrors: 0,
  totalCopiedSuccessfully: 0,
  totalNotFoundOnServer: 0,
  totalUploadSyncErrors: 0,
  totalDeleteErrors: 0,
  totalDeleted: 0
};

export function RecoveryPublishedQuestDrawer({
  isOpen,
  onOpenChange,
  questId,
  profileId,
  onCompleted
}: RecoveryPublishedQuestDrawerProps) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState<RecoveryStep | null>(
    null
  );
  const [currentMessage, setCurrentMessage] = React.useState<string>('');
  const [progressValue, setProgressValue] = React.useState(0);
  const [indicators, setIndicators] =
    React.useState<RecoveryIndicators>(DEFAULT_INDICATORS);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [finished, setFinished] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const resetState = React.useCallback(() => {
    setIsRunning(false);
    setCurrentStep(null);
    setCurrentMessage('');
    setProgressValue(0);
    setIndicators(DEFAULT_INDICATORS);
    setErrors([]);
    setFinished(false);
    setSuccess(false);
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const updateProgressForStep = React.useCallback((step: RecoveryStep) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    if (stepIndex < 0) return;
    const percentage = Math.round(((stepIndex + 1) / STEP_ORDER.length) * 100);
    setProgressValue(percentage);
  }, []);

  const handleStartRecovery = React.useCallback(async () => {
    if (!questId || !profileId || isRunning) {
      return;
    }

    resetState();
    setIsRunning(true);

    try {
      const report = await recoverPublishedQuestAudio(questId, profileId, {
        onStep: (update) => {
          setCurrentStep(update.step);
          setCurrentMessage(update.message);
          if (update.status === 'completed') {
            updateProgressForStep(update.step);
          }
        }
      });

      setIndicators({
        totalExpectedFiles: report.totalExpectedFiles,
        totalUnsyncedRecords: report.totalUnsyncedRecords,
        totalNotFoundOnDevice: report.totalNotFoundOnDevice,
        totalCopyErrors: report.totalCopyErrors,
        totalCopiedSuccessfully: report.totalCopiedSuccessfully,
        totalNotFoundOnServer: report.totalNotFoundOnServer,
        totalUploadSyncErrors: report.totalUploadSyncErrors,
        totalDeleteErrors: report.totalDeleteErrors,
        totalDeleted: report.totalDeleted
      });
      setErrors(report.errors);
      setSuccess(report.success);
      setFinished(true);
      setProgressValue(100);

      if (report.success) {
        onCompleted?.();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected recovery error';
      setErrors([errorMessage]);
      setCurrentMessage(errorMessage);
      setSuccess(false);
      setFinished(true);
    } finally {
      setIsRunning(false);
    }
  }, [
    isRunning,
    onCompleted,
    profileId,
    questId,
    resetState,
    updateProgressForStep
  ]);

  const indicatorRows = React.useMemo(
    () => [
      {
        label: 'Total expected files',
        value: indicators.totalExpectedFiles
      },
      {
        label: 'Total unsynced records',
        value: indicators.totalUnsyncedRecords
      },
      {
        label: 'Total records not found on device',
        value: indicators.totalNotFoundOnDevice
      },
      {
        label: 'Total records with copy errors',
        value: indicators.totalCopyErrors
      },
      {
        label: 'Total records copied successfully',
        value: indicators.totalCopiedSuccessfully
      },
      {
        label: 'Total records not found on server',
        value: indicators.totalNotFoundOnServer
      },
      {
        label: 'Total records with server sync (upload) errors',
        value: indicators.totalUploadSyncErrors
      },
      {
        label: 'Total records with delete errors',
        value: indicators.totalDeleteErrors
      },
      {
        label: 'Total records deleted',
        value: indicators.totalDeleted
      }
    ],
    [indicators]
  );

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      dismissible={!isRunning}
      snapPoints={['90%']}
      enableDynamicSizing={false}
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>Recovery Quest Tool</DrawerTitle>
          <Text className="text-sm text-muted-foreground">
            This tool helps recover audio files that did not sync properly,
            helping restore data consistency for your quest.
          </Text>
        </DrawerHeader>

        <DrawerScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          style={{ flexGrow: 1 }}
        >
          <View className="mb-4 rounded-lg bg-muted p-3">
            <Text className="mb-2 text-sm font-semibold">
              {isRunning
                ? `Running: ${currentStep ? STEP_LABELS[currentStep] : 'Starting...'}`
                : finished
                  ? success
                    ? 'Recovery completed successfully'
                    : 'Recovery completed with errors'
                  : 'Waiting to start'}
            </Text>

            <Progress value={progressValue} className="h-2" />
            <Text className="mt-2 text-xs text-muted-foreground">
              {progressValue}% {currentMessage ? `- ${currentMessage}` : ''}
            </Text>
          </View>

          {finished && (
            <View className="rounded-lg border border-border p-3">
              <Text className="mb-2 text-base font-semibold">Indicators</Text>

              {indicatorRows.map((item) => (
                <View
                  key={item.label}
                  className="flex-row items-center justify-between border-b border-border py-2"
                >
                  <Text className="flex-1 text-sm text-muted-foreground">
                    {item.label}
                  </Text>
                  <Text className="ml-3 font-mono text-sm">{item.value}</Text>
                </View>
              ))}

              {errors.length > 0 && (
                <View className="mt-3 rounded-lg bg-destructive/10 p-3">
                  <Text className="mb-1 text-sm font-semibold text-destructive">
                    Errors found
                  </Text>
                  {errors.slice(0, 10).map((error, index) => (
                    <Text
                      key={`${error}-${index}`}
                      className="text-xs text-destructive"
                    >
                      - {error}
                    </Text>
                  ))}
                  {errors.length > 10 && (
                    <Text className="mt-1 text-xs text-destructive">
                      ... and {errors.length - 10} more error(s)
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </DrawerScrollView>

        <DrawerFooter>
          {finished ? (
            <DrawerClose variant="default">
              <Text className="font-bold">Done</Text>
            </DrawerClose>
          ) : (
            <>
              <Button
                onPress={() => {
                  void handleStartRecovery();
                }}
                disabled={isRunning || !questId || !profileId}
                loading={isRunning}
              >
                <Text className="font-bold">
                  {isRunning ? 'Running recovery...' : 'Start recovery'}
                </Text>
              </Button>

              <DrawerClose variant="outline" disabled={isRunning}>
                <Text>Cancel</Text>
              </DrawerClose>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
