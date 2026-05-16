export type ColorSet = {
  id: string;
  ink: string;
  inkMut: string;
  paper: string;
};

export const COLOR_SETS: readonly ColorSet[] = [
  { id: '01', ink: '#ff6fa9', inkMut: '#936c54', paper: '#2f2f2f' },
  { id: '02', ink: '#554348', inkMut: '#69d7c8', paper: '#d4f5f5' },
  { id: '03', ink: '#c6ff54', inkMut: '#876b16', paper: '#4f3b1f' },
  { id: '04', ink: '#1b1b1b', inkMut: '#ff6501', paper: '#d2d2d2' },
  { id: '05', ink: '#dc0b15', inkMut: '#3bb387', paper: '#4f3b1f' },
  { id: '06', ink: '#1e2a78', inkMut: '#c97b5a', paper: '#f4ead8' },
  { id: '07', ink: '#7be0b3', inkMut: '#4a6b6f', paper: '#1a1f1f' },
  { id: '08', ink: '#f6eedf', inkMut: '#7aa2c8', paper: '#1d3a72' },
  { id: '09', ink: '#3d1f3b', inkMut: '#a85a82', paper: '#f5d8df' },
  { id: '10', ink: '#0a0a0a', inkMut: '#ff2d8a', paper: '#fafafa' },
  { id: '11', ink: '#2c3a14', inkMut: '#b89a3e', paper: '#cdd6b0' },
  { id: '12', ink: '#000000', inkMut: '#7a7a7a', paper: '#ffffff' },
] as const;

export const DEFAULT_SET_ID = '03';

export function getSet(id: string): ColorSet {
  return COLOR_SETS.find((s) => s.id === id) ?? COLOR_SETS[2];
}
