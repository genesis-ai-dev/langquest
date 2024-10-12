import { Link } from "expo-router";
import { View } from "react-native";

export default function IndexScreen() {
  return (
    <View className="flex-1">
      <Link href="/projects">Go to projects</Link>
    </View>
  );
}
