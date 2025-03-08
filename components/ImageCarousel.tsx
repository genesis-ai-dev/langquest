import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Carousel from './Carousel';

interface ImageCarouselProps {
  uris: string[];
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ uris }) => {
  return (
    <Carousel
      items={uris}
      renderItem={(uri) => (
        <Image source={{ uri: uri }} style={styles.carouselImage} />
      )}
    />
  );
};

const styles = StyleSheet.create({
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain'
  }
});

export default ImageCarousel;
