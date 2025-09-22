/* eslint-disable */
import * as React from 'react';
import type {
  PressableStateCallbackType,
  Image as RNImage,
  ImageProps as RNImageProps,
  ImageStyle as RNImageStyle,
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  TextProps as RNTextProps,
  View as RNView,
  ViewProps as RNViewProps,
  StyleProp
} from 'react-native';
import { StyleSheet } from 'react-native';

const Pressable = React.forwardRef<
  React.ComponentRef<typeof RNPressable>,
  RNPressableProps
>((props, forwardedRef) => {
  const { children, ...pressableSlotProps } = props;

  if (!React.isValidElement(children)) {
    console.log('Slot.Pressable - Invalid asChild element', children);
    return null;
  }

  return React.cloneElement<
    React.ComponentPropsWithoutRef<typeof RNPressable>,
    React.ComponentRef<typeof RNPressable>
  >(isTextChildren(children) ? <></> : children, {
    ...mergeProps(pressableSlotProps, (children as any).props),
    ref: forwardedRef
      ? composeRefs(forwardedRef, (children as any).props?.ref)
      : (children as any).props?.ref
  });
});

Pressable.displayName = 'SlotPressable';

const View = React.forwardRef<React.ComponentRef<typeof RNView>, RNViewProps>(
  (props, forwardedRef) => {
    const { children, ...viewSlotProps } = props;

    if (!React.isValidElement(children)) {
      console.log('Slot.View - Invalid asChild element', children);
      return null;
    }

    return React.cloneElement<
      React.ComponentPropsWithoutRef<typeof RNView>,
      React.ComponentRef<typeof RNView>
    >(isTextChildren(children) ? <></> : children, {
      ...mergeProps(viewSlotProps, (children as any).props),
      ref: forwardedRef
        ? composeRefs(forwardedRef, (children as any).props?.ref)
        : (children as any).props?.ref
    });
  }
);

View.displayName = 'SlotView';

const Text = React.forwardRef<React.ComponentRef<typeof RNText>, RNTextProps>(
  (props, forwardedRef) => {
    const { children, ...textSlotProps } = props;

    if (!React.isValidElement(children)) {
      console.log('Slot.Text - Invalid asChild element', children);
      return null;
    }

    return React.cloneElement<
      React.ComponentPropsWithoutRef<typeof RNText>,
      React.ComponentRef<typeof RNText>
    >(isTextChildren(children) ? <></> : children, {
      ...mergeProps(textSlotProps, (children as any).props),
      ref: forwardedRef
        ? composeRefs(forwardedRef, (children as any).props?.ref)
        : (children as any).props?.ref
    });
  }
);

Text.displayName = 'SlotText';

type ImageSlotProps = RNImageProps & {
  children?: React.ReactNode;
};

const Image = React.forwardRef<
  React.ComponentRef<typeof RNImage>,
  ImageSlotProps
>((props, forwardedRef) => {
  const { children, ...imageSlotProps } = props;

  if (!React.isValidElement(children)) {
    console.log('Slot.Image - Invalid asChild element', children);
    return null;
  }

  return React.cloneElement<
    React.ComponentPropsWithoutRef<typeof RNImage>,
    React.ComponentRef<typeof RNImage>
  >(isTextChildren(children) ? <></> : children, {
    ...mergeProps(imageSlotProps, (children as any).props),
    ref: forwardedRef
      ? composeRefs(forwardedRef, (children as any).props?.ref)
      : (children as any).props?.ref
  });
});

Image.displayName = 'SlotImage';

type InputSlotProps = RNTextInputProps & {
  children?: React.ReactNode;
};

const Input = React.forwardRef<
  React.ComponentRef<typeof RNTextInput>,
  InputSlotProps
>((props, forwardedRef) => {
  const { children, ...inputSlotProps } = props;

  if (!React.isValidElement(children)) {
    console.log('Slot.Input - Invalid asChild element', children);
    return null;
  }

  return React.cloneElement<
    React.ComponentPropsWithoutRef<typeof RNTextInput>,
    React.ComponentRef<typeof RNTextInput>
  >(isTextChildren(children) ? <></> : children, {
    ...mergeProps(inputSlotProps, (children as any).props),
    ref: forwardedRef
      ? composeRefs(forwardedRef, (children as any).props?.ref)
      : (children as any).props?.ref
  });
});

Input.displayName = 'SlotInput';

type GenericExtraProps<Extra extends object> = {
  children: React.ReactElement<any>;
} & Extra;

function Generic<Extra extends object>(props: GenericExtraProps<Extra>) {
  const { children, ...slotProps } = props as unknown as {
    children: React.ReactElement<any>;
  } & AnyProps;

  if (!React.isValidElement(children)) {
    console.log('Slot.Generic - Invalid asChild element', children);
    return null;
  }

  return React.cloneElement(
    children as React.ReactElement<any>,
    mergeProps(slotProps, (children as any).props) as Partial<any> &
      React.Attributes
  );
}

export { Generic, Image, Input, Pressable, Text, View };

// This project uses code from WorkOS/Radix Primitives.
// The code is licensed under the MIT License.
// https://github.com/radix-ui/primitives/tree/main

function composeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T) =>
    refs.forEach((ref) => {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
        (ref as React.MutableRefObject<T>).current = node;
      }
    });
}

type AnyProps = Record<string, any>;

function mergeProps(slotProps: AnyProps, childProps: AnyProps) {
  // all child props should override
  const overrideProps = { ...childProps };

  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];

    const isHandler = /^on[A-Z]/.test(propName);
    if (isHandler) {
      // if the handler exists on both, we compose them
      if (slotPropValue && childPropValue) {
        overrideProps[propName] = (...args: unknown[]) => {
          childPropValue(...args);
          slotPropValue(...args);
        };
      }
      // but if it exists only on the slot, we use only this one
      else if (slotPropValue) {
        overrideProps[propName] = slotPropValue;
      }
    }
    // if it's `style`, we merge them
    else if (propName === 'style') {
      overrideProps[propName] = combineStyles(slotPropValue, childPropValue);
    } else if (propName === 'className') {
      overrideProps[propName] = [slotPropValue, childPropValue]
        .filter(Boolean)
        .join(' ');
    }
  }

  return { ...slotProps, ...overrideProps };
}

type PressableStyle = RNPressableProps['style'];
type ImageStyle = StyleProp<RNImageStyle>;
type Style = PressableStyle | ImageStyle;

function combineStyles(slotStyle?: Style, childValue?: Style) {
  if (typeof slotStyle === 'function' && typeof childValue === 'function') {
    return (state: PressableStateCallbackType) => {
      return StyleSheet.flatten([slotStyle(state), childValue(state)]);
    };
  }
  if (typeof slotStyle === 'function') {
    return (state: PressableStateCallbackType) => {
      return childValue
        ? StyleSheet.flatten([slotStyle(state), childValue])
        : slotStyle(state);
    };
  }
  if (typeof childValue === 'function') {
    return (state: PressableStateCallbackType) => {
      return slotStyle
        ? StyleSheet.flatten([slotStyle, childValue(state)])
        : childValue(state);
    };
  }

  return StyleSheet.flatten([slotStyle, childValue].filter(Boolean));
}

export function isTextChildren(
  children:
    | React.ReactNode
    | ((state: PressableStateCallbackType) => React.ReactNode)
) {
  return Array.isArray(children)
    ? children.every((child) => typeof child === 'string')
    : typeof children === 'string';
}
