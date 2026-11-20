import { arcPts, circle, line, ngon, poly, type Shape } from './shapes';

const PI = Math.PI;
const base = (): Shape => poly(ngon(8, 1, PI / 8));

export const STRUCTURE_ICONS: Record<string, Shape[]> = {
  turret: [base(), circle(0, 0.05, 0.5, { d: true }), circle(0, 0.05, 0.36), poly([-0.12, 0.05, 0.12, 0.05, 0.1, -0.95, -0.1, -0.95])],
  laser: [
    base(), poly(ngon(8, 0.7, PI / 8), { d: true }),
    poly([0, -0.9, 0.38, -0.1, 0, 0.75, -0.38, -0.1]), poly([0, -0.9, 0.38, -0.1, 0, 0.1], { d: true }),
  ],
  pulsar: [circle(0, 0, 0.98, { s: true }), circle(0, 0, 0.64, { s: true }), circle(0, 0, 0.3), line([0, -0.3, 0, -0.64], true)],
  bomber: [
    base(), circle(-0.2, 0.2, 0.46, { d: true }), circle(-0.2, 0.2, 0.34),
    poly([0.05, -0.2, 0.85, -0.65, 0.95, -0.35, 0.3, 0.1]), circle(0.62, -0.6, 0.16, { d: true }),
  ],
  basicOps: [base(), poly([0, -0.62, 0.55, 0.05, 0.25, 0.05, 0.25, 0.6, -0.25, 0.6, -0.25, 0.05, -0.55, 0.05], { d: true })],
  specialOps: [base(), poly([-0.62, -0.5, 0.62, -0.5, 0.62, -0.1, 0.18, -0.1, 0.18, 0.62, -0.18, 0.62, -0.18, -0.1, -0.62, -0.1], { d: true })],
  harvester: [
    poly([-0.9, 0.5, -0.9, 0.2, ...arcPts(0, 0.2, 0.9, PI, 2 * PI, 10), 0.9, 0.5]),
    circle(0, 0.22, 0.34, { d: true }), circle(0, 0.22, 0.2),
    line([-0.55, 0.7, -0.3, 0.95, 0.3, 0.95, 0.55, 0.7]),
  ],
  researchLab: [circle(0, 0.05, 0.55), circle(-0.15, -0.1, 0.18, { d: true }), line(arcPts(0, 0.05, 0.95, -0.2, PI + 0.2, 14)), line(arcPts(0, 0.05, 0.95, PI + 0.5, 2 * PI - 0.5, 8))],
  missileSilo: [poly(ngon(6, 1, 0)), poly(ngon(6, 0.68, 0), { d: true }), poly([0, -0.78, 0.2, -0.35, 0.2, 0.5, -0.2, 0.5, -0.2, -0.35])],
  missileDefense: [circle(0, 0.3, 0.7), circle(0, 0.3, 0.38, { d: true }), poly([-0.5, 0.1, -0.3, 0.1, -0.22, -0.95, -0.42, -0.95]), poly([0.5, 0.1, 0.3, 0.1, 0.22, -0.95, 0.42, -0.95])],
  gateway: [circle(-0.42, 0, 0.55, { s: true }), circle(0.42, 0, 0.55, { s: true }), circle(0, 0, 0.14)],
  waypoint: [poly([0, -0.9, 0.85, 0, 0.35, 0, 0, 0.45, -0.35, 0, -0.85, 0], {}), poly([-0.5, 0.6, 0.5, 0.6, 0.5, 0.85, -0.5, 0.85])],
};
