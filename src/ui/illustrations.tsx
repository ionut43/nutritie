import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

/*
 * Ilustrații plate, desenate în cod (fără imagini externe).
 * Când `active` e fals, fiecare culoare e convertită automat în gri cu aceeași luminozitate,
 * așa că o ilustrație nebifată arată „stinsă”, iar una bifată e colorată.
 */

export type IlloName =
  | 'plita' | 'cuptor' | 'microunde' | 'airfryer' | 'blender' | 'mixer' | 'robot' | 'multicooker' | 'grill' | 'toaster'
  | 'mic_dejun' | 'gustare1' | 'pranz' | 'gustare2' | 'cina'
  | 'singur' | 'cuplu' | 'familie';

function gray(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  // luminozitate percepută, ridicată spre gri deschis ca să pară „stins”
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const v = Math.round(110 + (l / 255) * 130);
  const x = v.toString(16).padStart(2, '0');
  return `#${x}${x}${x}`;
}

export function Illo({ name, active = true, size = 56 }: { name: IlloName; active?: boolean; size?: number }) {
  const c = (hex: string) => (active ? hex : gray(hex));
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {draw(name, c)}
    </Svg>
  );
}

function Person({ x, y, s, color, c }: { x: number; y: number; s: number; color: string; c: (h: string) => string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={6 * s} fill={c('#F6C9A8')} />
      <Path d={`M ${x - 6 * s} ${y - 2 * s} Q ${x} ${y - 10 * s} ${x + 6 * s} ${y - 2 * s} Q ${x} ${y - 5 * s} ${x - 6 * s} ${y - 2 * s} Z`} fill={c('#3D2C29')} />
      <Path d={`M ${x - 10 * s} ${y + 22 * s} Q ${x - 10 * s} ${y + 8 * s} ${x} ${y + 8 * s} Q ${x + 10 * s} ${y + 8 * s} ${x + 10 * s} ${y + 22 * s} Z`} fill={c(color)} />
    </G>
  );
}

