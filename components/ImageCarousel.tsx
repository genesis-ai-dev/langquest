import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet } from 'react-native';
import Carousel from './Carousel';

interface ImageCarouselProps {
  uris: string[];
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ uris }) => {
  return (
    <Carousel
      items={uris}
      renderItem={(uri) => (
        <Image
          source={{ uri }}
          style={styles.carouselImage}
          contentFit="contain"
        />
      )}
    />
  );
};

const styles = StyleSheet.create({
  carouselImage: {
    width: '100%',
    height: '100%'
  }
});

export default ImageCarousel;
