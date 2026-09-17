import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

type CourtCheckSymbolProps = {
  android: AndroidSymbol;
  color: ColorValue;
  ios: SFSymbol;
  size?: number;
};

export function CourtCheckSymbol({ android, color, ios, size = 20 }: CourtCheckSymbolProps) {
  return (
    <SymbolView
      name={{ android, ios, web: android }}
      resizeMode="scaleAspectFit"
      size={size}
      tintColor={color}
      weight="semibold"
    />
  );
}
