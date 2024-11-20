import { TextInput } from './TextInput';
import { TextDisplay } from './TextDisplay';
import { PasswordInput } from './PasswordInput';
import { Dropdown } from './Dropdown';
import { Switch } from './Switch';
import { RelationList } from './RelationList';
// import { DevFieldType } from '../DevTypes';

// Define a base interface for all UI element props
interface BaseUiElementProps {
  value: any;
  onChange: (value: any) => void;
  error?: string | null;
  entityId?: string;
  fieldPath?: any;
  placeholder?: string;
  source?: string;
  linkedEntity?: any;
}

export type DevFieldType = 
  | 'textInput' 
  | 'textDisplay'
  | 'passwordInput' 
  | 'entitySelect'  // Replaces 'dropdown'
  | 'switch' 
  | 'relationList';

// Update component type to use the base props
export const UiElements: Record<DevFieldType, React.ComponentType<BaseUiElementProps>> = {
  textInput: TextInput as React.ComponentType<BaseUiElementProps>,
  textDisplay: TextDisplay as React.ComponentType<BaseUiElementProps>,
  passwordInput: PasswordInput as React.ComponentType<BaseUiElementProps>,
  entitySelect: Dropdown as React.ComponentType<BaseUiElementProps>,
  switch: Switch as React.ComponentType<BaseUiElementProps>,
  relationList: RelationList as React.ComponentType<BaseUiElementProps>
};

export * from './TextInput';
export * from './TextDisplay';
export * from './PasswordInput';
export * from './Dropdown';
export * from './Switch';
export * from './RelationList';