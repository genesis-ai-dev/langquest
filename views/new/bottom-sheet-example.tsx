'use client';

import {
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetTrigger,
  BottomSheetView
} from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import React, { useCallback, useMemo, useRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export function Home() {
  const [isOpen, setIsOpen] = React.useState(false);

  const animatedIndex = useSharedValue<number>(0);
  const animatedPosition = useSharedValue<number>(0);
  // ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // bottomSheetModalRef
  console.log({ bottomSheetModalRef });

  // variables
  const snapPoints = useMemo(() => [600, '20%', '50%', '70%', '95%'], []);

  // callbacks
  const handlePresentModalPress = useCallback(() => {
    // bottomSheetWebRef.current?.focus();

    if (isOpen) {
      bottomSheetModalRef.current?.dismiss();
      setIsOpen(false);
    } else {
      bottomSheetModalRef.current?.present();
      setIsOpen(true);
    }
  }, [isOpen]);

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
  }, []);

  return (
    <View className="flex flex-1 items-center justify-center">
      <View className="rounded-md p-1">
        {Platform.OS !== 'web' && ( // Use this condition if you want to control the modal from outside for only mobile
          <Pressable onPress={handlePresentModalPress}>
            <Text>Present Modal</Text>
          </Pressable>
        )}

        <BottomSheetModal
          ref={bottomSheetModalRef}
          index={1}
          // open={isOpen} Use this prop if you want to control the modal from outside for web
          snapPoints={snapPoints}
          onChange={handleSheetChanges}
          handleComponent={() => (
            <BottomSheetHandle
              className="mt-2 bg-green-300"
              animatedIndex={animatedIndex}
              animatedPosition={animatedPosition}
            />
          )}
        >
          {Platform.OS === 'web' && (
            <>
              <BottomSheetTrigger>
                <Text>Present Modal</Text>
              </BottomSheetTrigger>
            </>
          )}
          <BottomSheetView className="flex-1 items-center">
            {Platform.OS === 'web' && (
              <BottomSheetHandle
                className="mt-2 bg-gray-300"
                animatedIndex={animatedIndex}
                animatedPosition={animatedPosition}
              />
            )}
            <Text className="mt-10">Awesome 🎉</Text>
          </BottomSheetView>
        </BottomSheetModal>
      </View>
    </View>
  );
}
