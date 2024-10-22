import React from 'react';
import { Image, StyleSheet } from 'react-native';
import Carousel from './Carousel';

interface ImageFile {
  id: string;
  uri: any;
}

interface ImageCarouselProps {
  images: ImageFile[];
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images }) => {
  const renderImage = (item: ImageFile) => (
    <Image source={item.uri} style={styles.carouselImage} />
  );

  return <Carousel items={images} renderItem={renderImage} />;
};

const styles = StyleSheet.create({
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

export default ImageCarousel;