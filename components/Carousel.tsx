import { Icon } from '@/components/ui/icon';
import { borderRadius, colors, spacing } from '@/styles/theme';
import type { ReactNode } from 'react';
import React, { useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface CarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onPageChange?: () => void;
}

function Carousel<T>({ items, renderItem, onPageChange }: CarouselProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);

  if (items.length === 0) return null;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const itemWidth = event.nativeEvent.layoutMeasurement.width;
    const newPage = Math.round(scrollX / itemWidth);

    if (newPage !== currentPage) {
      setCurrentPage(newPage);
      if (onPageChange) {
        onPageChange();
      }
    }
  };

  const scrollToPage = (pageIndex: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: pageIndex * 300, // Assuming item width of 300
        animated: true
      });
    }
  };

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={300} // Match item width
        decelerationRate="fast"
      >
        {items.map((item, index) => (
          <View key={index} style={styles.carouselItem}>
            {renderItem(item, index)}
          </View>
        ))}
      </ScrollView>
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.navButtonLeft,
            currentPage === 0 && { opacity: 0 }
          ]}
          onPress={() => scrollToPage(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <Icon name="chevron-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.paginationContainer}>
          {items.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentPage && styles.paginationDotActive
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.navButtonRight,
            currentPage === items.length - 1 && { opacity: 0 }
          ]}
          onPress={() => scrollToPage(currentPage + 1)}
          disabled={currentPage === items.length - 1}
        >
          <Icon name="chevron-right" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    flex: 1,
    width: '100%',
    position: 'relative'
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    alignItems: 'center'
  },
  carouselItem: {
    width: 300,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.medium,
    marginHorizontal: 0
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.small
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text,
    opacity: 0.4,
    marginHorizontal: 4
  },
  paginationDotActive: {
    opacity: 1
  },
  navButton: {
    backgroundColor: colors.inputBackground,
    borderRadius: 15,
    padding: 6
  },
  navButtonLeft: {
    marginRight: spacing.small
  },
  navButtonRight: {
    marginLeft: spacing.small
  }
});

export default Carousel;
