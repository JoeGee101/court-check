import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

type CourtCheckSymbolProps = {
  android: AndroidSymbol;
  color: string;
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
