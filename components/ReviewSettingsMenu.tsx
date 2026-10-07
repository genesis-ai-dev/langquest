import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import {
  ClipboardPenLineIcon,
  EyeIcon,
  EyeOffIcon,
  PencilRulerIcon
} from 'lucide-react-native';
import { View } from 'react-native';

const ITEM_CLASS = 'rounded-md border border-border/50 bg-background';

interface ReviewSettingsMenuProps {
  active: boolean;
  /** Creator or project owner: may inactivate or activate the review. */
  canManage: boolean;
  disabled?: boolean;
  /** Side the menu items align to; the icon sits on that side. */
  align?: 'left' | 'right';
  onEdit: () => void;
  onToggleActive: () => void;
}

export function ReviewSettingsMenu({
  active,
  canManage,
  disabled,
  align = 'right',
  onEdit,
  onToggleActive
}: ReviewSettingsMenuProps) {
  return (
    <View className="z-50" style={{ elevation: 50 }}>
      <SpeedDial className="relative z-50 items-end">
        <SpeedDialTrigger
          variant="outline"
          size="icon"
          iconClosed={ClipboardPenLineIcon}
          iconOpen={undefined}
          iconSize={18}
          disableIconRotation
          disabled={disabled}
          accessibilityLabel="Review settings"
          className={ITEM_CLASS}
          openClassName="bg-accent border-input"
          iconClassName="text-foreground"
        />
        <SpeedDialItems
          className="absolute right-0 top-full z-50 mt-2 w-52"
          style={{ elevation: 60 }}
        >
          <SpeedDialItem
            icon={PencilRulerIcon}
            label="Edit from Review"
            align={align}
            variant="outline"
            className={ITEM_CLASS}
            iconClassName="text-foreground"
            onPress={onEdit}
          />
          {canManage ? (
            <SpeedDialItem
              icon={active ? EyeOffIcon : EyeIcon}
              label={active ? 'Inactivate Review' : 'Activate Review'}
              align={align}
              variant="outline"
              className={ITEM_CLASS}
              iconClassName="text-foreground"
              onPress={onToggleActive}
            />
          ) : null}
        </SpeedDialItems>
      </SpeedDial>
    </View>
  );
}
