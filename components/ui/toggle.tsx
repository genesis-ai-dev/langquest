import { cva } from 'class-variance-authority';

const toggleVariants = cva(
  'web:group items-center justify-center rounded-md active:bg-muted web:inline-flex web:ring-offset-background web:transition-colors web:hover:bg-muted web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline:
          'border border-input bg-transparent active:bg-accent web:hover:bg-accent'
      },
      size: {
        default: 'native:h-12 native:px-[12] h-10 px-3',
        sm: 'native:h-10 native:px-[9] h-9 px-2.5',
        lg: 'native:h-14 native:px-6 h-11 px-5'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

const toggleTextVariants = cva(
  'native:text-base text-sm font-medium text-foreground',
  {
    variants: {
      variant: {
        default: '',
        outline:
          'web:group-hover:text-accent-foreground web:group-active:text-accent-foreground'
      },
      size: {
        default: '',
        sm: '',
        lg: ''
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export { toggleTextVariants, toggleVariants };
