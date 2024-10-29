import { VersionedEntity } from '@/database_components/VersionedRepository';

export interface DevEntityProps<T extends VersionedEntity> {
  entity: Partial<T>;
  onClose: () => void;
  onUpdate: () => void;
  isNew?: boolean;
}

export interface DevFormField {
  key: string;
  type: 'text' | 'password' | 'dropdown' | 'switch';
  label: string;
  placeholder?: string;
  options?: Array<any>;  // For dropdowns
  getOptionLabel?: (option: any) => string;  // For dropdowns
  getOptionValue?: (option: any) => string;  // For dropdowns
}