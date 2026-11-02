import leaves from '../assets/presets/leaves.svg?url';
import flow from '../assets/presets/flow.svg?url';
import rings from '../assets/presets/rings.svg?url';
import ripples from '../assets/presets/ripples.svg?url';

export const PRESETS = Object.freeze([
  { id: 'leaves', labelKey: 'presetLeaves', url: leaves },
  { id: 'flow', labelKey: 'presetFlow', url: flow },
  { id: 'rings', labelKey: 'presetRings', url: rings },
  { id: 'ripples', labelKey: 'presetRipples', url: ripples },
].map(preset => Object.freeze({ ...preset, fileName: preset.id + '.svg' })));
