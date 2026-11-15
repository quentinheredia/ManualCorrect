/**
 * A damped spring sampled into a CSS `linear()` easing, so Web Animations and
 * CSS transitions get genuine spring overshoot instead of a bezier imitation.
 * Underdamped closed form: x(t) = 1 - e^(-ζω t) (cos(ωd t) + ζω/ωd · sin(ωd t)).
 */
export interface Spring {
  easing: string;
  duration: number;
}

const SETTLE_THRESHOLD = 0.004;
const SAMPLES = 48;

export function spring(stiffness: number, damping: number, mass = 1): Spring {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = Math.min(damping / (2 * Math.sqrt(stiffness * mass)), 0.999);
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  const seconds = -Math.log(SETTLE_THRESHOLD) / (zeta * omega);
  const points: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * seconds;
    const envelope = Math.exp(-zeta * omega * t);
    const x = 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t));
    points.push(i === SAMPLES ? '1' : x.toFixed(4));
  }
  return { easing: `linear(${points.join(', ')})`, duration: Math.round(seconds * 1000) };
}

/** Landing a dropped tile: quick, one visible overshoot. */
export const DROP_SPRING = spring(520, 26);
/** Neighbours making room while you drag: softer, barely overshoots. */
export const SHIFT_SPRING = spring(420, 34);
