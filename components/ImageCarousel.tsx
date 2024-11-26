import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Carousel from './Carousel';
import { loadAsset } from '../utils/assetUtils';
import { Asset } from 'expo-asset';

interface ImageCarouselProps {
  imageModuleIds: number[];
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ imageModuleIds }) => {
  const [loadedAssets, setLoadedAssets] = useState<Asset[]>([]);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const assets = await Promise.all(
          imageModuleIds.map(id => {
            if (typeof id !== 'number') {
              throw new Error(`Invalid module ID: ${id}`);
            }
            return loadAsset(id);
          })
        );
        setLoadedAssets(assets);
      } catch (error) {
        console.error('Error loading assets:', error);
      }
    };
    loadAssets();
  }, [imageModuleIds]);

  const renderImage = (asset: Asset) => (
    <Image source={{ uri: asset.uri }} style={styles.carouselImage} />
  );

  return <Carousel items={loadedAssets} renderItem={renderImage} />;
};

const styles = StyleSheet.create({
  carouselImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});

export default ImageCarousel;