function draw(name: IlloName, c: (h: string) => string): React.ReactNode {
  switch (name) {
    case 'microunde':
      return (
        <G>
          <Rect x={5} y={14} width={54} height={36} rx={7} fill={c('#5B8DEF')} />
          <Rect x={10} y={19} width={33} height={26} rx={4} fill={c('#1F2A44')} />
          <Rect x={13} y={22} width={27} height={20} rx={3} fill={c('#FFD66B')} opacity={0.5} />
          <Ellipse cx={26} cy={37} rx={8} ry={2.5} fill={c('#FFFFFF')} opacity={0.6} />
          <Rect x={46} y={19} width={9} height={26} rx={3} fill={c('#E8EEF9')} />
          <Circle cx={50.5} cy={25} r={2.5} fill={c('#5B8DEF')} />
          <Circle cx={50.5} cy={33} r={2.5} fill={c('#5B8DEF')} />
          <Rect x={10} y={50} width={6} height={3} rx={1} fill={c('#3F6BC4')} />
          <Rect x={48} y={50} width={6} height={3} rx={1} fill={c('#3F6BC4')} />
        </G>
      );
    case 'cuptor':
      return (
        <G>
          <Rect x={8} y={6} width={48} height={52} rx={7} fill={c('#F1683C')} />
          <Rect x={8} y={6} width={48} height={13} rx={7} fill={c('#C94F2B')} />
          {[17, 27, 37, 47].map((x) => <Circle key={x} cx={x} cy={12.5} r={2.6} fill={c('#FFFFFF')} />)}
          <Rect x={18} y={22} width={28} height={3.5} rx={1.75} fill={c('#FFFFFF')} />
          <Rect x={13} y={28} width={38} height={24} rx={5} fill={c('#2B1D16')} />
          <Rect x={16} y={31} width={32} height={18} rx={3} fill={c('#FFB347')} opacity={0.45} />
          <Rect x={20} y={43} width={24} height={2} rx={1} fill={c('#FFE0B2')} />
        </G>
      );
    case 'plita':
      return (
        <G>
          <Rect x={5} y={12} width={54} height={42} rx={8} fill={c('#3C4652')} />
          {[[21, 26, 8], [43, 26, 6], [21, 43, 6], [43, 43, 8]].map(([x, y, r]) => (
            <G key={`${x}${y}`}>
              <Circle cx={x} cy={y} r={r} fill={c('#232A31')} />
              <Circle cx={x} cy={y} r={r - 3} fill="none" stroke={c('#FF7A45')} strokeWidth={2} />
            </G>
          ))}
          <Rect x={26} y={52} width={12} height={4} rx={2} fill={c('#232A31')} />
        </G>
      );
    case 'airfryer':
      return (
        <G>
          <Rect x={13} y={6} width={38} height={52} rx={14} fill={c('#7A5AF8')} />
          <Rect x={23} y={13} width={18} height={9} rx={3} fill={c('#B9F6CA')} />
          <Rect x={27} y={16} width={10} height={3} rx={1.5} fill={c('#2E7D32')} />
          <Rect x={16} y={32} width={32} height={20} rx={8} fill={c('#5B3FD6')} />
          <Rect x={26} y={39} width={12} height={5} rx={2.5} fill={c('#FFFFFF')} />
        </G>
      );
    case 'blender':
      return (
        <G>
          <Path d="M 18 12 L 46 12 L 42 44 L 22 44 Z" fill={c('#D6EEFF')} />
          <Path d="M 20.5 26 L 43.5 26 L 42 44 L 22 44 Z" fill={c('#FF7AA2')} />
          <Circle cx={28} cy={33} r={2} fill={c('#FFFFFF')} opacity={0.7} />
          <Circle cx={36} cy={38} r={1.5} fill={c('#FFFFFF')} opacity={0.7} />
          <Rect x={16} y={7} width={32} height={6} rx={3} fill={c('#2D3748')} />
          <Rect x={16} y={44} width={32} height={14} rx={5} fill={c('#2D9CDB')} />
          <Circle cx={32} cy={51} r={3} fill={c('#FFFFFF')} />
        </G>
      );
    case 'mixer':
      return (
        <G>
          <Rect x={8} y={12} width={44} height={20} rx={10} fill={c('#F2C94C')} />
          <Rect x={44} y={16} width={14} height={8} rx={4} fill={c('#E0B53A')} />
          <Circle cx={20} cy={22} r={3} fill={c('#FFFFFF')} />
          <Rect x={22} y={32} width={3} height={14} fill={c('#A0AEC0')} />
          <Rect x={33} y={32} width={3} height={14} fill={c('#A0AEC0')} />
          <Ellipse cx={23.5} cy={51} rx={5} ry={6} fill="none" stroke={c('#A0AEC0')} strokeWidth={2.5} />
          <Ellipse cx={34.5} cy={51} rx={5} ry={6} fill="none" stroke={c('#A0AEC0')} strokeWidth={2.5} />
        </G>
      );
    case 'robot':
      return (
        <G>
          <Rect x={36} y={5} width={9} height={13} rx={2} fill={c('#219653')} />
          <Rect x={12} y={14} width={40} height={30} rx={8} fill={c('#D6F5E3')} />
          {[[22, 34], [30, 37], [38, 33], [26, 29], [34, 28]].map(([x, y]) => <Circle key={`${x}${y}`} cx={x} cy={y} r={3} fill={c('#F2994A')} />)}
          <Rect x={10} y={42} width={44} height={16} rx={6} fill={c('#27AE60')} />
          <Circle cx={32} cy={50} r={3.5} fill={c('#FFFFFF')} />
        </G>
      );
    case 'multicooker':
      return (
        <G>
          <Rect x={7} y={22} width={6} height={8} rx={3} fill={c('#2D3748')} />
          <Rect x={51} y={22} width={6} height={8} rx={3} fill={c('#2D3748')} />
          <Rect x={10} y={18} width={44} height={38} rx={14} fill={c('#EB5757')} />
          <Ellipse cx={32} cy={18} rx={22} ry={7} fill={c('#C0392B')} />
          <Rect x={28} y={8} width={8} height={5} rx={2.5} fill={c('#2D3748')} />
          <Rect x={22} y={34} width={20} height={10} rx={3} fill={c('#FDEBD0')} />
          <Rect x={26} y={37.5} width={12} height={3} rx={1.5} fill={c('#C0392B')} />
        </G>
      );
    case 'grill':
      return (
        <G>
          <Rect x={44} y={30} width={17} height={7} rx={3.5} fill={c('#8D6E63')} />
          <Rect x={5} y={16} width={42} height={36} rx={8} fill={c('#4F4F4F')} />
          {[14, 22, 30, 38].map((x) => <Rect key={x} x={x} y={20} width={2.5} height={28} rx={1} fill={c('#7A7A7A')} />)}
          <Ellipse cx={26} cy={34} rx={12} ry={8} fill={c('#C0583A')} />
          <Line x1={19} y1={30} x2={27} y2={38} stroke={c('#7A2E1A')} strokeWidth={2} />
          <Line x1={25} y1={29} x2={33} y2={37} stroke={c('#7A2E1A')} strokeWidth={2} />
        </G>
      );
    case 'toaster':
      return (
        <G>
          <Path d="M 18 24 L 18 14 Q 18 9 23 9 L 28 9 Q 33 9 33 14 L 33 24 Z" fill={c('#E2B270')} />
          <Path d="M 34 24 L 34 16 Q 34 11 39 11 L 44 11 Q 49 11 49 16 L 49 24 Z" fill={c('#E2B270')} />
          <Rect x={8} y={22} width={48} height={32} rx={11} fill={c('#56CCF2')} />
          <Rect x={16} y={22} width={16} height={4} rx={2} fill={c('#1B4F6B')} />
          <Rect x={33} y={22} width={16} height={4} rx={2} fill={c('#1B4F6B')} />
          <Rect x={54} y={32} width={6} height={4} rx={2} fill={c('#2D3748')} />
          <Rect x={14} y={54} width={8} height={3} rx={1.5} fill={c('#2F80A8')} />
          <Rect x={42} y={54} width={8} height={3} rx={1.5} fill={c('#2F80A8')} />
        </G>
      );
    case 'mic_dejun':
      return (
        <G>
          <Circle cx={22} cy={22} r={10} fill={c('#FFC94D')} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return <Line key={a} x1={22 + Math.cos(r) * 13} y1={22 + Math.sin(r) * 13} x2={22 + Math.cos(r) * 17} y2={22 + Math.sin(r) * 17} stroke={c('#FFB020')} strokeWidth={2.5} strokeLinecap="round" />;
          })}
          <Path d="M 26 36 L 50 36 L 47 56 Q 46.5 58 44 58 L 32 58 Q 29.5 58 29 56 Z" fill={c('#8D5A3B')} />
          <Path d="M 50 40 Q 58 40 57 46 Q 56 51 48 50" fill="none" stroke={c('#8D5A3B')} strokeWidth={3} />
          <Ellipse cx={38} cy={36} rx={12} ry={2.5} fill={c('#5D3A25')} />
          <Path d="M 34 30 Q 32 27 34 24 M 40 30 Q 38 27 40 24" stroke={c('#B0BEC5')} strokeWidth={2} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'gustare1':
      return (
        <G>
          <Path d="M 32 18 Q 44 12 50 22 Q 56 36 46 50 Q 40 58 32 53 Q 24 58 18 50 Q 8 36 14 22 Q 20 12 32 18 Z" fill={c('#EF5350')} />
          <Path d="M 32 18 Q 32 10 36 6" stroke={c('#6D4C41')} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M 35 12 Q 44 6 48 12 Q 42 16 35 12 Z" fill={c('#66BB6A')} />
          <Ellipse cx={22} cy={28} rx={3} ry={6} fill={c('#FFFFFF')} opacity={0.35} />
        </G>
      );
    case 'gustare2':
      return (
        <G>
          <Path d="M 14 26 L 50 26 L 46 54 Q 45 58 41 58 L 23 58 Q 19 58 18 54 Z" fill={c('#ECEFF1')} />
          <Path d="M 15.5 34 L 48.5 34 L 46 54 Q 45 58 41 58 L 23 58 Q 19 58 18 54 Z" fill={c('#FFFFFF')} />
          <Circle cx={26} cy={30} r={5} fill={c('#7E57C2')} />
          <Circle cx={36} cy={28} r={5} fill={c('#E53935')} />
          <Circle cx={31} cy={22} r={4} fill={c('#3949AB')} />
          <Rect x={12} y={24} width={40} height={4} rx={2} fill={c('#90CAF9')} />
        </G>
      );
    case 'pranz':
      return (
        <G>
          <Circle cx={32} cy={34} r={24} fill={c('#E3F2FD')} />
          <Circle cx={32} cy={34} r={18} fill={c('#FFFFFF')} />
          <Path d="M 18 38 Q 22 26 32 28 Q 30 36 18 38 Z" fill={c('#66BB6A')} />
          <Ellipse cx={38} cy={30} rx={8} ry={5} fill={c('#C0583A')} />
          <Circle cx={30} cy={42} r={5} fill={c('#FFCA28')} />
          <Circle cx={40} cy={41} r={3.5} fill={c('#EF5350')} />
          <Rect x={4} y={14} width={3} height={36} rx={1.5} fill={c('#90A4AE')} />
          <Rect x={57} y={14} width={3} height={36} rx={1.5} fill={c('#90A4AE')} />
        </G>
      );
    case 'cina':
      return (
        <G>
          <Path d="M 40 10 A 22 22 0 1 0 54 44 A 18 18 0 1 1 40 10 Z" fill={c('#5C6BC0')} />
          <Circle cx={48} cy={14} r={2.5} fill={c('#FFD54F')} />
          <Circle cx={56} cy={26} r={1.8} fill={c('#FFD54F')} />
          <Circle cx={44} cy={26} r={1.5} fill={c('#FFD54F')} />
          <Circle cx={24} cy={30} r={3} fill={c('#7986CB')} opacity={0.7} />
          <Circle cx={30} cy={42} r={2} fill={c('#7986CB')} opacity={0.7} />
        </G>
      );
    case 'singur':
      return <Person x={32} y={20} s={1.4} color="#4F8EF7" c={c} />;
    case 'cuplu':
      return (
        <G>
          <Person x={22} y={22} s={1.15} color="#4F8EF7" c={c} />
          <Person x={42} y={22} s={1.15} color="#F45B69" c={c} />
          <Path d="M 32 10 Q 29 6 27 9 Q 25 12 32 17 Q 39 12 37 9 Q 35 6 32 10 Z" fill={c('#F45B69')} />
        </G>
      );
    case 'familie':
      return (
        <G>
          <Person x={17} y={20} s={1.05} color="#4F8EF7" c={c} />
          <Person x={47} y={20} s={1.05} color="#F45B69" c={c} />
          <Person x={32} y={34} s={0.75} color="#F7B32B" c={c} />
        </G>
      );
  }
}
