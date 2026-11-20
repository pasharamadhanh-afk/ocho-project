import React from 'react';
import {
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  X,
  MagnifyingGlass,
  PlusCircle,
  User,
  SignOut,
  Package,
  Truck,
  Wallet,
  ShieldCheck,
  ShieldWarning,
  UploadSimple,
  ArrowDownRight,
  ArrowUpRight,
  Users,
  CurrencyDollar,
  CreditCard,
  ArrowsDownUp,
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  ArrowLeft,
  Money,
  Star,
  Flag,
  Clock,
  Sparkle,
  QrCode,
  Phone,
  FileText,
  Heart,
  MapPin,
  EnvelopeSimple,
  Stack,
  CircleNotch,
  Calendar,
  CalendarBlank,
  ChatCircleDots,
  WhatsappLogo,
  PaperPlaneRight,
  Sun,
  Moon,
  Tag,
  Handshake,
  IconProps as PhosphorIconProps,
} from '@phosphor-icons/react';

export type IconName =
  | 'CheckCircle'
  | 'WarningCircle'
  | 'Warning'
  | 'Info'
  | 'X'
  | 'MagnifyingGlass'
  | 'PlusCircle'
  | 'User'
  | 'SignOut'
  | 'Package'
  | 'Truck'
  | 'Wallet'
  | 'ShieldCheck'
  | 'ShieldWarning'
  | 'UploadSimple'
  | 'ArrowDownRight'
  | 'ArrowUpRight'
  | 'Users'
  | 'CurrencyDollar'
  | 'CreditCard'
  | 'ArrowsDownUp'
  | 'ArrowCounterClockwise'
  | 'CaretLeft'
  | 'CaretRight'
  | 'ArrowLeft'
  | 'Money'
  | 'Star'
  | 'Flag'
  | 'Clock'
  | 'Sparkle'
  | 'QrCode'
  | 'Phone'
  | 'FileText'
  | 'Heart'
  | 'MapPin'
  | 'EnvelopeSimple'
  | 'Stack'
  | 'Calendar'
  | 'CalendarBlank'
  | 'ChatCircleDots'
  | 'WhatsappLogo'
  | 'PaperPlaneRight'
  | 'Sun'
  | 'Moon'
  | 'Tag'
  | 'Handshake'
  | 'Spinner';

const iconComponentMap: Record<IconName, React.ComponentType<PhosphorIconProps>> = {
  CheckCircle,
  WarningCircle,
  Warning,
  Info,
  X,
  MagnifyingGlass,
  PlusCircle,
  User,
  SignOut,
  Package,
  Truck,
  Wallet,
  ShieldCheck,
  ShieldWarning,
  UploadSimple,
  ArrowDownRight,
  ArrowUpRight,
  Users,
  CurrencyDollar,
  CreditCard,
  ArrowsDownUp,
  ArrowCounterClockwise,
  CaretLeft,
  CaretRight,
  ArrowLeft,
  Money,
  Star,
  Flag,
  Clock,
  Sparkle,
  QrCode,
  Phone,
  FileText,
  Heart,
  MapPin,
  EnvelopeSimple,
  Stack,
  Calendar,
  CalendarBlank,
  ChatCircleDots,
  WhatsappLogo,
  PaperPlaneRight,
  Sun,
  Moon,
  Tag,
  Handshake,
  Spinner: CircleNotch,
};

export type IconSize = 16 | 20 | 24 | 'sm' | 'md' | 'lg' | number;
export type IconWeight = 'regular' | 'fill';

export interface IconWrapperProps {
  name: IconName;
  size?: IconSize;
  weight?: IconWeight;
  className?: string;
  ariaLabel?: string;
  ariaHidden?: boolean;
}

export const Icon: React.FC<IconWrapperProps> = ({
  name,
  size = 16,
  weight = 'regular',
  className = '',
  ariaLabel,
  ariaHidden,
}) => {
  const Component = iconComponentMap[name];
  if (!Component) {
    console.warn(`[Icon] Unknown icon name: ${name}`);
    return null;
  }

  let pixelSize = 16;
  if (typeof size === 'number') {
    pixelSize = size;
  } else {
    if (size === 'sm') pixelSize = 16;
    else if (size === 'md') pixelSize = 20;
    else if (size === 'lg') pixelSize = 24;
  }

  const isAccessible = Boolean(ariaLabel);
  const isHidden = ariaHidden !== undefined ? ariaHidden : !isAccessible;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 text-current ${className}`}
      style={{ width: `${pixelSize}px`, height: `${pixelSize}px` }}
      role={isAccessible ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={isHidden ? 'true' : undefined}
    >
      <Component
        size={pixelSize}
        weight={weight}
        color="currentColor"
        className="w-full h-full"
      />
    </span>
  );
};
