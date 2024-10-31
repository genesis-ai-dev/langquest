import { TextInput } from './TextInput';
import { PasswordInput } from './PasswordInput';
import { Dropdown } from './Dropdown';
import { Switch } from './Switch';
import { RelationList } from './RelationList';
import { DevFieldType } from '../devTypes';

export const UiElements: Record<DevFieldType, React.ComponentType<any>> = {
  text: TextInput,
  password: PasswordInput,
  dropdown: Dropdown,
  switch: Switch,
  relationList: RelationList
};

export * from './TextInput';
export * from './PasswordInput';
export * from './Dropdown';
export * from './Switch';
export * from './RelationList';