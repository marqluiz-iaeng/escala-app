import { darkColors, lightColors } from '@escala/ui';
import { useColorScheme } from 'react-native';

export function useColors() {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}
