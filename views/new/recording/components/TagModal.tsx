/**
 * TagModal - Modal for assigning tags
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { Tag } from '@/hooks/db/useSearchTags';
import { useSearchTags } from '@/hooks/db/useSearchTags';
import React from 'react';
import type { TextInput } from 'react-native';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface TagModalProps {
  isVisible: boolean;
  selectedTag?: Tag;
  searchTerm?: string;
  limit?: number;
  onClose: () => void;
  onAssignTags: (tags: Tag[]) => void;
}

export function TagModal({
  isVisible,
  selectedTag,
  searchTerm = '',
  limit = 20,
  onClose,
  onAssignTags
}: TagModalProps) {
  const [localSearchTerm, setLocalSearchTerm] = React.useState(searchTerm);
  const [selectedTags, setSelectedTags] = React.useState<Tag[]>(
    selectedTag ? [selectedTag] : []
  );
  const [modalVisible, setModalVisible] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);

  const { tags = [], isTagsLoading } = useSearchTags({
    searchTerm: searchTerm || localSearchTerm,
    maxResults: limit,
    enabled: isVisible
  });
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  // Reset state when modal opens or searchTerm changes
  React.useEffect(() => {
    if (isVisible) {
      setLocalSearchTerm(searchTerm);
      setSelectedTags(selectedTag ? [selectedTag] : []);
    }
  }, [isVisible, searchTerm, selectedTag]);

  // Handle modal visibility with exit animation
  React.useEffect(() => {
    if (isVisible) {
      // Show modal immediately
      setModalVisible(true);
      // Quick, snappy animation (Emil Kowalski style)
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease)
      });
      scale.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease)
      });

      // Focus after animation completes
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);

      // Backup focus attempt
      const backupTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);

      return () => {
        clearTimeout(focusTimer);
        clearTimeout(backupTimer);
      };
    } else {
      // Exit animation - quick fade out (ease-out for responsiveness)
      opacity.value = withTiming(0, {
        duration: 100,
        easing: Easing.out(Easing.ease)
      });
      scale.value = withTiming(0.9, {
        duration: 100,
        easing: Easing.out(Easing.ease)
      });

      // Hide modal after exit animation completes
      const hideTimer = setTimeout(() => {
        setModalVisible(false);
      }, 100);

      return () => {
        clearTimeout(hideTimer);
      };
    }
  }, [isVisible, opacity, scale]);

  const handleAssign = () => {
    onAssignTags(selectedTags);
    onClose();
  };

  const handleTagToggle = (tag: Tag) => {
    setSelectedTags((prev) => {
      const isSelected = prev.some((t) => t.id === tag.id);
      if (isSelected) {
        return prev.filter((t) => t.id !== tag.id);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleCancel = () => {
    setLocalSearchTerm(searchTerm);
    setSelectedTags(selectedTag ? [selectedTag] : []);
    onClose();
  };

  const formatTagText = (tag: Tag) => {
    return tag.value ? `${tag.key}:${tag.value}` : tag.key;
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleCancel}
      >
        <Animated.View style={animatedStyle}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="mx-6 w-96 max-w-full rounded-lg bg-background p-6 shadow-lg">
              <Text className="mb-4 text-xl font-bold text-foreground">
                Assign Tags
              </Text>

              {/* Show search input only if no initial search term */}
              {!searchTerm && (
                <Input
                  ref={inputRef}
                  value={localSearchTerm}
                  onChangeText={setLocalSearchTerm}
                  placeholder="Search tags..."
                  className="mb-4"
                />
              )}

              {/* Selected tags display */}
              {selectedTags.length > 0 && (
                <View className="mb-4">
                  <Text className="mb-2 text-sm font-medium text-foreground">
                    Selected Tags ({selectedTags.length}):
                  </Text>
                  <ScrollView horizontal className="flex-row">
                    {selectedTags.map((tag) => (
                      <Pressable
                        key={tag.id}
                        onPress={() => handleTagToggle(tag)}
                        className="mr-2 rounded-full bg-primary px-3 py-1"
                      >
                        <Text className="text-sm text-primary-foreground">
                          {formatTagText(tag)} ✕
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Tags list */}
              <View className="mb-6 max-h-60">
                <Text className="mb-2 text-sm font-medium text-foreground">
                  Available Tags:
                </Text>
                {isTagsLoading ? (
                  <Text className="text-muted-foreground">Loading...</Text>
                ) : tags.length === 0 ? (
                  <Text className="text-muted-foreground">
                    {localSearchTerm ? 'No tags found' : 'No tags available'}
                  </Text>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    className="flex-wrap"
                  >
                    <View className="flex-row flex-wrap">
                      {tags.map((tag) => {
                        const isSelected = selectedTags.some(
                          (t) => t.id === tag.id
                        );
                        return (
                          <Pressable
                            key={tag.id}
                            onPress={() => handleTagToggle(tag)}
                            className={`mb-2 mr-2 rounded-full px-3 py-1 ${
                              isSelected
                                ? 'bg-primary'
                                : 'border border-border bg-background'
                            }`}
                          >
                            <Text
                              className={`text-sm ${
                                isSelected
                                  ? 'text-primary-foreground'
                                  : 'text-foreground'
                              }`}
                            >
                              {formatTagText(tag)}
                              {isSelected && ' ✓'}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </View>

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={handleCancel}
                  className="flex-1"
                >
                  <Text>Cancel</Text>
                </Button>
                <Button
                  onPress={handleAssign}
                  className="flex-1"
                  disabled={selectedTags.length === 0}
                >
                  <Text>Assign Tags ({selectedTags.length})</Text>
                </Button>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
