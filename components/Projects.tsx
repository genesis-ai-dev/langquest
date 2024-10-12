import { observer } from "@legendapp/state/react";
import { useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  projects$ as _projects$,
  addProject,
  toggleDone,
} from "../utils/SupaLegend";
import { Tables } from "../utils/database.types";

export const Projects = observer(() => {
  const projects = _projects$.get();
  const renderItem = ({ item: project }: { item: Tables<"projects"> }) => (
    <ProjectItem project={project} />
  );
  return (
    <View className="flex-1">
      <Text className="text-foreground text-2xl font-bold">Projects</Text>
      <ProjectInput />
      {projects && (
        <FlatList
          className="p-2"
          data={Object.values(projects)}
          renderItem={renderItem}
        />
      )}
    </View>
  );
});

const NOT_DONE_ICON = String.fromCodePoint(0x1f7e0);
const DONE_ICON = String.fromCodePoint(0x2705);

const ProjectInput = () => {
  const [text, setText] = useState("");
  const handleSubmitEditing = ({
    nativeEvent: { text: newText },
  }: {
    nativeEvent: { text: string };
  }) => {
    setText("");
    addProject(newText);
  };
  return (
    <TextInput
      className="border-2 bg-background text-foreground rounded-md p-2"
      value={text}
      onChangeText={(text) => setText(text)}
      onSubmitEditing={handleSubmitEditing}
      placeholder="What do you want to do today?"
      placeholderTextColor="black"
    />
  );
};

const ProjectItem = ({ project }: { project: Tables<"projects"> }) => {
  const handlePress = () => {
    toggleDone(project.id);
  };
  return (
    <TouchableOpacity
      className="bg-slate-200 text-foreground rounded-md p-2"
      key={project.id}
      onPress={handlePress}
    >
      <Text>
        {project.done ? DONE_ICON : NOT_DONE_ICON} {project.text}
      </Text>
    </TouchableOpacity>
  );
};
