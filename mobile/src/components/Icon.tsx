import { Image } from 'expo-image';
import { colors } from '../ui/theme';

const sources = {
  mail: require('../../assets/icons/mail.svg'),
  lock: require('../../assets/icons/lock.svg'),
  eye: require('../../assets/icons/eye.svg'),
  eyeOff: require('../../assets/icons/eye-off.svg'),
  profile: require('../../assets/icons/profile.svg'),
  chevron: require('../../assets/icons/chevron.svg'),
  headphones: require('../../assets/icons/headphones.svg'),
  calendar: require('../../assets/icons/calendar.svg'),
  visits: require('../../assets/icons/visits.svg'),
  studies: require('../../assets/icons/studies.svg'),
  clock: require('../../assets/icons/clock.svg'),
  location: require('../../assets/icons/location.svg'),
  alert: require('../../assets/icons/alert.svg'),
  arrowLeft: require('../../assets/icons/arrow-left.svg'),
  bell: require('../../assets/icons/bell.svg'),
};
export type IconName = keyof typeof sources;

export function Icon({ name, size = 20, color = colors.muted }: { name: IconName; size?: number; color?: string }) {
  return <Image source={sources[name]} tintColor={color} contentFit="contain" accessible={false} style={{ width: size, height: size }} />;
}
