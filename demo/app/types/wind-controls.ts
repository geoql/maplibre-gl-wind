import type { RampId } from '../utils/color-ramps';

/** The WindParticleLayer props the demo panel exposes. */
export interface WindControls {
  numParticles: number;
  speedFactor: number;
  maxAge: number;
  width: number;
  ramp: RampId;
  animate: boolean;
}
