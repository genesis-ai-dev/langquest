import { borderRadius, colors, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import React, { useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';

interface CarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  onPageChange?: () => void;
}

function Carousel<T>({ items, renderItem, onPageChange }: CarouselProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  if (items.length === 0) return null;

  const handlePageChange = (e: { nativeEvent: { position: number } }) => {
    const newPage = e.nativeEvent.position;
    setCurrentPage(newPage);
    if (onPageChange) {
      onPageChange();
    }
  };

  return (
    <View style={styles.carouselContainer}>
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={handlePageChange}
      >
        {items.map((item, index) => (
          <View key={index} style={styles.carouselItem}>
            {renderItem(item, index)}
          </View>
        ))}
      </PagerView>
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.navButton,
            styles.navButtonLeft,
            currentPage === 0 && { opacity: 0 }
          ]}
          onPress={() => pagerRef.current?.setPage(currentPage - 1)}
          disabled={currentPage === 0}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
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
          onPress={() => pagerRef.current?.setPage(currentPage + 1)}
          disabled={currentPage === items.length - 1}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
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
  pagerView: {
    flex: 1
  },
  carouselItem: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.medium
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
