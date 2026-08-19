/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { create, all } from 'mathjs';
import { 
  LineChart, 
  Settings, 
  Download, 
  Plus, 
  Trash2, 
  Info, 
  Maximize2, 
  Minimize2,
  FunctionSquare,
  Crosshair,
  Activity,
  ChevronLeft,
  ChevronRight,
  Search,
  Copy,
  RotateCcw,
  Share2,
  Moon,
  Sun,
  HelpCircle,
  Edit3,
  Sliders,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Sparkles,
  Layers,
  Grid,
  Table,
  Bookmark,
  BookOpen,
  MousePointer,
  Hand,
  ZoomIn,
  ZoomOut,
  Focus,
  Check,
  MoreHorizontal,
  X,
  GitCommit,
  Move,
  MapPin,
  BarChart2,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  LogOut,
  User as UserIcon,
  Loader2,
  Mail,
  Undo2,
  Redo2,
  Sigma,
  AreaChart,
  Circle as CircleIcon,
  Ruler,
  Spline,
  Shapes,
  Compass,
  CircleDot,
  RotateCw,
  Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  auth, 
  logOut, 
  syncUserProfile, 
  UserProfile, 
  fetchAdminNotifications 
} from './firebase';
import { AuthPage } from './components/AuthPage';
import { AdminPanel } from './components/AdminPanel';

const math = create(all);

// --- Types ---
export interface FunctionConfig {
  id: string;
  equation: string;
  color: string;
  visible: boolean;
  style: 'solid' | 'dashed';
  strokeWidth: number;
  showDerivative: boolean;
  showDerivativeIntegral?: boolean;
  derivativeIntegralLower?: number;
  derivativeIntegralUpper?: number;
  showTangent: boolean;
  tangentPoint: number;
  showExtrema: boolean;
  showInverse: boolean;
  showIntegral?: boolean;
  integralLower?: number;
  integralUpper?: number;
  integralSubdivisions?: number;
  showRiemannStrips?: boolean;
}

export interface IntegralResult {
  signedValue: number | null;
  absoluteArea: number | null;
  averageValue: number | null;
  leftRiemann: number | null;
  rightRiemann: number | null;
  midpointRiemann: number | null;
  trapezoidal: number | null;
  simpsons: number | null;
  errorEstimate: number | null;
  nSubdivisions: number;
}

export function computeDefiniteIntegral(
  evalFn: (x: number) => number | null,
  a: number,
  b: number,
  nSubdivisions: number = 100
): IntegralResult {
  if (Math.abs(b - a) < 1e-12) {
    const valAtA = evalFn(a);
    return {
      signedValue: 0,
      absoluteArea: 0,
      averageValue: valAtA !== null && isFinite(valAtA) ? valAtA : 0,
      leftRiemann: 0,
      rightRiemann: 0,
      midpointRiemann: 0,
      trapezoidal: 0,
      simpsons: 0,
      errorEstimate: 0,
      nSubdivisions
    };
  }

  const isReversed = a > b;
  const lower = isReversed ? b : a;
  const upper = isReversed ? a : b;
  const span = upper - lower;

  const n = Math.max(4, nSubdivisions % 2 === 0 ? nSubdivisions : nSubdivisions + 1);
  const dx = span / n;

  let leftSum = 0;
  let rightSum = 0;
  let midSum = 0;
  let trapSum = 0;
  let absAreaSum = 0;

  for (let i = 0; i < n; i++) {
    const xLeft = lower + i * dx;
    const xRight = lower + (i + 1) * dx;
    const xMid = lower + (i + 0.5) * dx;

    const yLeft = evalFn(xLeft);
    const yRight = evalFn(xRight);
    const yMid = evalFn(xMid);

    if (yLeft !== null && isFinite(yLeft) && !isNaN(yLeft)) {
      leftSum += yLeft * dx;
    }
    if (yRight !== null && isFinite(yRight) && !isNaN(yRight)) {
      rightSum += yRight * dx;
    }
    if (yMid !== null && isFinite(yMid) && !isNaN(yMid)) {
      midSum += yMid * dx;
      absAreaSum += Math.abs(yMid) * dx;
    }
    if (yLeft !== null && yRight !== null && isFinite(yLeft) && isFinite(yRight)) {
      trapSum += ((yLeft + yRight) / 2) * dx;
    }
  }

  // Simpson's 1/3 Rule
  let sSum = 0;
  let simpSum = 0;
  const y0 = evalFn(lower);
  const yn = evalFn(upper);
  if (y0 !== null && yn !== null && isFinite(y0) && isFinite(yn)) {
    sSum += y0 + yn;
    for (let i = 1; i < n; i++) {
      const xi = lower + i * dx;
      const yi = evalFn(xi);
      if (yi !== null && isFinite(yi)) {
        sSum += (i % 2 === 1 ? 4 : 2) * yi;
      }
    }
    simpSum = (dx / 3) * sSum;
  } else {
    simpSum = trapSum;
  }

  const sign = isReversed ? -1 : 1;
  const finalSigned = simpSum * sign;
  const avgVal = (b !== a) ? (finalSigned / (b - a)) : (evalFn(a) ?? 0);
  const errorEst = Math.abs(simpSum - trapSum);

  return {
    signedValue: Number.isFinite(finalSigned) ? finalSigned : null,
    absoluteArea: Number.isFinite(absAreaSum) ? absAreaSum : null,
    averageValue: Number.isFinite(avgVal) ? avgVal : null,
    leftRiemann: Number.isFinite(leftSum * sign) ? leftSum * sign : null,
    rightRiemann: Number.isFinite(rightSum * sign) ? rightSum * sign : null,
    midpointRiemann: Number.isFinite(midSum * sign) ? midSum * sign : null,
    trapezoidal: Number.isFinite(trapSum * sign) ? trapSum * sign : null,
    simpsons: Number.isFinite(finalSigned) ? finalSigned : null,
    errorEstimate: Number.isFinite(errorEst) ? errorEst : null,
    nSubdivisions: n
  };
}

interface IntersectionPoint {
  x: number;
  y: number;
  label?: string;
}

export type ShapeType = 'line' | 'circle' | 'semicircle';
export type LineMode = 'segment' | 'polyline' | 'infinite';
export type SemicircleOrientation = 'top' | 'bottom' | 'left' | 'right';

export interface Point2D {
  x: number;
  y: number;
}

export interface CustomShape {
  id: string;
  type: ShapeType;
  label: string;
  color: string;
  strokeWidth: number;
  style: 'solid' | 'dashed';
  fillColor?: string;
  fillOpacity?: number;
  visible: boolean;
  
  // For 'line'
  lineMode?: LineMode;
  points?: Point2D[];
  
  // For 'circle' & 'semicircle'
  center?: Point2D;
  radius?: number;
  
  // For 'semicircle'
  semiOrientation?: SemicircleOrientation;

  // Rotation in degrees (0 to 360)
  rotation?: number;
}

export function formatLineEquation(p1: Point2D, p2: Point2D): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (Math.abs(dx) < 1e-6) {
    return `x = ${p1.x.toFixed(2)}`;
  }
  const m = dy / dx;
  const b = p1.y - m * p1.x;
  const mSign = m < 0 ? '-' : '';
  const absM = Math.abs(m);
  const mStr = Math.abs(absM - 1) < 1e-3 ? `${mSign}x` : absM < 1e-3 ? '' : `${m.toFixed(2)}x`;
  
  if (!mStr) {
    return `y = ${b.toFixed(2)}`;
  }
  if (Math.abs(b) < 1e-3) {
    return `y = ${mStr}`;
  }
  return `y = ${mStr} ${b > 0 ? '+' : '-'} ${Math.abs(b).toFixed(2)}`;
}

export function formatCircleEquation(center: Point2D, radius: number): string {
  const h = center.x;
  const k = center.y;
  const r2 = (radius * radius).toFixed(2);
  const hTerm = Math.abs(h) < 1e-3 ? 'x²' : `(x ${h > 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})²`;
  const kTerm = Math.abs(k) < 1e-3 ? 'y²' : `(y ${k > 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})²`;
  return `${hTerm} + ${kTerm} = ${r2}`;
}

export function formatSemicircleEquation(center: Point2D, radius: number, orientation: SemicircleOrientation = 'top'): string {
  const h = center.x;
  const k = center.y;
  const r2 = (radius * radius).toFixed(2);
  const hTerm = Math.abs(h) < 1e-3 ? 'x^2' : `(x ${h > 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})^2`;
  const kOffset = Math.abs(k) < 1e-3 ? '' : ` ${k > 0 ? '+' : '-'} ${Math.abs(k).toFixed(2)}`;

  if (orientation === 'top') {
    return `y = √(${r2} - ${hTerm})${kOffset} (y ≥ ${k.toFixed(2)})`;
  } else if (orientation === 'bottom') {
    return `y = -√(${r2} - ${hTerm})${kOffset} (y ≤ ${k.toFixed(2)})`;
  } else if (orientation === 'right') {
    return `x = √(${r2} - (y ${k > 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})²) + ${h.toFixed(2)} (x ≥ ${h.toFixed(2)})`;
  } else {
    return `x = -√(${r2} - (y ${k > 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})²) + ${h.toFixed(2)} (x ≤ ${h.toFixed(2)})`;
  }
}

interface HistorySnapshot {
  functions: FunctionConfig[];
  placedPins: { id: string; x: number; y: number; label: string }[];
  drawnShapes?: CustomShape[];
  editingFunctionId: string | null;
  gridStyle: 'Cartesian' | 'Polar' | 'Isometric' | 'Blank';
  angleUnit: 'radians' | 'degrees';
  decimalPrecision: number;
}

export interface DerivativeInfo {
  symbolic: string;
  formatted: string;
  isValid: boolean;
}

export function getDerivativeEquation(rawExpr: string): DerivativeInfo {
  try {
    if (!rawExpr || !rawExpr.trim()) {
      return { symbolic: '0', formatted: "f'(x) = 0", isValid: true };
    }
    const node = math.derivative(rawExpr, 'x');
    let simplifiedStr = node.toString();
    try {
      simplifiedStr = math.simplify(node).toString();
    } catch {
      simplifiedStr = node.toString();
    }
    return {
      symbolic: simplifiedStr,
      formatted: `f'(x) = ${simplifiedStr}`,
      isValid: true
    };
  } catch {
    return {
      symbolic: `d/dx(${rawExpr})`,
      formatted: `f'(x) = d/dx(${rawExpr})`,
      isValid: false
    };
  }
}

export interface InverseInfo {
  symbolicEquation: string;
  displayName: string;
  parametricForm: string;
  domainConstraint: string;
  rangeConstraint: string;
  isExact: boolean;
  notes: string;
}

export function getInverseEquationInfo(rawExpr: string): InverseInfo {
  const clean = rawExpr.trim().replace(/\s+/g, '');

  if (clean === 'x') {
    return {
      symbolicEquation: 'x',
      displayName: 'f⁻¹(x) = x',
      parametricForm: '(t, t)',
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Self-inverse identity line along y = x'
    };
  }
  if (clean === '-x') {
    return {
      symbolicEquation: '-x',
      displayName: 'f⁻¹(x) = -x',
      parametricForm: '(-t, t)',
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Self-inverse perpendicular line'
    };
  }

  // x + c or x - c
  const addMatch = clean.match(/^x([+-]\d+(?:\.\d+)?)$/);
  if (addMatch) {
    const c = parseFloat(addMatch[1]);
    const invC = -c;
    const invEq = invC >= 0 ? `x + ${invC}` : `x - ${Math.abs(invC)}`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `(t ${c >= 0 ? '+' : '-'} ${Math.abs(c)}, t)`,
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: `Horizontal shift inverted: ${invEq}`
    };
  }

  // c + x or c - x
  const constMatch = clean.match(/^(\d+(?:\.\d+)?)([+-])x$/);
  if (constMatch) {
    const c = constMatch[1];
    const op = constMatch[2];
    const invEq = op === '+' ? `x - ${c}` : `${c} - x`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `(${c} ${op} t, t)`,
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: `Linear inversion: ${invEq}`
    };
  }

  // a*x + b or a*x - b or a*x
  const linearMatch = clean.match(/^([+-]?\d+(?:\.\d+)?)\*?x(?:([+-]\d+(?:\.\d+)?))?$/);
  if (linearMatch) {
    const a = parseFloat(linearMatch[1]);
    const b = linearMatch[2] ? parseFloat(linearMatch[2]) : 0;
    if (a !== 0) {
      let invEq = '';
      if (b === 0) {
        invEq = a === 1 ? 'x' : a === -1 ? '-x' : `x / ${a}`;
      } else {
        const invB = -b;
        const top = invB >= 0 ? `x + ${invB}` : `x - ${Math.abs(invB)}`;
        invEq = `(${top}) / ${a}`;
      }
      return {
        symbolicEquation: invEq,
        displayName: `f⁻¹(x) = ${invEq}`,
        parametricForm: `(${a}*t ${b >= 0 ? '+' : '-'} ${Math.abs(b)}, t)`,
        domainConstraint: 'x ∈ ℝ',
        rangeConstraint: 'y ∈ ℝ',
        isExact: true,
        notes: `Linear algebraic inverse: (x - b)/a`
      };
    }
  }

  // (x + b) / a or (x - b) / a
  const divLinearMatch = clean.match(/^\(x([+-]\d+(?:\.\d+)?)\)\/(\d+(?:\.\d+)?)$/);
  if (divLinearMatch) {
    const b = parseFloat(divLinearMatch[1]);
    const a = parseFloat(divLinearMatch[2]);
    const invEq = `${a}*x ${-b >= 0 ? '+' : '-'} ${Math.abs(b)}`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `((t ${b >= 0 ? '+' : '-'} ${Math.abs(b)})/${a}, t)`,
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: `Linear inverse expanded: ${invEq}`
    };
  }

  // Powers & Roots
  if (clean === 'x^2' || clean === 'x*x') {
    return {
      symbolicEquation: 'sqrt(x)',
      displayName: 'f⁻¹(x) = √x',
      parametricForm: '(t^2, t)',
      domainConstraint: 'x ≥ 0 (Principal Branch)',
      rangeConstraint: 'y ≥ 0 (or ±√x on full domain)',
      isExact: true,
      notes: 'Standard quadratic reflection restricted to domain x ≥ 0'
    };
  }

  const quadShiftMatch = clean.match(/^x\^2([+-]\d+(?:\.\d+)?)$/);
  if (quadShiftMatch) {
    const k = parseFloat(quadShiftMatch[1]);
    const invEq = `sqrt(x ${-k >= 0 ? '+' : '-'} ${Math.abs(k)})`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `(t^2 ${k >= 0 ? '+' : '-'} ${Math.abs(k)}, t)`,
      domainConstraint: `x ≥ ${k}`,
      rangeConstraint: 'y ≥ 0',
      isExact: true,
      notes: `Shifted parabola inverse on x ≥ ${k}`
    };
  }

  const quadInnerShift = clean.match(/^\(x([+-]\d+(?:\.\d+)?)\)\^2$/);
  if (quadInnerShift) {
    const h = parseFloat(quadInnerShift[1]);
    const invEq = `sqrt(x) ${-h >= 0 ? '+' : '-'} ${Math.abs(h)}`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `((t ${h >= 0 ? '+' : '-'} ${Math.abs(h)})^2, t)`,
      domainConstraint: 'x ≥ 0',
      rangeConstraint: `y ≥ ${-h}`,
      isExact: true,
      notes: `Horizontally shifted parabola inverse`
    };
  }

  if (clean === 'sqrt(x)' || clean === 'x^(0.5)' || clean === 'x^(1/2)') {
    return {
      symbolicEquation: 'x^2',
      displayName: 'f⁻¹(x) = x²',
      parametricForm: '(sqrt(t), t)',
      domainConstraint: 'x ≥ 0',
      rangeConstraint: 'y ≥ 0',
      isExact: true,
      notes: 'Square root inverted into parabolic branch (x ≥ 0)'
    };
  }

  if (clean === 'x^3') {
    return {
      symbolicEquation: 'cbrt(x)',
      displayName: 'f⁻¹(x) = ∛x',
      parametricForm: '(t^3, t)',
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Cubic bijection inverted to real cube root'
    };
  }

  if (clean === 'cbrt(x)' || clean === 'x^(1/3)') {
    return {
      symbolicEquation: 'x^3',
      displayName: 'f⁻¹(x) = x³',
      parametricForm: '(cbrt(t), t)',
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Cube root inverted to cubic polynomial'
    };
  }

  // Exponentials & Logarithms
  if (clean === 'e^x' || clean === 'exp(x)') {
    return {
      symbolicEquation: 'ln(x)',
      displayName: 'f⁻¹(x) = ln(x)',
      parametricForm: '(e^t, t)',
      domainConstraint: 'x > 0',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Natural exponential inverted to natural logarithm'
    };
  }

  if (clean === 'ln(x)' || clean === 'log(x)') {
    return {
      symbolicEquation: clean.startsWith('ln') ? 'e^x' : '10^x',
      displayName: clean.startsWith('ln') ? 'f⁻¹(x) = eˣ' : 'f⁻¹(x) = 10ˣ',
      parametricForm: `(${clean.replace('x', 't')}, t)`,
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: 'y > 0',
      isExact: true,
      notes: 'Logarithmic curve inverted to continuous exponential'
    };
  }

  const expMatch = clean.match(/^(\d+(?:\.\d+)?)\^x$/);
  if (expMatch) {
    const base = expMatch[1];
    return {
      symbolicEquation: `log(x, ${base})`,
      displayName: `f⁻¹(x) = log_${base}(x)`,
      parametricForm: `(${base}^t, t)`,
      domainConstraint: 'x > 0',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: `Base-${base} exponential inverted to logarithm`
    };
  }

  // Trigonometric & Inverse Trig
  if (clean === 'sin(x)') {
    return {
      symbolicEquation: 'asin(x)',
      displayName: 'f⁻¹(x) = arcsin(x)',
      parametricForm: '(sin(t), t)',
      domainConstraint: '-1 ≤ x ≤ 1',
      rangeConstraint: '-π/2 ≤ y ≤ π/2',
      isExact: true,
      notes: 'Principal sine branch restricted to [-π/2, π/2]'
    };
  }

  if (clean === 'cos(x)') {
    return {
      symbolicEquation: 'acos(x)',
      displayName: 'f⁻¹(x) = arccos(x)',
      parametricForm: '(cos(t), t)',
      domainConstraint: '-1 ≤ x ≤ 1',
      rangeConstraint: '0 ≤ y ≤ π',
      isExact: true,
      notes: 'Principal cosine branch restricted to [0, π]'
    };
  }

  if (clean === 'tan(x)') {
    return {
      symbolicEquation: 'atan(x)',
      displayName: 'f⁻¹(x) = arctan(x)',
      parametricForm: '(tan(t), t)',
      domainConstraint: 'x ∈ ℝ',
      rangeConstraint: '-π/2 < y < π/2',
      isExact: true,
      notes: 'Principal tangent branch restricted to (-π/2, π/2)'
    };
  }

  if (clean === 'asin(x)' || clean === 'arcsin(x)') {
    return {
      symbolicEquation: 'sin(x)',
      displayName: 'f⁻¹(x) = sin(x)',
      parametricForm: '(asin(t), t)',
      domainConstraint: '-π/2 ≤ x ≤ π/2',
      rangeConstraint: '-1 ≤ y ≤ 1',
      isExact: true,
      notes: 'Inverse sine inverted back to sinusoidal wave'
    };
  }

  if (clean === 'acos(x)' || clean === 'arccos(x)') {
    return {
      symbolicEquation: 'cos(x)',
      displayName: 'f⁻¹(x) = cos(x)',
      parametricForm: '(acos(t), t)',
      domainConstraint: '0 ≤ x ≤ π',
      rangeConstraint: '-1 ≤ y ≤ 1',
      isExact: true,
      notes: 'Inverse cosine inverted back to sinusoidal wave'
    };
  }

  if (clean === 'atan(x)' || clean === 'arctan(x)') {
    return {
      symbolicEquation: 'tan(x)',
      displayName: 'f⁻¹(x) = tan(x)',
      parametricForm: '(atan(t), t)',
      domainConstraint: '-π/2 < x < π/2',
      rangeConstraint: 'y ∈ ℝ',
      isExact: true,
      notes: 'Inverse tangent inverted back to periodic tangent'
    };
  }

  // Rational
  if (clean === '1/x') {
    return {
      symbolicEquation: '1/x',
      displayName: 'f⁻¹(x) = 1/x',
      parametricForm: '(1/t, t)',
      domainConstraint: 'x ≠ 0',
      rangeConstraint: 'y ≠ 0',
      isExact: true,
      notes: 'Self-inverse reciprocal hyperbola'
    };
  }

  const recShiftMatch = clean.match(/^1\/\(x([+-]\d+(?:\.\d+)?)\)$/);
  if (recShiftMatch) {
    const d = parseFloat(recShiftMatch[1]);
    const invEq = `1/x ${-d >= 0 ? '+' : '-'} ${Math.abs(d)}`;
    return {
      symbolicEquation: invEq,
      displayName: `f⁻¹(x) = ${invEq}`,
      parametricForm: `(1/(t ${d >= 0 ? '+' : '-'} ${Math.abs(d)}), t)`,
      domainConstraint: 'x ≠ 0',
      rangeConstraint: `y ≠ ${-d}`,
      isExact: true,
      notes: `Shifted hyperbola inverse`
    };
  }

  // Absolute Value
  if (clean === 'abs(x)') {
    return {
      symbolicEquation: 'x',
      displayName: 'f⁻¹(x) = x (for x ≥ 0)',
      parametricForm: '(|t|, t)',
      domainConstraint: 'x ≥ 0',
      rangeConstraint: 'y ≥ 0 (branch restricted)',
      isExact: false,
      notes: 'Non-injective on ℝ; inverse defined on positive branch x ≥ 0'
    };
  }

  // Default General Parametric Reflection
  return {
    symbolicEquation: 'f⁻¹(x)',
    displayName: `f⁻¹(x) [Parametric: (f(t), t)]`,
    parametricForm: `(f(t), t) reflected across y = x`,
    domainConstraint: 'Range of f(x)',
    rangeConstraint: 'Domain of f(x)',
    isExact: false,
    notes: 'Rendered via continuous parametric symmetry reflection across y = x'
  };
}

// --- Default Function Colors ---
const COLORS = ['#3b82f6', '#ef4444', '#a855f7', '#10b981', '#f59e0b', '#ec4899'];

// --- Logo Component ---
const AppLogo = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <div 
    className={`relative inline-flex items-center justify-center bg-gradient-to-br from-indigo-900/80 to-slate-900 rounded-xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10 ${className}`} 
    style={{ width: size * 1.5, height: size * 1.5 }}
  >
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size }}>
      <path 
        d="M22 12h-4l-3 9L9 3l-3 9H2" 
        stroke="url(#neonGradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <defs>
        <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

// --- Sample Presets ---
const FUNCTION_SAMPLES = [
  { label: 'Quadratic', value: 'x^2' },
  { label: 'Linear Shift', value: 'x + 2' },
  { label: 'Sine Wave', value: 'sin(x)' },
  { label: 'Cosine Wave', value: 'cos(x)' },
  { label: 'Exponential', value: 'e^x' },
  { label: 'Logarithmic', value: 'ln(x)' },
  { label: 'Cubic Curve', value: 'x^3 - 3*x' },
  { label: 'Absolute Value', value: 'abs(x)' },
  { label: 'Rational (1/x)', value: '1/x' },
  { label: 'Gaussian Curve', value: 'e^(-x^2)' },
];

// --- Bounds Clamping Helper ---
function clampBounds(domain: [number, number], minVal = -100, maxVal = 100): [number, number] {
  let [d0, d1] = domain;
  let span = d1 - d0;
  if (span >= (maxVal - minVal)) {
    return [minVal, maxVal];
  }
  if (d0 < minVal) {
    d0 = minVal;
    d1 = d0 + span;
  }
  if (d1 > maxVal) {
    d1 = maxVal;
    d0 = d1 - span;
  }
  return [d0, d1];
}

// --- Zoom Scale Mapping Helpers (0% to 100%) ---
function spanToZoomPercent(spanX: number): number {
  const minSpan = 0.5;
  const maxSpan = 200;
  const clampedSpan = Math.max(minSpan, Math.min(maxSpan, spanX));
  const percent = 100 * (Math.log(clampedSpan / maxSpan) / Math.log(minSpan / maxSpan));
  return Math.round(Math.max(0, Math.min(100, percent)));
}

function zoomPercentToSpan(percent: number): number {
  const minSpan = 0.5;
  const maxSpan = 200;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return maxSpan * Math.pow(minSpan / maxSpan, p);
}

// --- Default 25% Zoom Viewport Constants ---
const DEFAULT_ZOOM_PERCENT = 25;
const DEFAULT_SPAN_X = zoomPercentToSpan(DEFAULT_ZOOM_PERCENT);
const DEFAULT_SPAN_Y = DEFAULT_SPAN_X * (10 / 12);
const DEFAULT_VIEWPORT_DOMAIN: [number, number] = [
  -Math.round((DEFAULT_SPAN_X / 2) * 100) / 100,
  Math.round((DEFAULT_SPAN_X / 2) * 100) / 100
];
const DEFAULT_VIEWPORT_RANGE: [number, number] = [
  -Math.round((DEFAULT_SPAN_Y / 2) * 100) / 100,
  Math.round((DEFAULT_SPAN_Y / 2) * 100) / 100
];

// --- Color conversion helper for html2canvas (converts oklch/oklab to rgb/rgba) ---
function oklabToRgb(l: number, aLab: number, bLab: number, alpha: number = 1): string {
  const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
  const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
  const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

  const L = l_ * l_ * l_;
  const M = m_ * m_ * m_;
  const S = s_ * s_ * s_;

  let rLin = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  let gLin = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  let bLin = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S;

  const toSrgb = (x: number) => {
    const clamped = Math.max(0, Math.min(1, x));
    return clamped > 0.0031308
      ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
      : 12.92 * clamped;
  };

  const r = Math.round(toSrgb(rLin) * 255);
  const g = Math.round(toSrgb(gLin) * 255);
  const b = Math.round(toSrgb(bLin) * 255);

  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function oklchToRgb(l: number, c: number, h: number, alpha: number = 1): string {
  const hRad = (h * Math.PI) / 180;
  const aLab = c * Math.cos(hRad);
  const bLab = c * Math.sin(hRad);
  return oklabToRgb(l, aLab, bLab, alpha);
}

let canvas2dContext: CanvasRenderingContext2D | null = null;
if (typeof document !== 'undefined') {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    canvas2dContext = canvas.getContext('2d');
  } catch {
    // ignore
  }
}

function convertCssValueToRgb(val: string): string {
  if (!val || typeof val !== 'string') return val;
  if (!val.includes('oklch') && !val.includes('oklab') && !val.includes('color(')) {
    return val;
  }

  return val.replace(/(oklch|oklab|color)\([^)]+\)/gi, (match) => {
    if (canvas2dContext) {
      try {
        canvas2dContext.fillStyle = '#000000';
        canvas2dContext.fillStyle = match;
        const converted = canvas2dContext.fillStyle;
        if (
          converted && 
          converted !== '#000000' && 
          !converted.includes('oklch') && 
          !converted.includes('oklab') && 
          !converted.includes('color(')
        ) {
          return converted;
        }
      } catch {
        // fallback to manual parsing
      }
    }

    try {
      const isOklch = /^oklch/i.test(match);
      const isOklab = /^oklab/i.test(match);
      const isColor = /^color/i.test(match);

      const inner = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')')).trim();
      const parts = inner.split('/');
      const colorTokens = parts[0].trim().split(/\s+/);
      
      let alpha = 1;
      if (parts.length > 1) {
        const aStr = parts[1].trim();
        if (aStr.endsWith('%')) {
          alpha = parseFloat(aStr) / 100;
        } else {
          alpha = parseFloat(aStr);
        }
      }

      if (isOklch && colorTokens.length >= 3) {
        let l = parseFloat(colorTokens[0]);
        if (colorTokens[0].endsWith('%') || l > 1) l = l / 100;
        let c = parseFloat(colorTokens[1]);
        let h = parseFloat(colorTokens[2]);
        return oklchToRgb(l, c, h, alpha);
      }

      if (isOklab && colorTokens.length >= 3) {
        let l = parseFloat(colorTokens[0]);
        if (colorTokens[0].endsWith('%') || l > 1) l = l / 100;
        let aLab = parseFloat(colorTokens[1]);
        let bLab = parseFloat(colorTokens[2]);
        return oklabToRgb(l, aLab, bLab, alpha);
      }

      if (isColor && colorTokens.length >= 4) {
        let r = parseFloat(colorTokens[1]);
        if (colorTokens[1].endsWith('%')) r = r / 100;
        let g = parseFloat(colorTokens[2]);
        if (colorTokens[2].endsWith('%')) g = g / 100;
        let b = parseFloat(colorTokens[3]);
        if (colorTokens[3].endsWith('%')) b = b / 100;
        const r255 = Math.round(r * 255);
        const g255 = Math.round(g * 255);
        const b255 = Math.round(b * 255);
        if (alpha < 1) {
          return `rgba(${r255}, ${g255}, ${b255}, ${alpha.toFixed(3)})`;
        }
        return `rgb(${r255}, ${g255}, ${b255})`;
      }
    } catch {
      // fallback
    }

    return 'rgb(18, 21, 36)';
  });
}

export default function App() {
  // --- Auth & User State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const { profile } = await syncUserProfile(user);
          setUserProfile(profile);

          if (profile.role === 'admin' || user.email?.toLowerCase() === 'alibertendless999.ko@gmail.com') {
            try {
              const notifs = await fetchAdminNotifications();
              setUnreadAdminCount(notifs.filter(n => !n.read).length);
            } catch {
              // Graceful notification catch
            }
          }
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- States ---
  const [functions, setFunctions] = useState<FunctionConfig[]>([
    { id: '1', equation: 'x^2', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true, showInverse: false },
    { id: '2', equation: 'x + 2', color: '#ef4444', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true, showInverse: false },
  ]);

  const [activeTab, setActiveTab] = useState<'Graph' | 'Analysis' | 'Table' | 'Intersections' | 'Transform' | 'Examples' | 'Saved'>('Graph');
  const [commandInput, setCommandInput] = useState('');
  const [editingFunctionId, setEditingFunctionId] = useState<string | null>('1');
  const [intersections, setIntersections] = useState<IntersectionPoint[]>([]);
  const [viewportDomain, setViewportDomain] = useState<[number, number]>(DEFAULT_VIEWPORT_DOMAIN);
  const [viewportRange, setViewportRange] = useState<[number, number]>(DEFAULT_VIEWPORT_RANGE);
  const [isExporting, setIsExporting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [cartesianType, setCartesianType] = useState('Cartesian');
  const [gridStyle, setGridStyle] = useState<'Cartesian' | 'Polar' | 'Isometric' | 'Blank'>('Cartesian');
  const [angleUnit, setAngleUnit] = useState<'radians' | 'degrees'>('radians');
  const [decimalPrecision, setDecimalPrecision] = useState<number>(2);
  const [showAxisLabels, setShowAxisLabels] = useState<boolean>(true);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [helpActiveTab, setHelpActiveTab] = useState<'syntax' | 'tools' | 'calculus' | 'export'>('syntax');
  const [activeGraphTool, setActiveGraphTool] = useState<'select' | 'pan' | 'zoomIn' | 'zoomOut' | 'fit' | 'center'>('select');
  const [isGridLocked, setIsGridLocked] = useState(false);
  const [zoomPercent, setZoomPercent] = useState<number>(DEFAULT_ZOOM_PERCENT);
  // --- Quick Actions & Pins State ---
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [placedPins, setPlacedPins] = useState<{ id: string; x: number; y: number; label: string }[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [integralClickMode, setIntegralClickMode] = useState<'auto' | 'a' | 'b'>('auto');
  const [integralMethodTab, setIntegralMethodTab] = useState<'simpson' | 'trapezoid' | 'midpoint' | 'left' | 'right'>('simpson');

  // --- Geometric Drawing & Shapes State ---
  const [drawnShapes, setDrawnShapes] = useState<CustomShape[]>([]);
  const [drawingLineMode, setDrawingLineMode] = useState<LineMode>('segment');
  const [drawingSemiOrientation, setDrawingSemiOrientation] = useState<SemicircleOrientation>('top');
  const [drawingPoints, setDrawingPoints] = useState<Point2D[]>([]);
  const [drawingColor, setDrawingColor] = useState<string>('#3b82f6');
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState<number>(2.5);
  const [drawingStyle, setDrawingStyle] = useState<'solid' | 'dashed'>('solid');
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isShapesPanelOpen, setIsShapesPanelOpen] = useState<boolean>(true);

  // --- Undo / Redo History Engine ---
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);
  const historyPastRef = useRef<HistorySnapshot[]>([]);
  const historyFutureRef = useRef<HistorySnapshot[]>([]);

  // Synchronized state refs to prevent stale closure issues in callbacks
  const functionsRef = useRef<FunctionConfig[]>(functions);
  functionsRef.current = functions;
  const placedPinsRef = useRef<{ id: string; x: number; y: number; label: string }[]>(placedPins);
  placedPinsRef.current = placedPins;
  const drawnShapesRef = useRef<CustomShape[]>(drawnShapes);
  drawnShapesRef.current = drawnShapes;
  const drawingLineModeRef = useRef<LineMode>(drawingLineMode);
  drawingLineModeRef.current = drawingLineMode;
  const drawingSemiOrientationRef = useRef<SemicircleOrientation>(drawingSemiOrientation);
  drawingSemiOrientationRef.current = drawingSemiOrientation;
  const drawingPointsRef = useRef<Point2D[]>(drawingPoints);
  drawingPointsRef.current = drawingPoints;
  const drawingColorRef = useRef<string>(drawingColor);
  drawingColorRef.current = drawingColor;
  const drawingStrokeWidthRef = useRef<number>(drawingStrokeWidth);
  drawingStrokeWidthRef.current = drawingStrokeWidth;
  const drawingStyleRef = useRef<'solid' | 'dashed'>(drawingStyle);
  drawingStyleRef.current = drawingStyle;
  const activeQuickActionRef = useRef<string | null>(activeQuickAction);
  activeQuickActionRef.current = activeQuickAction;
  const isDarkModeRef = useRef<boolean>(isDarkMode);
  isDarkModeRef.current = isDarkMode;
  const editingFunctionIdRef = useRef<string | null>(editingFunctionId);
  editingFunctionIdRef.current = editingFunctionId;
  const gridStyleRef = useRef<'Cartesian' | 'Polar' | 'Isometric' | 'Blank'>(gridStyle);
  gridStyleRef.current = gridStyle;
  const angleUnitRef = useRef<'radians' | 'degrees'>(angleUnit);
  angleUnitRef.current = angleUnit;
  const decimalPrecisionRef = useRef<number>(decimalPrecision);
  decimalPrecisionRef.current = decimalPrecision;

  const typingInitialSnapshotRef = useRef<HistorySnapshot | null>(null);
  const typingDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getCurrentSnapshot = (): HistorySnapshot => ({
    functions: JSON.parse(JSON.stringify(functionsRef.current)),
    placedPins: JSON.parse(JSON.stringify(placedPinsRef.current)),
    drawnShapes: JSON.parse(JSON.stringify(drawnShapesRef.current)),
    editingFunctionId: editingFunctionIdRef.current,
    gridStyle: gridStyleRef.current,
    angleUnit: angleUnitRef.current,
    decimalPrecision: decimalPrecisionRef.current,
  });

  const recordHistory = (customSnapshot?: HistorySnapshot) => {
    const snapToPush = customSnapshot || getCurrentSnapshot();
    const snapJson = JSON.stringify(snapToPush);

    const lastSnap = historyPastRef.current[historyPastRef.current.length - 1];
    if (lastSnap && JSON.stringify(lastSnap) === snapJson) {
      return;
    }

    const newPast = [...historyPastRef.current.slice(-49), snapToPush];
    historyPastRef.current = newPast;
    historyFutureRef.current = [];
    setHistoryPast(newPast);
    setHistoryFuture([]);
  };

  const handleUndo = () => {
    // If there is an in-flight equation typing session, commit its pre-edit state first
    if (typingInitialSnapshotRef.current) {
      const initJson = JSON.stringify(typingInitialSnapshotRef.current);
      const curJson = JSON.stringify(getCurrentSnapshot());
      if (initJson !== curJson) {
        historyPastRef.current = [...historyPastRef.current.slice(-49), typingInitialSnapshotRef.current];
      }
      typingInitialSnapshotRef.current = null;
    }

    if (historyPastRef.current.length === 0) return;

    const current = getCurrentSnapshot();
    const targetSnapshot = historyPastRef.current[historyPastRef.current.length - 1];
    const newPast = historyPastRef.current.slice(0, -1);
    const newFuture = [current, ...historyFutureRef.current.slice(0, 49)];

    historyPastRef.current = newPast;
    historyFutureRef.current = newFuture;
    setHistoryPast(newPast);
    setHistoryFuture(newFuture);

    // Apply snapshot to React states
    setFunctions(JSON.parse(JSON.stringify(targetSnapshot.functions)));
    setPlacedPins(JSON.parse(JSON.stringify(targetSnapshot.placedPins)));
    setDrawnShapes(targetSnapshot.drawnShapes ? JSON.parse(JSON.stringify(targetSnapshot.drawnShapes)) : []);
    setEditingFunctionId(targetSnapshot.editingFunctionId);
    setGridStyle(targetSnapshot.gridStyle);
    setAngleUnit(targetSnapshot.angleUnit);
    setDecimalPrecision(targetSnapshot.decimalPrecision);

    showToast('Undid action');
  };

  const handleRedo = () => {
    if (historyFutureRef.current.length === 0) return;

    const current = getCurrentSnapshot();
    const targetSnapshot = historyFutureRef.current[0];
    const newFuture = historyFutureRef.current.slice(1);
    const newPast = [...historyPastRef.current.slice(-49), current];

    historyPastRef.current = newPast;
    historyFutureRef.current = newFuture;
    setHistoryPast(newPast);
    setHistoryFuture(newFuture);

    // Apply snapshot to React states
    setFunctions(JSON.parse(JSON.stringify(targetSnapshot.functions)));
    setPlacedPins(JSON.parse(JSON.stringify(targetSnapshot.placedPins)));
    setDrawnShapes(targetSnapshot.drawnShapes ? JSON.parse(JSON.stringify(targetSnapshot.drawnShapes)) : []);
    setEditingFunctionId(targetSnapshot.editingFunctionId);
    setGridStyle(targetSnapshot.gridStyle);
    setAngleUnit(targetSnapshot.angleUnit);
    setDecimalPrecision(targetSnapshot.decimalPrecision);

    showToast('Redid action');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleQuickAction = (actionId: string) => {
    if (activeQuickAction === actionId) {
      setActiveQuickAction(null);
      return;
    }

    setActiveQuickAction(actionId);

    if (actionId === 'intersect') {
      const visibleFns = functions.filter(f => f.visible);
      if (visibleFns.length >= 2) {
        const pts = findIntersections(visibleFns[0].equation, visibleFns[1].equation, viewportDomain);
        if (pts.length > 0) {
          const xs = pts.map(p => p.x);
          const ys = pts.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const marginX = Math.max((maxX - minX) * 0.6, 3);
          const marginY = Math.max((maxY - minY) * 0.6, 3);

          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          setViewportDomain([centerX - marginX, centerX + marginX]);
          setViewportRange([centerY - marginY, centerY + marginY]);
          showToast(`Found ${pts.length} intersection points`);
        } else {
          showToast('No intersection points in view range');
        }
      } else {
        showToast('Need at least 2 visible functions for intersections');
      }
    } else if (actionId === 'integral') {
      const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
      if (targetId) {
        recordHistory();
        setFunctions(prev => prev.map(f => f.id === targetId ? {
          ...f,
          showIntegral: true,
          integralLower: f.integralLower !== undefined ? f.integralLower : 0,
          integralUpper: f.integralUpper !== undefined ? f.integralUpper : 2,
          integralSubdivisions: f.integralSubdivisions || 50
        } : f));
        showToast('Definite Integral Tool Active — click graph or adjust [a, b] bounds');
      } else {
        showToast('Please select or add a visible function to integrate');
      }
    } else if (actionId === 'tangent') {
      const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
      if (targetId) {
        recordHistory();
        setFunctions(prev => prev.map(f => f.id === targetId ? { ...f, showTangent: true, tangentPoint: f.tangentPoint ?? 0 } : f));
        showToast('Tangent Inspector Mode — click curve to move x₀');
      } else {
        showToast('Please add a function to calculate tangents');
      }
    } else if (actionId === 'inverse') {
      const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
      if (targetId) {
        recordHistory();
        setFunctions(prev => prev.map(f => f.id === targetId ? { ...f, showInverse: !f.showInverse } : f));
        showToast('Inverse Function Inspector Active — symmetry line y = x enabled');
      } else {
        showToast('Please select or add a visible function to invert');
      }
    } else if (actionId === 'point') {
      showToast('Point Inspector Active — Click on graph canvas to drop pins');
    } else if (actionId === 'line') {
      setDrawingPoints([]);
      showToast('Add Line Active — Click point 1 anywhere on any quadrant to begin');
    } else if (actionId === 'circle') {
      setDrawingPoints([]);
      showToast('Add Circle Active — Click graph canvas to place circle center (h, k)');
    } else if (actionId === 'semicircle') {
      setDrawingPoints([]);
      showToast('Add Semi-Circle Active — Click graph canvas to place center');
    } else if (actionId === 'reset') {
      recordHistory();
      handleResetZoom();
      setPlacedPins([]);
      setActiveQuickAction(null);
      showToast('Graph view & placed pins reset');
    }
  };

  // Transform parameters
  const [transformA, setTransformA] = useState(1);
  const [transformB, setTransformB] = useState(1);
  const [transformC, setTransformC] = useState(0);
  const [transformD, setTransformD] = useState(0);

  // Table parameters
  const [tableMinX, setTableMinX] = useState(-5);
  const [tableMaxX, setTableMaxX] = useState(5);
  const [tableStep, setTableStep] = useState(1);

  // Analysis & Preset state
  const [evalX, setEvalX] = useState<number>(0);
  const [newPresetName, setNewPresetName] = useState<string>('');

  // Saved presets
  const [savedPresets, setSavedPresets] = useState<{ id: string; name: string; funcs: FunctionConfig[] }[]>(() => {
    try {
      const local = localStorage.getItem('graphing_calc_saved_presets');
      if (local) return JSON.parse(local);
    } catch {}
    return [
      {
        id: 'p1',
        name: 'Parabola & Line Intersection',
        funcs: [
          { id: '1', equation: 'x^2', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
          { id: '2', equation: 'x + 2', color: '#ef4444', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: true },
        ]
      },
      {
        id: 'p2',
        name: 'Trigonometric Resonance',
        funcs: [
          { id: '1', equation: 'sin(x)', color: '#3b82f6', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: false },
          { id: '2', equation: 'cos(x)', color: '#a855f7', visible: true, style: 'solid', strokeWidth: 2.5, showDerivative: false, showTangent: false, tangentPoint: 0, showExtrema: false },
        ]
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('graphing_calc_saved_presets', JSON.stringify(savedPresets));
    } catch {}
  }, [savedPresets]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Math Helpers ---
  const evaluateFunction = (expr: string, x: number): number | null => {
    try {
      let scope: Record<string, any> = { 
        x, 
        e: Math.E, 
        E: Math.E, 
        pi: Math.PI, 
        PI: Math.PI,
        ln: (val: number) => Math.log(val),
        log10: (val: number) => Math.log10(val),
        log2: (val: number) => Math.log2(val),
        cbrt: (val: number) => Math.cbrt(val),
        sqrt: (val: number) => Math.sqrt(val),
        abs: (val: number) => Math.abs(val),
        exp: (val: number) => Math.exp(val)
      };
      if (angleUnit === 'degrees') {
        scope = {
          ...scope,
          sin: (val: number) => Math.sin((val * Math.PI) / 180),
          cos: (val: number) => Math.cos((val * Math.PI) / 180),
          tan: (val: number) => Math.tan((val * Math.PI) / 180),
          asin: (val: number) => (Math.asin(val) * 180) / Math.PI,
          acos: (val: number) => (Math.acos(val) * 180) / Math.PI,
          atan: (val: number) => (Math.atan(val) * 180) / Math.PI,
          arcsin: (val: number) => (Math.asin(val) * 180) / Math.PI,
          arccos: (val: number) => (Math.acos(val) * 180) / Math.PI,
          arctan: (val: number) => (Math.atan(val) * 180) / Math.PI,
        };
      }
      const result = math.evaluate(expr, scope);
      return typeof result === 'number' && isFinite(result) && !isNaN(result) ? result : null;
    } catch {
      return null;
    }
  };

  const getDerivative = (expr: string, x: number): number | null => {
    try {
      const derivativeExpr = math.derivative(expr, 'x');
      let scope: Record<string, any> = { 
        x, 
        e: Math.E, 
        E: Math.E, 
        pi: Math.PI, 
        PI: Math.PI,
        ln: (val: number) => Math.log(val),
        cbrt: (val: number) => Math.cbrt(val),
        sqrt: (val: number) => Math.sqrt(val),
        abs: (val: number) => Math.abs(val),
        exp: (val: number) => Math.exp(val)
      };
      if (angleUnit === 'degrees') {
        scope = {
          ...scope,
          sin: (val: number) => Math.sin((val * Math.PI) / 180),
          cos: (val: number) => Math.cos((val * Math.PI) / 180),
          tan: (val: number) => Math.tan((val * Math.PI) / 180),
        };
      }
      const result = derivativeExpr.evaluate(scope);
      if (typeof result === 'number' && isFinite(result) && !isNaN(result)) {
        return result;
      }
    } catch {
      // fallback to numerical differentiation
    }
    // High-precision numerical central difference fallback
    const h = 1e-5;
    const yPlus = evaluateFunction(expr, x + h);
    const yMinus = evaluateFunction(expr, x - h);
    if (yPlus !== null && yMinus !== null) {
      const numDeriv = (yPlus - yMinus) / (2 * h);
      return isFinite(numDeriv) && !isNaN(numDeriv) ? numDeriv : null;
    }
    return null;
  };

  // --- Intersection Finder ---
  const findIntersections = (f1: string, f2: string, xRange: [number, number]) => {
    const points: IntersectionPoint[] = [];
    const steps = 300;
    const dx = (xRange[1] - xRange[0]) / steps;
    
    for (let i = 0; i < steps; i++) {
      const x1 = xRange[0] + i * dx;
      const x2 = x1 + dx;
      
      const y1_f1 = evaluateFunction(f1, x1);
      const y1_f2 = evaluateFunction(f2, x1);
      const y2_f1 = evaluateFunction(f1, x2);
      const y2_f2 = evaluateFunction(f2, x2);

      if (y1_f1 !== null && y1_f2 !== null && y2_f1 !== null && y2_f2 !== null) {
        const diff1 = y1_f1 - y1_f2;
        const diff2 = y2_f1 - y2_f2;

        if (diff1 * diff2 <= 0) {
          let low = x1, high = x2;
          for (let j = 0; j < 15; j++) {
            const mid = (low + high) / 2;
            const dMid = (evaluateFunction(f1, mid) || 0) - (evaluateFunction(f2, mid) || 0);
            if (((evaluateFunction(f1, low) || 0) - (evaluateFunction(f2, low) || 0)) * dMid <= 0) {
              high = mid;
            } else {
              low = mid;
            }
          }
          const finalX = (low + high) / 2;
          const finalY = evaluateFunction(f1, finalX);
          if (finalY !== null && !points.some(p => Math.abs(p.x - finalX) < 0.05)) {
            points.push({ x: finalX, y: finalY, label: `P${points.length + 1}` });
          }
        }
      }
    }
    return points;
  };

  const findExtrema = (expr: string, xRange: [number, number]) => {
    const points: { x: number; y: number; type: 'max' | 'min' }[] = [];
    const steps = 400;
    const dx = (xRange[1] - xRange[0]) / steps;
    
    for (let i = 1; i < steps; i++) {
      const xPrev = xRange[0] + (i - 1) * dx;
      const xCurr = xRange[0] + i * dx;
      const xNext = xRange[0] + (i + 1) * dx;
      
      const yPrev = evaluateFunction(expr, xPrev);
      const yCurr = evaluateFunction(expr, xCurr);
      const yNext = evaluateFunction(expr, xNext);

      if (yPrev !== null && yCurr !== null && yNext !== null) {
        if (yCurr > yPrev && yCurr > yNext) {
          points.push({ x: xCurr, y: yCurr, type: 'max' });
        } else if (yCurr < yPrev && yCurr < yNext) {
          points.push({ x: xCurr, y: yCurr, type: 'min' });
        }
      }
    }
    return points;
  };

  const findRoots = (expr: string, xRange: [number, number]) => {
    const roots: number[] = [];
    const steps = 300;
    const dx = (xRange[1] - xRange[0]) / steps;
    for (let i = 0; i < steps; i++) {
      const x1 = xRange[0] + i * dx;
      const x2 = x1 + dx;
      const y1 = evaluateFunction(expr, x1);
      const y2 = evaluateFunction(expr, x2);
      if (y1 !== null && y2 !== null && y1 * y2 <= 0) {
        let low = x1, high = x2;
        for (let j = 0; j < 15; j++) {
          const mid = (low + high) / 2;
          const yMid = evaluateFunction(expr, mid) || 0;
          if ((evaluateFunction(expr, low) || 0) * yMid <= 0) {
            high = mid;
          } else {
            low = mid;
          }
        }
        const rootX = (low + high) / 2;
        if (!roots.some(r => Math.abs(r - rootX) < 0.05)) {
          roots.push(rootX);
        }
      }
    }
    return roots;
  };

  // --- Handlers for Functions Management with History Integration ---
  const handleAddFunction = () => {
    recordHistory();
    const nextColor = COLORS[functions.length % COLORS.length];
    const newFn: FunctionConfig = {
      id: Date.now().toString(),
      equation: 'x',
      color: nextColor,
      visible: true,
      style: 'solid',
      strokeWidth: 2.5,
      showDerivative: false,
      showTangent: false,
      tangentPoint: 0,
      showExtrema: false,
      showInverse: false
    };
    setFunctions(prev => [...prev, newFn]);
    setEditingFunctionId(newFn.id);
  };

  const handleDuplicateFunction = (id: string) => {
    const fnToDup = functions.find(f => f.id === id);
    if (!fnToDup) return;
    recordHistory();
    const nextColor = COLORS[functions.length % COLORS.length];
    const newFn: FunctionConfig = {
      ...JSON.parse(JSON.stringify(fnToDup)),
      id: Date.now().toString(),
      color: nextColor,
    };
    setFunctions(prev => [...prev, newFn]);
    setEditingFunctionId(newFn.id);
    showToast(`Duplicated ${fnToDup.equation}`);
  };

  const handleClearAllFunctions = () => {
    if (functions.length === 0) return;
    recordHistory();
    setFunctions([]);
    setEditingFunctionId(null);
    showToast('Cleared all functions (Undoable)');
  };

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    recordHistory();
    if (editingFunctionId) {
      updateFunction(editingFunctionId, { equation: commandInput.trim() }, true);
    } else {
      const nextColor = COLORS[functions.length % COLORS.length];
      const newFn: FunctionConfig = {
        id: Date.now().toString(),
        equation: commandInput.trim(),
        color: nextColor,
        visible: true,
        style: 'solid',
        strokeWidth: 2.5,
        showDerivative: false,
        showTangent: false,
        tangentPoint: 0,
        showExtrema: false,
        showInverse: false
      };
      setFunctions(prev => [...prev, newFn]);
      setEditingFunctionId(newFn.id);
    }
    setCommandInput('');
  };

  const updateFunction = (id: string, updates: Partial<FunctionConfig>, isTyping = false) => {
    if (!isTyping) {
      recordHistory();
    }
    setFunctions(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleEquationChange = (id: string, newEq: string) => {
    if (!typingInitialSnapshotRef.current) {
      typingInitialSnapshotRef.current = getCurrentSnapshot();
    }
    updateFunction(id, { equation: newEq }, true);

    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
    }
    typingDebounceTimerRef.current = setTimeout(() => {
      if (typingInitialSnapshotRef.current) {
        const snapJson = JSON.stringify(typingInitialSnapshotRef.current);
        const curJson = JSON.stringify(getCurrentSnapshot());
        if (snapJson !== curJson) {
          recordHistory(typingInitialSnapshotRef.current);
          typingInitialSnapshotRef.current = getCurrentSnapshot();
        }
      }
    }, 500);
  };

  const handleEquationBlur = () => {
    if (typingDebounceTimerRef.current) {
      clearTimeout(typingDebounceTimerRef.current);
    }
    if (typingInitialSnapshotRef.current) {
      const snapJson = JSON.stringify(typingInitialSnapshotRef.current);
      const curJson = JSON.stringify(getCurrentSnapshot());
      if (snapJson !== curJson) {
        recordHistory(typingInitialSnapshotRef.current);
      }
      typingInitialSnapshotRef.current = null;
    }
  };

  const removeFunction = (id: string) => {
    recordHistory();
    setFunctions(prev => prev.filter(f => f.id !== id));
    if (editingFunctionId === id) {
      setEditingFunctionId(functions.find(f => f.id !== id)?.id || null);
    }
  };

  const appendSmartInput = (symbol: string) => {
    if (!editingFunctionId) return;
    const targetFn = functions.find(f => f.id === editingFunctionId);
    if (!targetFn) return;
    recordHistory();
    let newEq = targetFn.equation;
    if (newEq === '0' || newEq === '') {
      newEq = symbol;
    } else {
      newEq += symbol;
    }
    updateFunction(editingFunctionId, { equation: newEq }, true);
  };

  // --- Export Handlers ---
  const applyExportStylesProxy = () => {
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt, pseudoElt) {
      const originalStyle = originalGetComputedStyle.call(window, elt, pseudoElt);
      return new Proxy(originalStyle, {
        get(target, prop) {
          if (prop === 'backdropFilter' || prop === 'WebkitBackdropFilter') {
            return 'none';
          }
          const value = Reflect.get(target, prop);
          if (prop === 'getPropertyValue') {
            return (propertyName: string) => {
              if (propertyName === 'backdrop-filter' || propertyName === '-webkit-backdrop-filter') {
                return 'none';
              }
              const raw = target.getPropertyValue(propertyName);
              return convertCssValueToRgb(raw);
            };
          }
          if (typeof value === 'function') return value.bind(target);
          if (typeof prop === 'string' && typeof value === 'string') {
            return convertCssValueToRgb(value);
          }
          return value;
        }
      });
    };
    return () => {
      window.getComputedStyle = originalGetComputedStyle;
    };
  };

  const [exportHideControls, setExportHideControls] = useState(true);

  const getHtml2CanvasOptions = () => ({
    scale: 2,
    useCORS: true,
    backgroundColor: '#090b17',
    ignoreElements: (element: Element) => {
      if (element.hasAttribute('data-export-hide')) {
        return true;
      }
      return false;
    },
    onclone: (clonedDoc: Document) => {
      // Unconditionally hide all toolbars, panels, buttons, and controls during export
      const hideElements = clonedDoc.querySelectorAll('[data-export-hide="true"]');
      hideElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });

      // 1. Sanitize all <style> tags in the cloned document
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach(tag => {
        if (tag.textContent) {
          let cssText = tag.textContent;
          cssText = cssText.replace(/backdrop-filter\s*:[^;}]+/gi, 'backdrop-filter: none !important');
          cssText = cssText.replace(/-webkit-backdrop-filter\s*:[^;}]+/gi, '-webkit-backdrop-filter: none !important');
          cssText = convertCssValueToRgb(cssText);
          tag.textContent = cssText;
        }
      });

      // 2. Sanitize all elements in clonedDoc
      const allElements = clonedDoc.querySelectorAll('*');
      allElements.forEach((el) => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          if (el instanceof HTMLElement) {
            el.style.backdropFilter = 'none';
            (el.style as any).webkitBackdropFilter = 'none';
          }

          const inlineStyle = el.getAttribute('style');
          if (inlineStyle) {
            let newInline = inlineStyle
              .replace(/backdrop-filter\s*:[^;]+/gi, 'backdrop-filter: none')
              .replace(/-webkit-backdrop-filter\s*:[^;]+/gi, '-webkit-backdrop-filter: none');
            newInline = convertCssValueToRgb(newInline);
            el.setAttribute('style', newInline);
          }

          ['fill', 'stroke', 'stop-color', 'color'].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
              el.setAttribute(attr, convertCssValueToRgb(val));
            }
          });
        }
      });
    }
  });

  const exportToPDF = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);

    const restoreStyles = applyExportStylesProxy();

    try {
      const canvas = await html2canvas(containerRef.current, getHtml2CanvasOptions());
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('linecraft-visualization.pdf');
      showToast('Exported PDF successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('PDF export failed');
    } finally {
      restoreStyles();
      setIsExporting(false);
    }
  };

  const exportToPNG = async () => {
    if (!containerRef.current) return;
    setIsExporting(true);
    setExportMenuOpen(false);

    const restoreStyles = applyExportStylesProxy();

    try {
      const canvas = await html2canvas(containerRef.current, getHtml2CanvasOptions());
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = 'linecraft-graph.png';
      link.click();
      showToast('Exported PNG successfully');
    } catch (err) {
      console.error(err);
      showToast('PNG export failed');
    } finally {
      restoreStyles();
      setIsExporting(false);
    }
  };

  const exportToSVG = () => {
    if (!svgRef.current) return;
    setExportMenuOpen(false);
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'linecraft-vector.svg';
    link.click();
  };

  // --- D3 Rendering Effect ---
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 800;
    const height = svgRef.current.clientHeight || 600;

    const margin = { top: 30, right: 30, bottom: 30, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // High-contrast Dark Scales
    let xScale = d3.scaleLinear().domain(viewportDomain).range([0, chartWidth]);
    let yScale = d3.scaleLinear().domain(viewportRange).range([chartHeight, 0]);

    // Groups
    const gridGroup = g.append('g').attr('class', 'grid');
    const axisGroup = g.append('g').attr('class', 'axis');
    const graphGroup = g.append('g').attr('class', 'graphs');
    const overlayGroup = g.append('g').attr('class', 'overlay');

    const draw = () => {
      gridGroup.selectAll('*').remove();
      axisGroup.selectAll('*').remove();
      graphGroup.selectAll('*').remove();
      overlayGroup.selectAll('*').remove();

      const xDomain = xScale.domain() as [number, number];
      const yDomain = yScale.domain() as [number, number];

      const xRangeVal = xDomain[1] - xDomain[0];
      const step = xRangeVal > 20 ? 2 : xRangeVal > 10 ? 1 : xRangeVal > 5 ? 0.5 : 0.2;

      const xTicksMajor = d3.range(Math.floor(xDomain[0] / step) * step, Math.ceil(xDomain[1] / step) * step + step, step);
      const yTicksMajor = d3.range(Math.floor(yDomain[0] / step) * step, Math.ceil(yDomain[1] / step) * step + step, step);

      // Theme colors
      const gridStroke = isDarkMode ? '#1e243d' : '#e2e8f0';
      const axisStroke = isDarkMode ? '#64748b' : '#475569';
      const axisTextFill = isDarkMode ? '#94a3b8' : '#334155';

      // --- Draw Grid Lines ---
      if (showGridLines) {
        if (gridStyle === 'Polar') {
          const maxR = Math.max(chartWidth, chartHeight);
          const numRings = 10;
          const originX = xScale(0);
          const originY = yScale(0);

          for (let r = 1; r <= numRings; r++) {
            const radius = (maxR / numRings) * r;
            gridGroup.append('circle')
              .attr('cx', originX).attr('cy', originY)
              .attr('r', radius)
              .attr('fill', 'none')
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }

          for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const x2 = originX + Math.cos(rad) * maxR;
            const y2 = originY + Math.sin(rad) * maxR;
            gridGroup.append('line')
              .attr('x1', originX).attr('y1', originY)
              .attr('x2', x2).attr('y2', y2)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }
        } else if (gridStyle === 'Isometric') {
          const stepPx = 40;
          for (let x = -chartHeight; x < chartWidth + chartHeight; x += stepPx) {
            gridGroup.append('line')
              .attr('x1', x).attr('y1', 0)
              .attr('x2', x + chartHeight * 0.577).attr('y2', chartHeight)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');

            gridGroup.append('line')
              .attr('x1', x).attr('y1', chartHeight)
              .attr('x2', x + chartHeight * 0.577).attr('y2', 0)
              .attr('stroke', gridStroke)
              .attr('stroke-width', 0.8)
              .attr('stroke-dasharray', '2,2');
          }
        } else if (gridStyle === 'Cartesian') {
          gridGroup.selectAll('.x-grid')
            .data(xTicksMajor)
            .enter().append('line')
            .attr('class', 'x-grid')
            .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
            .attr('y1', 0).attr('y2', chartHeight)
            .attr('stroke', gridStroke)
            .attr('stroke-width', d => Math.abs(d) < 0.001 ? 0 : 0.8)
            .attr('stroke-dasharray', '2,2');

          gridGroup.selectAll('.y-grid')
            .data(yTicksMajor)
            .enter().append('line')
            .attr('class', 'y-grid')
            .attr('y1', d => yScale(d)).attr('y2', d => yScale(d))
            .attr('x1', 0).attr('x2', chartWidth)
            .attr('stroke', gridStroke)
            .attr('stroke-width', d => Math.abs(d) < 0.001 ? 0 : 0.8)
            .attr('stroke-dasharray', '2,2');
        }
      }

      // --- Draw Axes ---
      const originX = xScale(0);
      const originY = yScale(0);

      // X Axis
      if (originY >= 0 && originY <= chartHeight) {
        axisGroup.append('line')
          .attr('x1', 0).attr('x2', chartWidth)
          .attr('y1', originY).attr('y2', originY)
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        axisGroup.append('path')
          .attr('d', `M${chartWidth - 6},${originY - 4} L${chartWidth},${originY} L${chartWidth - 6},${originY + 4}`)
          .attr('fill', 'none')
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        if (showAxisLabels) {
          axisGroup.append('text')
            .attr('x', chartWidth + 10)
            .attr('y', originY + 4)
            .attr('fill', axisTextFill)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('x');
        }
      }

      // Y Axis
      if (originX >= 0 && originX <= chartWidth) {
        axisGroup.append('line')
          .attr('x1', originX).attr('x2', originX)
          .attr('y1', 0).attr('y2', chartHeight)
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        axisGroup.append('path')
          .attr('d', `M${originX - 4},6 L${originX},0 L${originX + 4},6`)
          .attr('fill', 'none')
          .attr('stroke', axisStroke)
          .attr('stroke-width', 1.5);

        if (showAxisLabels) {
          axisGroup.append('text')
            .attr('x', originX + 10)
            .attr('y', 10)
            .attr('fill', axisTextFill)
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text('y');
        }
      }

      // Axis Ticks & Labels
      if (showAxisLabels) {
        axisGroup.selectAll('.x-tick-label')
          .data(xTicksMajor.filter(d => Math.abs(d) > 0.001))
          .enter().append('text')
          .attr('class', 'x-tick-label')
          .attr('x', d => xScale(d))
          .attr('y', Math.min(Math.max(originY + 16, 16), chartHeight - 6))
          .attr('text-anchor', 'middle')
          .attr('fill', axisTextFill)
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(d => Number.isInteger(d) ? d : d.toFixed(decimalPrecision));

        axisGroup.selectAll('.y-tick-label')
          .data(yTicksMajor.filter(d => Math.abs(d) > 0.001))
          .enter().append('text')
          .attr('class', 'y-tick-label')
          .attr('x', Math.min(Math.max(originX - 10, 20), chartWidth - 10))
          .attr('y', d => yScale(d) + 3)
          .attr('text-anchor', 'end')
          .attr('fill', axisTextFill)
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(d => Number.isInteger(d) ? d : d.toFixed(decimalPrecision));
      }

      // --- Plot Diagonal Line of Symmetry y = x (when any inverse is active) ---
      const hasActiveInverse = functions.some(f => f.visible && f.showInverse) || activeQuickAction === 'inverse';
      if (hasActiveInverse) {
        const minVal = Math.max(-100, Math.min(xDomain[0], yDomain[0]) - 2);
        const maxVal = Math.min(100, Math.max(xDomain[1], yDomain[1]) + 2);
        const diagPoints: [number, number][] = [
          [xScale(minVal), yScale(minVal)],
          [xScale(maxVal), yScale(maxVal)]
        ];

        graphGroup.append('path')
          .datum(diagPoints)
          .attr('fill', 'none')
          .attr('stroke', isDarkMode ? '#818cf8' : '#6366f1')
          .attr('stroke-width', 1.8)
          .attr('stroke-dasharray', '5,5')
          .attr('opacity', 0.8)
          .attr('d', d3.line());

        // Label on the y = x line
        const labelVal = Math.min(xDomain[1] - 0.8, yDomain[1] - 0.8);
        if (labelVal >= Math.max(xDomain[0], yDomain[0])) {
          const lx = xScale(labelVal);
          const ly = yScale(labelVal);
          if (lx >= 20 && lx <= chartWidth - 20 && ly >= 20 && ly <= chartHeight - 20) {
            overlayGroup.append('text')
              .attr('x', lx - 10)
              .attr('y', ly - 10)
              .attr('fill', isDarkMode ? '#a5b4fc' : '#4f46e5')
              .attr('font-size', '10px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .attr('text-anchor', 'end')
              .text('y = x (Symmetry Axis)');
          }
        }
      }

      // --- Plot Glowing Function Curves ---
      functions.filter(f => f.visible).forEach(f => {
        let points: [number, number][] = [];
        const samples = 1200;
        const startX = Math.max(-100, xDomain[0]);
        const endX = Math.min(100, xDomain[1]);

        if (startX < endX) {
          const dx = (endX - startX) / samples;

          for (let i = 0; i <= samples; i++) {
            const x = startX + i * dx;
            const y = evaluateFunction(f.equation, x);
            if (y !== null && !isNaN(y) && isFinite(y) && y >= -100 && y <= 100) {
              points.push([xScale(x), yScale(y)]);
            } else {
              if (points.length > 0) {
                renderPath(points, f.color, f.style, f.strokeWidth);
                points = [];
              }
            }
          }
          if (points.length > 0) {
            renderPath(points, f.color, f.style, f.strokeWidth);
          }
        }

        // Reflected Inverse Curve (f⁻¹ reflected across y = x)
        if (f.showInverse) {
          let invPoints: [number, number][] = [];
          const invSamples = 1200;
          const startT = Math.max(-100, Math.min(xDomain[0], yDomain[0]) - 5);
          const endT = Math.min(100, Math.max(xDomain[1], yDomain[1]) + 5);

          if (startT < endT) {
            const dt = (endT - startT) / invSamples;

            for (let i = 0; i <= invSamples; i++) {
              const t = startT + i * dt;
              const yVal = evaluateFunction(f.equation, t);
              if (yVal !== null && !isNaN(yVal) && isFinite(yVal) && yVal >= -100 && yVal <= 100) {
                // Parametric reflection across y = x gives point (yVal, t)
                invPoints.push([xScale(yVal), yScale(t)]);
              } else {
                if (invPoints.length > 0) {
                  const invLine = d3.line().x((d: any) => d[0]).y((d: any) => d[1]);
                  graphGroup.append('path')
                    .datum(invPoints)
                    .attr('fill', 'none')
                    .attr('stroke', f.color)
                    .attr('stroke-width', f.strokeWidth)
                    .attr('stroke-dasharray', '6,4')
                    .attr('opacity', 0.9)
                    .attr('d', invLine);
                  invPoints = [];
                }
              }
            }
            if (invPoints.length > 0) {
              const invLine = d3.line().x((d: any) => d[0]).y((d: any) => d[1]);
              graphGroup.append('path')
                .datum(invPoints)
                .attr('fill', 'none')
                .attr('stroke', f.color)
                .attr('stroke-width', f.strokeWidth)
                .attr('stroke-dasharray', '6,4')
                .attr('opacity', 0.9)
                .attr('d', invLine);
            }
          }
        }

        // Dedicated Derivative Curve f'(x) (Rendered with unique Cyan hue)
        if (f.showDerivative) {
          let derivPoints: [number, number][] = [];
          const derivSamples = 1200;
          const startX = Math.max(-100, xDomain[0]);
          const endX = Math.min(100, xDomain[1]);
          const derivColor = '#06b6d4'; // Unique vibrant cyan for derivative curve

          if (startX < endX) {
            const dx = (endX - startX) / derivSamples;

            for (let i = 0; i <= derivSamples; i++) {
              const x = startX + i * dx;
              const dy = getDerivative(f.equation, x);
              if (dy !== null && !isNaN(dy) && isFinite(dy) && dy >= -100 && dy <= 100) {
                derivPoints.push([xScale(x), yScale(dy)]);
              } else {
                if (derivPoints.length > 0) {
                  const derivLine = d3.line().x((d: any) => d[0]).y((d: any) => d[1]);
                  graphGroup.append('path')
                    .datum(derivPoints)
                    .attr('fill', 'none')
                    .attr('stroke', derivColor)
                    .attr('stroke-width', Math.max(1.8, f.strokeWidth - 0.5))
                    .attr('stroke-dasharray', '5,4')
                    .attr('opacity', 0.95)
                    .attr('class', 'glow-cyan')
                    .attr('d', derivLine);
                  derivPoints = [];
                }
              }
            }
            if (derivPoints.length > 0) {
              const derivLine = d3.line().x((d: any) => d[0]).y((d: any) => d[1]);
              graphGroup.append('path')
                .datum(derivPoints)
                .attr('fill', 'none')
                .attr('stroke', derivColor)
                .attr('stroke-width', Math.max(1.8, f.strokeWidth - 0.5))
                .attr('stroke-dasharray', '5,4')
                .attr('opacity', 0.95)
                .attr('class', 'glow-cyan')
                .attr('d', derivLine);
            }

            // Shaded Definite Integral for Derivative Curve (Demonstrating Fundamental Theorem of Calculus)
            if (f.showDerivativeIntegral) {
              const dLower = f.derivativeIntegralLower !== undefined ? f.derivativeIntegralLower : 0;
              const dUpper = f.derivativeIntegralUpper !== undefined ? f.derivativeIntegralUpper : 2;
              const dLeft = Math.min(dLower, dUpper);
              const dRight = Math.max(dLower, dUpper);

              const dAreaSamples = 350;
              const dStep = (dRight - dLeft) / dAreaSamples;
              const dAreaPoints: { x: number; y: number }[] = [];

              if (dStep > 0) {
                for (let i = 0; i <= dAreaSamples; i++) {
                  const x = dLeft + i * dStep;
                  const dy = getDerivative(f.equation, x);
                  if (dy !== null && !isNaN(dy) && isFinite(dy)) {
                    dAreaPoints.push({ x, y: dy });
                  }
                }

                if (dAreaPoints.length > 1) {
                  const dAreaGen = d3.area<{ x: number; y: number }>()
                    .x(d => xScale(d.x))
                    .y0(yScale(0))
                    .y1(d => yScale(d.y))
                    .curve(d3.curveLinear);

                  graphGroup.append('path')
                    .datum(dAreaPoints)
                    .attr('fill', derivColor)
                    .attr('fill-opacity', isDarkMode ? 0.32 : 0.25)
                    .attr('stroke', derivColor)
                    .attr('stroke-width', 1.25)
                    .attr('stroke-dasharray', '3,3')
                    .attr('opacity', 0.95)
                    .attr('d', dAreaGen);
                }

                // Boundary vertical lines & pin badges
                [
                  { xVal: dLower, label: 'a' },
                  { xVal: dUpper, label: 'b' }
                ].forEach(b => {
                  const dyB = getDerivative(f.equation, b.xVal);
                  const bx = xScale(b.xVal);
                  const by0 = yScale(0);
                  const by1 = dyB !== null && isFinite(dyB) ? yScale(dyB) : (isDarkMode ? 0 : chartHeight);

                  graphGroup.append('line')
                    .attr('x1', bx).attr('y1', by0)
                    .attr('x2', bx).attr('y2', by1)
                    .attr('stroke', derivColor)
                    .attr('stroke-width', 1.75)
                    .attr('stroke-dasharray', '3,3')
                    .attr('opacity', 0.95);

                  overlayGroup.append('circle')
                    .attr('cx', bx).attr('cy', by0)
                    .attr('r', 4.5)
                    .attr('fill', derivColor)
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 1.5);

                  if (dyB !== null && isFinite(dyB)) {
                    overlayGroup.append('circle')
                      .attr('cx', bx).attr('cy', by1)
                      .attr('r', 4)
                      .attr('fill', derivColor)
                      .attr('stroke', '#ffffff')
                      .attr('stroke-width', 1.5);
                  }
                });
              }
            }
          }
        }

        // Tangent Line
        if (f.showTangent) {
          const x0 = f.tangentPoint;
          const y0 = evaluateFunction(f.equation, x0);
          const m = getDerivative(f.equation, x0);
          if (y0 !== null && m !== null) {
            const tangentLine = (x: number) => m * (x - x0) + y0;
            const tPoints: [number, number][] = [
              [xScale(xDomain[0]), yScale(tangentLine(xDomain[0]))],
              [xScale(xDomain[1]), yScale(tangentLine(xDomain[1]))]
            ];
            graphGroup.append('path')
              .datum(tPoints)
              .attr('fill', 'none')
              .attr('stroke', '#f59e0b')
              .attr('stroke-width', 1.5)
              .attr('stroke-dasharray', '4,4')
              .attr('d', d3.line());
            
            overlayGroup.append('circle')
              .attr('cx', xScale(x0)).attr('cy', yScale(y0))
              .attr('r', 4).attr('fill', '#f59e0b').attr('class', 'glow-amber');
          }
        }

        // Extrema
        if (f.showExtrema) {
          const extrema = findExtrema(f.equation, xDomain);
          extrema.forEach(p => {
            overlayGroup.append('circle')
              .attr('cx', xScale(p.x)).attr('cy', yScale(p.y))
              .attr('r', 4.5)
              .attr('fill', '#a855f7')
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 1.5)
              .attr('class', 'glow-purple');
          });
        }

        // --- Definite Integral & Shaded Area Rendering ---
        const isIntegrating = f.showIntegral || (activeQuickAction === 'integral' && f.id === (editingFunctionId || functions.find(fn => fn.visible)?.id));
        if (isIntegrating) {
          const a = f.integralLower !== undefined ? f.integralLower : 0;
          const b = f.integralUpper !== undefined ? f.integralUpper : 2;
          const leftBound = Math.min(a, b);
          const rightBound = Math.max(a, b);

          const integralRes = computeDefiniteIntegral((x) => evaluateFunction(f.equation, x), a, b, f.integralSubdivisions || 50);

          // 1. Shaded Continuous Area Under Curve
          const areaSamples = 300;
          const areaPoints: { x: number; y: number }[] = [];
          const step = (rightBound - leftBound) / areaSamples;

          if (step > 0) {
            for (let i = 0; i <= areaSamples; i++) {
              const x = leftBound + i * step;
              const y = evaluateFunction(f.equation, x);
              if (y !== null && !isNaN(y) && isFinite(y)) {
                areaPoints.push({ x, y });
              }
            }

            if (areaPoints.length > 1) {
              const areaGenerator = d3.area<{ x: number; y: number }>()
                .x(d => xScale(d.x))
                .y0(yScale(0))
                .y1(d => yScale(d.y))
                .curve(d3.curveLinear);

              graphGroup.append('path')
                .datum(areaPoints)
                .attr('fill', f.color)
                .attr('fill-opacity', isDarkMode ? 0.32 : 0.26)
                .attr('stroke', f.color)
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '2,2')
                .attr('opacity', 0.95)
                .attr('d', areaGenerator);
            }
          }

          // 2. Riemann Partition Strips (if enabled)
          if (f.showRiemannStrips && rightBound > leftBound) {
            const numStrips = f.integralSubdivisions || 20;
            const stripDx = (rightBound - leftBound) / numStrips;
            for (let i = 0; i < numStrips; i++) {
              const sx0 = leftBound + i * stripDx;
              const sx1 = leftBound + (i + 1) * stripDx;
              const sMid = (sx0 + sx1) / 2;
              const sy = evaluateFunction(f.equation, sMid);
              if (sy !== null && isFinite(sy)) {
                const rx = xScale(sx0);
                const rw = Math.max(1, xScale(sx1) - rx);
                const ry = sy >= 0 ? yScale(sy) : yScale(0);
                const rh = Math.abs(yScale(sy) - yScale(0));

                graphGroup.append('rect')
                  .attr('x', rx)
                  .attr('y', ry)
                  .attr('width', rw)
                  .attr('height', rh)
                  .attr('fill', f.color)
                  .attr('fill-opacity', 0.16)
                  .attr('stroke', f.color)
                  .attr('stroke-width', 0.75)
                  .attr('stroke-opacity', 0.45);
              }
            }
          }

          // 3. Boundary Vertical Dashed Lines at x = a and x = b
          const yA = evaluateFunction(f.equation, a);
          const yB = evaluateFunction(f.equation, b);

          [
            { xVal: a, yVal: yA, label: 'a', color: '#10b981' },
            { xVal: b, yVal: yB, label: 'b', color: '#06b6d4' }
          ].forEach(bound => {
            const bx = xScale(bound.xVal);
            const by0 = yScale(0);
            const by1 = bound.yVal !== null && isFinite(bound.yVal) ? yScale(bound.yVal) : (isDarkMode ? 0 : chartHeight);

            // Vertical boundary line
            graphGroup.append('line')
              .attr('x1', bx).attr('y1', by0)
              .attr('x2', bx).attr('y2', by1)
              .attr('stroke', bound.color)
              .attr('stroke-width', 2)
              .attr('stroke-dasharray', '4,3')
              .attr('opacity', 0.95);

            // Boundary pin at axis
            overlayGroup.append('circle')
              .attr('cx', bx).attr('cy', by0)
              .attr('r', 5)
              .attr('fill', bound.color)
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 1.5)
              .attr('cursor', 'ew-resize');

            // Boundary pin at curve
            if (bound.yVal !== null && isFinite(bound.yVal)) {
              overlayGroup.append('circle')
                .attr('cx', bx).attr('cy', by1)
                .attr('r', 4.5)
                .attr('fill', bound.color)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 1.5);
            }

            // Boundary badge
            const badgeG = overlayGroup.append('g')
              .attr('transform', `translate(${bx}, ${by0 + (bound.yVal && bound.yVal < 0 ? -16 : 18)})`);

            badgeG.append('rect')
              .attr('x', -24).attr('y', -9)
              .attr('width', 48).attr('height', 18)
              .attr('rx', 5)
              .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
              .attr('stroke', bound.color)
              .attr('stroke-width', 1.25)
              .attr('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))');

            badgeG.append('text')
              .attr('x', 0).attr('y', 3.5)
              .attr('text-anchor', 'middle')
              .attr('font-size', '9.5px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .attr('fill', bound.color)
              .text(`${bound.label}=${bound.xVal.toFixed(2)}`);
          });

          // 4. Floating Integral HUD Badge on graph
          if (integralRes.signedValue !== null) {
            const midX = (a + b) / 2;
            const midY = evaluateFunction(f.equation, midX) ?? 0;
            const hudX = Math.max(70, Math.min(chartWidth - 70, xScale(midX)));
            const hudY = Math.max(30, Math.min(chartHeight - 40, yScale(midY / 2)));

            const hudG = overlayGroup.append('g')
              .attr('transform', `translate(${hudX}, ${hudY})`);

            const labelText = `∫ f(x)dx = ${integralRes.signedValue.toFixed(4)}`;
            const textWidth = Math.max(120, labelText.length * 7.5 + 24);

            hudG.append('rect')
              .attr('x', -textWidth / 2).attr('y', -12)
              .attr('width', textWidth).attr('height', 24)
              .attr('rx', 12)
              .attr('fill', isDarkMode ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)')
              .attr('stroke', f.color)
              .attr('stroke-width', 1.5)
              .attr('filter', 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))');

            hudG.append('text')
              .attr('x', 0).attr('y', 4.5)
              .attr('text-anchor', 'middle')
              .attr('font-size', '11px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .attr('fill', isDarkMode ? '#e2e8f0' : '#1e293b')
              .text(labelText);
          }
        }
      });

      // --- Intersections Detection & Glowing Callout Badges ---
      const activeFunctions = functions.filter(f => f.visible);
      if (activeFunctions.length >= 2) {
        const pts = findIntersections(activeFunctions[0].equation, activeFunctions[1].equation, xDomain);
        setIntersections(prev => {
          if (prev.length === pts.length && prev.every((p, i) => Math.abs(p.x - pts[i].x) < 0.001 && Math.abs(p.y - pts[i].y) < 0.001)) {
            return prev;
          }
          return pts;
        });

        pts.forEach((p, idx) => {
          const cx = xScale(p.x);
          const cy = yScale(p.y);

          if (cx >= 0 && cx <= chartWidth && cy >= 0 && cy <= chartHeight) {
            // Outer glowing purple ring
            overlayGroup.append('circle')
              .attr('cx', cx).attr('cy', cy)
              .attr('r', 7)
              .attr('fill', 'rgba(168, 85, 247, 0.25)')
              .attr('stroke', '#a855f7')
              .attr('stroke-width', 2)
              .attr('class', 'glow-purple');

            // Inner white dot
            overlayGroup.append('circle')
              .attr('cx', cx).attr('cy', cy)
              .attr('r', 3)
              .attr('fill', '#ffffff');

            // Floating dark callout badge (e.g. P1 (-1, 1))
            const labelText = `P${idx + 1} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
            const badgeG = overlayGroup.append('g')
              .attr('transform', `translate(${cx + 12}, ${cy - 12})`);

            badgeG.append('rect')
              .attr('x', 0)
              .attr('y', -14)
              .attr('width', labelText.length * 6.8 + 14)
              .attr('height', 22)
              .attr('rx', 6)
              .attr('fill', '#1a1d33')
              .attr('stroke', '#8b5cf6')
              .attr('stroke-width', 1)
              .attr('opacity', 0.95);

            badgeG.append('text')
              .attr('x', 7)
              .attr('y', 0)
              .attr('fill', '#f1f5f9')
              .attr('font-size', '10px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .text(labelText);
          }
        });
      } else {
        setIntersections(prev => prev.length === 0 ? prev : []);
      }

      // --- Render Placed Pins ---
      placedPins.forEach((pin) => {
        const cx = xScale(pin.x);
        const cy = yScale(pin.y);

        if (cx >= 0 && cx <= chartWidth && cy >= 0 && cy <= chartHeight) {
          overlayGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 8)
            .attr('fill', 'rgba(59, 130, 246, 0.35)')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 2);

          overlayGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 3.5)
            .attr('fill', '#ffffff');

          const labelText = `${pin.label}: (${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})`;
          const badgeG = overlayGroup.append('g')
            .attr('transform', `translate(${cx + 12}, ${cy - 12})`);

          badgeG.append('rect')
            .attr('x', 0)
            .attr('y', -14)
            .attr('width', labelText.length * 6.5 + 14)
            .attr('height', 22)
            .attr('rx', 6)
            .attr('fill', '#0f172a')
            .attr('stroke', '#3b82f6')
            .attr('stroke-width', 1)
            .attr('opacity', 0.95);

          badgeG.append('text')
            .attr('x', 7)
            .attr('y', 0)
            .attr('fill', '#38bdf8')
            .attr('font-size', '10px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(labelText);
        }
      });

      // --- Render Geometric Drawn Shapes (Lines, Circles, Semi-Circles) ---
      drawnShapes.forEach((shape) => {
        if (!shape.visible) return;

        const shapeGroup = overlayGroup.append('g')
          .attr('class', `shape-${shape.id}`);

        const rot = shape.rotation || 0;

        if (shape.type === 'line' && shape.points && shape.points.length >= 2) {
          const pts = shape.points;
          const strokeColor = shape.color || '#3b82f6';
          const strokeW = shape.strokeWidth || 2;
          const isDashed = shape.style === 'dashed';

          // Calculate rotation pivot point (midpoint or centroid)
          let pivotX = 0;
          let pivotY = 0;
          if (shape.lineMode === 'polyline') {
            const centroidX = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
            const centroidY = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
            pivotX = xScale(centroidX);
            pivotY = yScale(centroidY);
          } else {
            const midX = (pts[0].x + pts[1].x) / 2;
            const midY = (pts[0].y + pts[1].y) / 2;
            pivotX = xScale(midX);
            pivotY = yScale(midY);
          }

          if (rot !== 0) {
            shapeGroup.attr('transform', `rotate(${-rot}, ${pivotX}, ${pivotY})`);
          }

          if (shape.lineMode === 'infinite' && pts.length >= 2) {
            const p1 = pts[0];
            const p2 = pts[1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;

            if (Math.abs(dx) < 1e-6) {
              const lineX = xScale(p1.x);
              shapeGroup.append('line')
                .attr('x1', lineX).attr('x2', lineX)
                .attr('y1', 0).attr('y2', chartHeight)
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeW)
                .attr('stroke-dasharray', isDashed ? '6,6' : 'none');
            } else {
              const m = dy / dx;
              const b = p1.y - m * p1.x;
              const xMin = xDomain[0] - 10;
              const xMax = xDomain[1] + 10;
              const yMin = m * xMin + b;
              const yMax = m * xMax + b;

              shapeGroup.append('line')
                .attr('x1', xScale(xMin)).attr('y1', yScale(yMin))
                .attr('x2', xScale(xMax)).attr('y2', yScale(yMax))
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeW)
                .attr('stroke-dasharray', isDashed ? '6,6' : 'none');
            }

            // Midpoint Equation Badge
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const badgeCx = Math.max(70, Math.min(chartWidth - 70, xScale(midX)));
            const badgeCy = Math.max(25, Math.min(chartHeight - 25, yScale(midY)));
            const eqText = formatLineEquation(p1, p2);

            const badgeG = shapeGroup.append('g')
              .attr('transform', `translate(${badgeCx}, ${badgeCy - 12})`);
            const bWidth = eqText.length * 6.8 + 16;
            badgeG.append('rect')
              .attr('x', -bWidth / 2).attr('y', -10)
              .attr('width', bWidth).attr('height', 20)
              .attr('rx', 6)
              .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
              .attr('stroke', strokeColor)
              .attr('stroke-width', 1.25)
              .attr('opacity', 0.95);
            badgeG.append('text')
              .attr('x', 0).attr('y', 3.5)
              .attr('text-anchor', 'middle')
              .attr('fill', strokeColor)
              .attr('font-size', '9.5px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .text(eqText);

          } else if (shape.lineMode === 'polyline') {
            const pixelCoords: [number, number][] = pts.map(p => [xScale(p.x), yScale(p.y)]);
            const lineGenerator = d3.line().x(d => d[0]).y(d => d[1]);

            shapeGroup.append('path')
              .datum(pixelCoords)
              .attr('fill', 'none')
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeW)
              .attr('stroke-dasharray', isDashed ? '6,6' : 'none')
              .attr('d', lineGenerator);

            // Vertex handles
            pts.forEach((p, idx) => {
              const vx = xScale(p.x);
              const vy = yScale(p.y);
              shapeGroup.append('circle')
                .attr('cx', vx).attr('cy', vy)
                .attr('r', 4.5)
                .attr('fill', strokeColor)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 1.5);
            });

            // Length calculation
            let totalLen = 0;
            for (let i = 0; i < pts.length - 1; i++) {
              totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
            }
            const midPt = pts[Math.floor(pts.length / 2)];
            const badgeG = shapeGroup.append('g')
              .attr('transform', `translate(${xScale(midPt.x)}, ${yScale(midPt.y) - 14})`);
            const labelText = `${shape.label} (L = ${totalLen.toFixed(2)})`;
            const bWidth = labelText.length * 6.5 + 16;
            badgeG.append('rect')
              .attr('x', -bWidth / 2).attr('y', -10)
              .attr('width', bWidth).attr('height', 20)
              .attr('rx', 6)
              .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
              .attr('stroke', strokeColor)
              .attr('stroke-width', 1.25);
            badgeG.append('text')
              .attr('x', 0).attr('y', 3.5)
              .attr('text-anchor', 'middle')
              .attr('fill', strokeColor)
              .attr('font-size', '9.5px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .text(labelText);

          } else {
            // Standard 2-point Segment
            const p1 = pts[0];
            const p2 = pts[1];
            const x1p = xScale(p1.x);
            const y1p = yScale(p1.y);
            const x2p = xScale(p2.x);
            const y2p = yScale(p2.y);

            shapeGroup.append('line')
              .attr('x1', x1p).attr('y1', y1p)
              .attr('x2', x2p).attr('y2', y2p)
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeW)
              .attr('stroke-dasharray', isDashed ? '6,6' : 'none');

            // Endpoint markers
            [p1, p2].forEach(p => {
              shapeGroup.append('circle')
                .attr('cx', xScale(p.x)).attr('cy', yScale(p.y))
                .attr('r', 5)
                .attr('fill', strokeColor)
                .attr('stroke', '#ffffff')
                .attr('stroke-width', 1.5);
            });

            // Midpoint Badge
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const eqText = formatLineEquation(p1, p2);
            const labelText = `${eqText} | L = ${len.toFixed(2)}`;

            const badgeCx = Math.max(70, Math.min(chartWidth - 70, xScale(midX)));
            const badgeCy = Math.max(25, Math.min(chartHeight - 25, yScale(midY)));

            const badgeG = shapeGroup.append('g')
              .attr('transform', `translate(${badgeCx}, ${badgeCy - 14})`);
            const bWidth = labelText.length * 6.5 + 16;
            badgeG.append('rect')
              .attr('x', -bWidth / 2).attr('y', -10)
              .attr('width', bWidth).attr('height', 20)
              .attr('rx', 6)
              .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
              .attr('stroke', strokeColor)
              .attr('stroke-width', 1.25)
              .attr('opacity', 0.95);
            badgeG.append('text')
              .attr('x', 0).attr('y', 3.5)
              .attr('text-anchor', 'middle')
              .attr('fill', strokeColor)
              .attr('font-size', '9.5px')
              .attr('font-family', 'monospace')
              .attr('font-weight', 'bold')
              .text(labelText);
          }

        } else if (shape.type === 'circle' && shape.center && shape.radius !== undefined) {
          const { x: h, y: k } = shape.center;
          const r = shape.radius;
          const cx = xScale(h);
          const cy = yScale(k);
          const rx = Math.abs(xScale(h + r) - xScale(h));
          const strokeColor = shape.color || '#3b82f6';
          const strokeW = shape.strokeWidth || 2;
          const isDashed = shape.style === 'dashed';

          if (rot !== 0) {
            shapeGroup.attr('transform', `rotate(${-rot}, ${cx}, ${cy})`);
          }

          // Filled circle body
          shapeGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', rx)
            .attr('fill', shape.fillColor || (isDarkMode ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)'))
            .attr('stroke', strokeColor)
            .attr('stroke-width', strokeW)
            .attr('stroke-dasharray', isDashed ? '6,6' : 'none');

          // Center point crosshair marker
          shapeGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 4)
            .attr('fill', strokeColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5);

          // Radius line guide from center to right edge
          shapeGroup.append('line')
            .attr('x1', cx).attr('y1', cy)
            .attr('x2', cx + rx).attr('y2', cy)
            .attr('stroke', strokeColor)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3');

          // Radius label on line
          shapeGroup.append('text')
            .attr('x', cx + rx / 2).attr('y', cy - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', strokeColor)
            .attr('font-size', '9px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(`r=${r.toFixed(2)}`);

          // Top Header Badge
          const eqText = formatCircleEquation(shape.center, r);
          const badgeG = shapeGroup.append('g')
            .attr('transform', `translate(${cx}, ${cy - rx - 14})`);
          const bWidth = eqText.length * 6.5 + 18;
          badgeG.append('rect')
            .attr('x', -bWidth / 2).attr('y', -10)
            .attr('width', bWidth).attr('height', 20)
            .attr('rx', 6)
            .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
            .attr('stroke', strokeColor)
            .attr('stroke-width', 1.25)
            .attr('opacity', 0.95);
          badgeG.append('text')
            .attr('x', 0).attr('y', 3.5)
            .attr('text-anchor', 'middle')
            .attr('fill', strokeColor)
            .attr('font-size', '9.5px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(eqText);

        } else if (shape.type === 'semicircle' && shape.center && shape.radius !== undefined) {
          const { x: h, y: k } = shape.center;
          const r = shape.radius;
          const cx = xScale(h);
          const cy = yScale(k);
          const rx = Math.abs(xScale(h + r) - xScale(h));
          const ry = Math.abs(yScale(k + r) - yScale(k));
          const orientation = shape.semiOrientation || 'top';
          const strokeColor = shape.color || '#ec4899';
          const strokeW = shape.strokeWidth || 2;
          const isDashed = shape.style === 'dashed';

          if (rot !== 0) {
            shapeGroup.attr('transform', `rotate(${-rot}, ${cx}, ${cy})`);
          }

          let arcPath = '';
          let chordPath = '';
          let fullClosedPath = '';

          if (orientation === 'top') {
            const x0 = xScale(h - r);
            const x1 = xScale(h + r);
            arcPath = `M ${x0},${cy} A ${rx} ${ry} 0 0 1 ${x1},${cy}`;
            chordPath = `M ${x0},${cy} L ${x1},${cy}`;
            fullClosedPath = `M ${x0},${cy} A ${rx} ${ry} 0 0 1 ${x1},${cy} Z`;
          } else if (orientation === 'bottom') {
            const x0 = xScale(h - r);
            const x1 = xScale(h + r);
            arcPath = `M ${x0},${cy} A ${rx} ${ry} 0 0 0 ${x1},${cy}`;
            chordPath = `M ${x0},${cy} L ${x1},${cy}`;
            fullClosedPath = `M ${x0},${cy} A ${rx} ${ry} 0 0 0 ${x1},${cy} Z`;
          } else if (orientation === 'right') {
            const y0 = yScale(k - r);
            const y1 = yScale(k + r);
            arcPath = `M ${cx},${y0} A ${rx} ${ry} 0 0 1 ${cx},${y1}`;
            chordPath = `M ${cx},${y0} L ${cx},${y1}`;
            fullClosedPath = `M ${cx},${y0} A ${rx} ${ry} 0 0 1 ${cx},${y1} Z`;
          } else {
            // left
            const y0 = yScale(k - r);
            const y1 = yScale(k + r);
            arcPath = `M ${cx},${y0} A ${rx} ${ry} 0 0 0 ${cx},${y1}`;
            chordPath = `M ${cx},${y0} L ${cx},${y1}`;
            fullClosedPath = `M ${cx},${y0} A ${rx} ${ry} 0 0 0 ${cx},${y1} Z`;
          }

          // Shaded fill area
          shapeGroup.append('path')
            .attr('d', fullClosedPath)
            .attr('fill', shape.fillColor || (isDarkMode ? 'rgba(236, 72, 153, 0.12)' : 'rgba(236, 72, 153, 0.08)'));

          // Baseline Chord line
          shapeGroup.append('path')
            .attr('d', chordPath)
            .attr('stroke', strokeColor)
            .attr('stroke-width', 1.25)
            .attr('stroke-dasharray', '4,4');

          // Arc Curve
          shapeGroup.append('path')
            .attr('d', arcPath)
            .attr('fill', 'none')
            .attr('stroke', strokeColor)
            .attr('stroke-width', strokeW)
            .attr('stroke-dasharray', isDashed ? '6,6' : 'none');

          // Center Marker
          shapeGroup.append('circle')
            .attr('cx', cx).attr('cy', cy)
            .attr('r', 4)
            .attr('fill', strokeColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5);

          // Top Header Badge
          const eqText = formatSemicircleEquation(shape.center, r, orientation);
          const badgeY = orientation === 'top' ? cy - ry - 14 : orientation === 'bottom' ? cy + ry + 14 : cy - 14;
          const badgeG = shapeGroup.append('g')
            .attr('transform', `translate(${cx}, ${badgeY})`);
          const bWidth = eqText.length * 6.5 + 18;
          badgeG.append('rect')
            .attr('x', -bWidth / 2).attr('y', -10)
            .attr('width', bWidth).attr('height', 20)
            .attr('rx', 6)
            .attr('fill', isDarkMode ? '#0f172a' : '#ffffff')
            .attr('stroke', strokeColor)
            .attr('stroke-width', 1.25)
            .attr('opacity', 0.95);
          badgeG.append('text')
            .attr('x', 0).attr('y', 3.5)
            .attr('text-anchor', 'middle')
            .attr('fill', strokeColor)
            .attr('font-size', '9.5px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(eqText);
        }
      });

      // --- Render In-Progress Drawing Points & Handles ---
      if (drawingPoints.length > 0) {
        const inProgressGroup = overlayGroup.append('g').attr('class', 'drawing-in-progress');

        drawingPoints.forEach((pt, idx) => {
          const px = xScale(pt.x);
          const py = yScale(pt.y);

          inProgressGroup.append('circle')
            .attr('cx', px).attr('cy', py)
            .attr('r', 7)
            .attr('fill', 'rgba(239, 68, 68, 0.4)')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 2)
            .attr('class', 'glow-red');

          inProgressGroup.append('circle')
            .attr('cx', px).attr('cy', py)
            .attr('r', 3)
            .attr('fill', '#ffffff');

          const pointLabel = activeQuickAction === 'circle' || activeQuickAction === 'semicircle'
            ? `Center: (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`
            : `P${idx + 1}: (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`;

          const badge = inProgressGroup.append('g')
            .attr('transform', `translate(${px + 10}, ${py - 10})`);
          badge.append('rect')
            .attr('x', 0).attr('y', -12)
            .attr('width', pointLabel.length * 6.5 + 12).attr('height', 18)
            .attr('rx', 4)
            .attr('fill', '#0f172a')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 1);
          badge.append('text')
            .attr('x', 6).attr('y', 0)
            .attr('fill', '#fca5a5')
            .attr('font-size', '9px')
            .attr('font-family', 'monospace')
            .attr('font-weight', 'bold')
            .text(pointLabel);
        });

        // If line has multiple points, draw connecting dashed line
        if (activeQuickAction === 'line' && drawingPoints.length >= 2) {
          const pixelPts: [number, number][] = drawingPoints.map(p => [xScale(p.x), yScale(p.y)]);
          const lineGen = d3.line().x(d => d[0]).y(d => d[1]);
          inProgressGroup.append('path')
            .datum(pixelPts)
            .attr('fill', 'none')
            .attr('stroke', drawingColor)
            .attr('stroke-width', drawingStrokeWidth)
            .attr('stroke-dasharray', '4,4')
            .attr('d', lineGen);
        }
      }
    };

    const renderPath = (points: [number, number][], color: string, style: 'solid' | 'dashed', width: number) => {
      const line = d3.line()
        .x(d => d[0])
        .y(d => d[1]);

      const glowClass = color === '#3b82f6' ? 'glow-blue' : color === '#ef4444' ? 'glow-red' : 'glow-purple';

      graphGroup.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', width)
        .attr('stroke-dasharray', style === 'dashed' ? '6,6' : 'none')
        .attr('class', glowClass)
        .attr('d', line);
    };

    // --- Zooming ---
    let zoomTimeout: any;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.06, 60])
      .translateExtent([[xScale(-100), yScale(100)], [xScale(100), yScale(-100)]])
      .on('zoom', (event) => {
        if (isGridLocked) return;
        const currentX = event.transform.rescaleX(xScale);
        const currentY = event.transform.rescaleY(yScale);

        const clampedX = clampBounds(currentX.domain() as [number, number], -100, 100);
        const clampedY = clampBounds(currentY.domain() as [number, number], -100, 100);

        setZoomPercent(spanToZoomPercent(clampedX[1] - clampedX[0]));

        clearTimeout(zoomTimeout);
        zoomTimeout = setTimeout(() => {
          setViewportDomain(clampedX);
          setViewportRange(clampedY);
        }, 80);

        const oldX = xScale;
        const oldY = yScale;
        xScale = d3.scaleLinear().domain(clampedX).range([0, chartWidth]);
        yScale = d3.scaleLinear().domain(clampedY).range([chartHeight, 0]);
        draw();
        xScale = oldX;
        yScale = oldY;
      });

    svg.call(zoom);
    draw();

    // --- Crosshair Tool ---
    const crosshairG = g.append('g')
      .attr('class', 'crosshair-tool')
      .style('display', 'none')
      .style('pointer-events', 'none');

    const xLine = crosshairG.append('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    const yLine = crosshairG.append('line')
      .attr('stroke', '#475569')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');

    const trackerDot = crosshairG.append('circle')
      .attr('r', 4)
      .attr('fill', '#a855f7')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('class', 'glow-purple');

    const tooltipBg = crosshairG.append('rect')
      .attr('fill', '#111425')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1)
      .attr('rx', 6)
      .attr('opacity', 0.95);

    const tooltipText = crosshairG.append('text')
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold');

    svg.on('pointermove mousemove', (event) => {
      const [mouseX, mouseY] = d3.pointer(event, g.node());

      if (mouseX >= 0 && mouseX <= chartWidth && mouseY >= 0 && mouseY <= chartHeight) {
        const svgElement = svg.node() as SVGSVGElement | null;
        if (!svgElement) return;

        const transform = d3.zoomTransform(svgElement);
        const currentX = transform.rescaleX(xScale);
        const currentY = transform.rescaleY(yScale);

        const xVal = currentX.invert(mouseX);
        const yVal = currentY.invert(mouseY);

        crosshairG.style('display', null);

        xLine
          .attr('x1', mouseX).attr('x2', mouseX)
          .attr('y1', 0).attr('y2', chartHeight);

        yLine
          .attr('x1', 0).attr('x2', chartWidth)
          .attr('y1', mouseY).attr('y2', mouseY);

        trackerDot
          .attr('cx', mouseX).attr('cy', mouseY);

        tooltipText.text(`(${xVal.toFixed(2)}, ${yVal.toFixed(2)})`);

        const textNode = tooltipText.node() as SVGTextElement | null;
        if (textNode) {
          const bbox = textNode.getBBox();
          const padding = 6;
          let tooltipX = mouseX + 12;
          if (tooltipX + bbox.width + padding * 2 > chartWidth) {
            tooltipX = mouseX - bbox.width - padding * 2 - 12;
          }
          let tooltipY = mouseY - 12 - bbox.height;
          if (tooltipY < 0) {
            tooltipY = mouseY + 15;
          }

          tooltipBg
            .attr('x', tooltipX)
            .attr('y', tooltipY)
            .attr('width', bbox.width + padding * 2)
            .attr('height', bbox.height + padding * 2);

          tooltipText
            .attr('x', tooltipX + padding)
            .attr('y', tooltipY + padding + bbox.height - 2);
        }
      } else {
        crosshairG.style('display', 'none');
      }
    });

    svg.on('pointerleave mouseleave', () => {
      crosshairG.style('display', 'none');
    });

    // SVG Canvas Click Handler for Quick Actions
    svg.on('click', (event) => {
      const [mouseX, mouseY] = d3.pointer(event, g.node());
      if (mouseX >= 0 && mouseX <= chartWidth && mouseY >= 0 && mouseY <= chartHeight) {
        const svgElement = svg.node() as SVGSVGElement | null;
        if (!svgElement) return;

        const transform = d3.zoomTransform(svgElement);
        const currentX = transform.rescaleX(xScale);
        const currentY = transform.rescaleY(yScale);

        const xVal = currentX.invert(mouseX);
        const yVal = currentY.invert(mouseY);

        if (activeGraphTool === 'zoomIn') {
          handleZoomAtPoint(xVal, yVal, 1.35);
        } else if (activeGraphTool === 'zoomOut') {
          handleZoomAtPoint(xVal, yVal, 0.75);
        } else if (activeQuickAction === 'point') {
          const activeFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
          const evalY = activeFn ? evaluateFunction(activeFn.equation, xVal) : null;
          const finalY = evalY !== null ? evalY : yVal;

          recordHistory();
          setPlacedPins(prev => [
            ...prev,
            {
              id: Date.now().toString(),
              x: Math.round(xVal * 100) / 100,
              y: Math.round(finalY * 100) / 100,
              label: `P${prev.length + 1}`
            }
          ]);
        } else if (activeQuickAction === 'tangent') {
          const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
          if (targetId) {
            recordHistory();
            setFunctions(prev => prev.map(f => f.id === targetId ? {
              ...f,
              showTangent: true,
              tangentPoint: Math.round(xVal * 10) / 10
            } : f));
          }
        } else if (activeQuickAction === 'integral') {
          const targetId = editingFunctionId || functions.find(f => f.visible)?.id;
          if (targetId) {
            recordHistory();
            const roundX = Math.round(xVal * 100) / 100;
            setFunctions(prev => prev.map(f => {
              if (f.id !== targetId) return f;
              const a = f.integralLower !== undefined ? f.integralLower : 0;
              const b = f.integralUpper !== undefined ? f.integralUpper : 2;
              let newA = a;
              let newB = b;
              if (integralClickMode === 'a') {
                newA = roundX;
              } else if (integralClickMode === 'b') {
                newB = roundX;
              } else {
                if (Math.abs(roundX - a) <= Math.abs(roundX - b)) {
                  newA = roundX;
                } else {
                  newB = roundX;
                }
              }
              return {
                ...f,
                showIntegral: true,
                integralLower: newA,
                integralUpper: newB,
              };
            }));
            showToast(`Integration bound set to x = ${roundX}`);
          }
        } else if (activeQuickAction === 'line') {
          const roundX = Math.round(xVal * 100) / 100;
          const roundY = Math.round(yVal * 100) / 100;
          const newPt: Point2D = { x: roundX, y: roundY };
          const currentPts = drawingPointsRef.current;
          const lineMode = drawingLineModeRef.current;

          if (lineMode === 'polyline') {
            const updated = [...currentPts, newPt];
            setDrawingPoints(updated);
            showToast(`Added vertex ${updated.length} at (${roundX}, ${roundY}). Click more points or 'Finish Line'.`);
          } else if (lineMode === 'infinite') {
            if (currentPts.length === 0) {
              setDrawingPoints([newPt]);
              showToast(`Point 1 set at (${roundX}, ${roundY}). Click Point 2 to set infinite line direction.`);
            } else {
              const p1 = currentPts[0];
              const p2 = newPt;
              recordHistory();
              const newLine: CustomShape = {
                id: Date.now().toString(),
                type: 'line',
                lineMode: 'infinite',
                label: `Line ${drawnShapesRef.current.filter(s => s.type === 'line').length + 1}`,
                color: drawingColorRef.current,
                strokeWidth: drawingStrokeWidthRef.current,
                style: drawingStyleRef.current,
                visible: true,
                points: [p1, p2]
              };
              setDrawnShapes(prev => [...prev, newLine]);
              setDrawingPoints([]);
              showToast(`Infinite Line created: ${formatLineEquation(p1, p2)}`);
            }
          } else {
            // Segment
            if (currentPts.length === 0) {
              setDrawingPoints([newPt]);
              showToast(`Point 1 placed at (${roundX}, ${roundY}). Click point 2 anywhere on any quadrant to draw line.`);
            } else {
              const p1 = currentPts[0];
              const p2 = newPt;
              recordHistory();
              const newLine: CustomShape = {
                id: Date.now().toString(),
                type: 'line',
                lineMode: 'segment',
                label: `Line ${drawnShapesRef.current.filter(s => s.type === 'line').length + 1}`,
                color: drawingColorRef.current,
                strokeWidth: drawingStrokeWidthRef.current,
                style: drawingStyleRef.current,
                visible: true,
                points: [p1, p2]
              };
              setDrawnShapes(prev => [...prev, newLine]);
              setDrawingPoints([]);
              showToast(`Line drawn between (${p1.x}, ${p1.y}) and (${p2.x}, ${p2.y})`);
            }
          }
        } else if (activeQuickAction === 'circle') {
          const roundX = Math.round(xVal * 100) / 100;
          const roundY = Math.round(yVal * 100) / 100;
          const currentPts = drawingPointsRef.current;

          if (currentPts.length === 0) {
            setDrawingPoints([{ x: roundX, y: roundY }]);
            showToast(`Circle center (h, k) placed at (${roundX}, ${roundY}). Click anywhere to set radius.`);
          } else {
            const center = currentPts[0];
            let r = Math.hypot(roundX - center.x, roundY - center.y);
            r = Math.round(r * 100) / 100;
            if (r < 0.05) r = 1;
            recordHistory();
            const newCircle: CustomShape = {
              id: Date.now().toString(),
              type: 'circle',
              label: `Circle ${drawnShapesRef.current.filter(s => s.type === 'circle').length + 1}`,
              color: drawingColorRef.current,
              strokeWidth: drawingStrokeWidthRef.current,
              style: drawingStyleRef.current,
              fillColor: isDarkModeRef.current ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
              visible: true,
              center,
              radius: r,
            };
            setDrawnShapes(prev => [...prev, newCircle]);
            setDrawingPoints([]);
            showToast(`Circle created: Center (${center.x}, ${center.y}), Radius r = ${r}`);
          }
        } else if (activeQuickAction === 'semicircle') {
          const roundX = Math.round(xVal * 100) / 100;
          const roundY = Math.round(yVal * 100) / 100;
          const currentPts = drawingPointsRef.current;

          if (currentPts.length === 0) {
            setDrawingPoints([{ x: roundX, y: roundY }]);
            showToast(`Semi-circle center placed at (${roundX}, ${roundY}). Click anywhere to set radius.`);
          } else {
            const center = currentPts[0];
            let r = Math.hypot(roundX - center.x, roundY - center.y);
            r = Math.round(r * 100) / 100;
            if (r < 0.05) r = 1;
            recordHistory();
            const newSemi: CustomShape = {
              id: Date.now().toString(),
              type: 'semicircle',
              semiOrientation: drawingSemiOrientationRef.current,
              label: `Semi-Circle ${drawnShapesRef.current.filter(s => s.type === 'semicircle').length + 1}`,
              color: drawingColorRef.current,
              strokeWidth: drawingStrokeWidthRef.current,
              style: drawingStyleRef.current,
              fillColor: isDarkModeRef.current ? 'rgba(236, 72, 153, 0.12)' : 'rgba(236, 72, 153, 0.08)',
              visible: true,
              center,
              radius: r,
            };
            setDrawnShapes(prev => [...prev, newSemi]);
            setDrawingPoints([]);
            showToast(`Semi-circle (${drawingSemiOrientationRef.current}) created with r = ${r}`);
          }
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });
    resizeObserver.observe(svgRef.current);

    return () => resizeObserver.disconnect();
  }, [functions, viewportDomain, viewportRange, isGridLocked, placedPins, drawnShapes, drawingPoints, drawingLineMode, drawingSemiOrientation, drawingColor, drawingStrokeWidth, drawingStyle, activeQuickAction, editingFunctionId, activeGraphTool, isDarkMode, gridStyle, showGridLines, showAxisLabels, decimalPrecision, angleUnit, integralClickMode]);

  // --- Zoom Controls ---
  const handleContinuousZoom = (targetZoomPercent: number) => {
    const safeTargetZoom = Math.max(0, Math.min(100, targetZoomPercent));
    const newSpanX = zoomPercentToSpan(safeTargetZoom);

    const currentCenterX = (viewportDomain[0] + viewportDomain[1]) / 2;
    const currentCenterY = (viewportRange[0] + viewportRange[1]) / 2;
    const currentSpanX = viewportDomain[1] - viewportDomain[0];
    const currentSpanY = viewportRange[1] - viewportRange[0];
    const aspectRatio = currentSpanX > 0 ? currentSpanY / currentSpanX : 10 / 12;

    const newSpanY = newSpanX * aspectRatio;

    const clampedX = clampBounds([currentCenterX - newSpanX / 2, currentCenterX + newSpanX / 2], -100, 100);
    const clampedY = clampBounds([currentCenterY - newSpanY / 2, currentCenterY + newSpanY / 2], -100, 100);

    setViewportDomain(clampedX);
    setViewportRange(clampedY);
    setZoomPercent(Math.round(safeTargetZoom));
  };

  const handleZoomAtPoint = (centerX: number, centerY: number, factor: number) => {
    const currentSpanX = viewportDomain[1] - viewportDomain[0];
    const currentSpanY = viewportRange[1] - viewportRange[0];
    const newSpanX = currentSpanX / factor;
    const newSpanY = currentSpanY / factor;

    const clampedX = clampBounds([centerX - newSpanX / 2, centerX + newSpanX / 2], -100, 100);
    const clampedY = clampBounds([centerY - newSpanY / 2, centerY + newSpanY / 2], -100, 100);

    setViewportDomain(clampedX);
    setViewportRange(clampedY);
    setZoomPercent(spanToZoomPercent(clampedX[1] - clampedX[0]));
  };

  const handleZoom = (factor: number) => {
    const cx = (viewportDomain[0] + viewportDomain[1]) / 2;
    const cy = (viewportRange[0] + viewportRange[1]) / 2;
    handleZoomAtPoint(cx, cy, factor);
  };

  const handleResetZoom = () => {
    setViewportDomain(DEFAULT_VIEWPORT_DOMAIN);
    setViewportRange(DEFAULT_VIEWPORT_RANGE);
    setZoomPercent(DEFAULT_ZOOM_PERCENT);
    setActiveQuickAction(null);
    setPlacedPins([]);
    showToast("Reset to default 25% view");
  };

  // --- Auth Guards ---
  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#090b17] flex flex-col items-center justify-center p-4 text-slate-100 select-none">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center p-2.5 shadow-lg shadow-indigo-500/20 mb-4 animate-bounce">
          <img src="icon.svg" alt="Linecraft" className="w-full h-full object-contain" />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
          <Loader2 size={16} className="animate-spin text-indigo-400" />
          <span>Initializing Linecraft Environment...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage onSuccess={() => {}} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none ${isDarkMode ? 'bg-[#090b17] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* --- TOP NAVBAR --- */}
      <header className={`h-16 px-5 flex items-center justify-between shrink-0 z-30 shadow-md transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0f1222] border-b border-slate-800/80 text-slate-100' : 'bg-white border-b border-slate-200 text-slate-800 shadow-sm'
      }`}>
        {/* Brand */}
        <div className="flex items-center gap-3">
          <AppLogo size={22} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
                linecraft
              </h1>
            </div>
            <div className="flex flex-col">
              <p className={`text-[11px] font-medium tracking-wide ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                advanced function visualizer created by ALI AMINI
              </p>
              <a 
                href="mailto:alibertendless999.ko@gmail.com"
                className={`inline-flex items-center gap-1.5 text-xs font-mono font-semibold hover:underline transition-colors mt-0.5 ${
                  isDarkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'
                }`}
              >
                <Mail size={14} className="shrink-0" />
                <span>alibertendless999.ko@gmail.com</span>
              </a>
            </div>
          </div>
        </div>

        {/* Center Search / Command Input Bar */}
        <form onSubmit={handleCommandSubmit} className="flex-1 max-w-xl mx-8 relative">
          <div className="relative flex items-center">
            <Search size={15} className={`absolute left-3.5 pointer-events-none ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Type a function, e.g. sin(x), x^2 + 2x, ln(x)"
              className={`w-full border rounded-xl pl-10 pr-20 py-2 text-xs font-mono outline-none transition-all shadow-inner ${
                isDarkMode 
                  ? 'bg-[#161a2e] border-slate-700/60 focus:border-indigo-500/80 text-slate-100 placeholder-slate-500' 
                  : 'bg-slate-100 border-slate-300 focus:border-indigo-500 text-slate-900 placeholder-slate-400'
              }`}
            />
            <button 
              type="submit"
              className="absolute right-1.5 px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-xs rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-1"
            >
              Enter
            </button>
          </div>
        </form>

        {/* Right Top Bar Actions */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo Controls */}
          <div className={`flex items-center rounded-xl border p-0.5 shadow-xs ${
            isDarkMode 
              ? 'bg-[#161a2e] border-slate-700/80' 
              : 'bg-slate-100 border-slate-300'
          }`}>
            <button 
              type="button"
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                historyPast.length === 0 
                  ? (isDarkMode ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-400 cursor-not-allowed opacity-40') 
                  : (isDarkMode 
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:scale-95' 
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white active:scale-95 shadow-xs')
              }`}
              title={historyPast.length > 0 ? `Undo (${historyPast.length} steps) • Ctrl+Z` : "Nothing to undo"}
              aria-label="Undo"
            >
              <Undo2 size={16} />
            </button>
            <div className={`w-px h-4 mx-0.5 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-300'}`} />
            <button 
              type="button"
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                historyFuture.length === 0 
                  ? (isDarkMode ? 'text-slate-600 cursor-not-allowed opacity-40' : 'text-slate-400 cursor-not-allowed opacity-40') 
                  : (isDarkMode 
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80 active:scale-95' 
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white active:scale-95 shadow-xs')
              }`}
              title={historyFuture.length > 0 ? `Redo (${historyFuture.length} steps) • Ctrl+Y` : "Nothing to redo"}
              aria-label="Redo"
            >
              <Redo2 size={16} />
            </button>
          </div>

          <button 
            type="button"
            onClick={() => {
              const nextMode = !isDarkMode;
              setIsDarkMode(nextMode);
              showToast(nextMode ? "Night Mode Activated" : "Day Mode Activated");
            }}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title={isDarkMode ? "Switch to Day Mode" : "Switch to Night Mode"}
          >
            {isDarkMode ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
          </button>

          <button 
            onClick={() => setIsHelpOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title="Help & Guides"
          >
            <HelpCircle size={17} />
          </button>

          <button 
            onClick={() => setIsSettingsOpen(true)}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title="Settings & Preferences"
          >
            <Settings size={17} />
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              <Download size={14} />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronRight size={14} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {exportMenuOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className={`absolute right-0 mt-2 w-48 border rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 ${
                    isDarkMode ? 'bg-[#161a2e] border-slate-700/80 text-slate-200' : 'bg-white border-slate-200 text-slate-800 shadow-xl'
                  }`}
                >
                  <button 
                    onClick={exportToPDF} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText size={14} className="text-red-400" />
                    Export as PDF
                  </button>
                  <button 
                    onClick={exportToPNG} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ImageIcon size={14} className="text-blue-400" />
                    Export as PNG
                  </button>
                  <button 
                    onClick={exportToSVG} 
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors w-full text-left font-medium ${
                      isDarkMode ? 'text-slate-200 hover:bg-slate-800/80' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Layers size={14} className="text-purple-400" />
                    Export as SVG
                  </button>

                  <div className={`border-t my-1 pt-1.5 px-2 ${isDarkMode ? 'border-slate-700/60' : 'border-slate-200'}`}>
                    <label className={`flex items-center gap-2 text-[11px] cursor-pointer select-none ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <input 
                        type="checkbox"
                        checked={exportHideControls}
                        onChange={(e) => setExportHideControls(e.target.checked)}
                        className="rounded border-slate-400 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
                      />
                      <span>Hide toolbars in export</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Admin Console Button (for Developer / Admin) */}
          {(userProfile?.role === 'admin' || currentUser?.email?.toLowerCase() === 'alibertendless999.ko@gmail.com') && (
            <button
              onClick={() => setIsAdminPanelOpen(true)}
              className="relative flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              title="Open Admin Console"
            >
              <ShieldCheck size={14} className="text-amber-400" />
              <span className="hidden md:inline">Admin Console</span>
              {unreadAdminCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-1 -right-1" />
              )}
            </button>
          )}

          {/* User Profile & Sign Out Badge */}
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs ${
            isDarkMode ? 'bg-[#161a2e] border-slate-700/80 text-slate-200' : 'bg-slate-100 border-slate-300 text-slate-800'
          }`}>
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
              {currentUser?.displayName ? currentUser.displayName.charAt(0) : currentUser?.email ? currentUser.email.charAt(0) : 'U'}
            </div>
            <div className="hidden lg:flex flex-col text-left leading-tight max-w-[120px] truncate">
              <span className="font-semibold text-[11px] truncate">{currentUser?.displayName || 'User'}</span>
              <span className="text-[9px] text-slate-400 truncate">{currentUser?.email}</span>
            </div>
            <button
              onClick={async () => {
                await logOut();
                showToast("Signed out successfully");
              }}
              className="p-1 hover:text-red-400 text-slate-400 transition-colors ml-1"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN BODY CONTAINER --- */}
      <div className="flex-1 flex overflow-hidden">

        {/* --- LEFT NAVIGATION RAIL --- */}
        <nav className={`w-16 border-r flex flex-col items-center py-4 shrink-0 z-20 transition-colors duration-200 ${
          isDarkMode ? 'bg-[#0c0e1a] border-slate-800/80' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex flex-col items-center gap-2 w-full px-2">
            {[
              { id: 'Graph', label: 'Graph', icon: LineChart },
              { id: 'Analysis', label: 'Analysis', icon: Activity },
              { id: 'Table', label: 'Table', icon: Table },
              { id: 'Intersections', label: 'Intersections', icon: GitCommit },
              { id: 'Transform', label: 'Transform', icon: Sliders },
              { id: 'Examples', label: 'Examples', icon: BookOpen },
              { id: 'Saved', label: 'Saved', icon: Bookmark },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsSidebarOpen(true);
                  }}
                  className={`w-full py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all relative group ${
                    isActive 
                      ? (isDarkMode 
                          ? 'bg-gradient-to-br from-indigo-600/30 to-purple-600/20 text-indigo-400 border border-indigo-500/30 shadow-md shadow-indigo-500/10' 
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm')
                      : (isDarkMode 
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70')
                  }`}
                  title={tab.label}
                >
                  <Icon size={18} />
                  <span className="text-[9px] font-medium tracking-tight">{tab.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeRailIndicator" 
                      className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${isDarkMode ? 'bg-indigo-500' : 'bg-indigo-600'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* --- SECONDARY FUNCTIONS & ANALYSIS SIDEBAR --- */}
        <motion.aside
          initial={{ width: 320 }}
          animate={{ width: isSidebarOpen ? 320 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className={`border-r overflow-hidden flex flex-col shrink-0 z-10 shadow-xl transition-colors duration-200 ${
            isDarkMode ? 'bg-[#0f1222] border-slate-800/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          <div className="w-[320px] p-4 h-full flex flex-col gap-4 overflow-y-auto">

            {/* --- SIDEBAR ACTIVE TAB HEADER --- */}
            <div className={`flex items-center justify-between border-b pb-3 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                {activeTab === 'Graph' && <LineChart size={16} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />}
                {activeTab === 'Analysis' && <Activity size={16} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />}
                {activeTab === 'Table' && <Table size={16} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'} />}
                {activeTab === 'Intersections' && <GitCommit size={16} className={isDarkMode ? 'text-pink-400' : 'text-pink-600'} />}
                {activeTab === 'Transform' && <Sliders size={16} className={isDarkMode ? 'text-amber-400' : 'text-amber-600'} />}
                {activeTab === 'Examples' && <BookOpen size={16} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />}
                {activeTab === 'Saved' && <Bookmark size={16} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />}
                <h2 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                  {activeTab === 'Graph' && 'Function Equations'}
                  {activeTab === 'Analysis' && 'Calculus Analysis'}
                  {activeTab === 'Table' && 'Values Table'}
                  {activeTab === 'Intersections' && 'Curve Intersections'}
                  {activeTab === 'Transform' && 'Transformations'}
                  {activeTab === 'Examples' && 'Math Examples'}
                  {activeTab === 'Saved' && 'Saved Presets'}
                </h2>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                {activeTab}
              </span>
            </div>

            {/* --- TAB 1: GRAPH (FUNCTIONS LIST) --- */}
            {activeTab === 'Graph' && (
              <>
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Active Curves</span>
                    <div className="flex items-center gap-1.5">
                      {functions.length > 0 && (
                        <button 
                          onClick={handleClearAllFunctions}
                          className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-all ${
                            isDarkMode 
                              ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Clear all curves (Undoable)"
                        >
                          <Trash2 size={12} />
                          <span>Clear All</span>
                        </button>
                      )}
                      <button 
                        onClick={handleAddFunction}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all active:scale-95 ${
                          isDarkMode 
                            ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' 
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                        }`}
                      >
                        <Plus size={13} />
                        <span>Add Function</span>
                      </button>
                    </div>
                  </div>

                  {/* Function Cards */}
                  <div className="space-y-3">
                    {functions.map((f, idx) => {
                      const isSelected = editingFunctionId === f.id;
                      return (
                        <div 
                          key={f.id} 
                          onClick={() => setEditingFunctionId(f.id)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? (isDarkMode 
                                  ? 'bg-[#161a2e] border-indigo-500/50 shadow-md shadow-indigo-500/10' 
                                  : 'bg-indigo-50/70 border-indigo-400 shadow-sm')
                              : (isDarkMode 
                                  ? 'bg-[#121524] border-slate-800/80 hover:border-slate-700/80' 
                                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm')
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input 
                                type="color" 
                                value={f.color}
                                onChange={(e) => updateFunction(f.id, { color: e.target.value })}
                                className="w-4 h-4 rounded-full border-0 cursor-pointer bg-transparent p-0 shrink-0"
                                title="Change Color"
                              />
                              <span className={`font-mono text-xs font-bold shrink-0 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                {idx === 0 ? 'f(x)' : idx === 1 ? 'g(x)' : `f${idx + 1}(x)`} =
                              </span>
                              <input 
                                type="text"
                                value={f.equation}
                                onChange={(e) => handleEquationChange(f.id, e.target.value)}
                                onBlur={handleEquationBlur}
                                onFocus={() => setEditingFunctionId(f.id)}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full border rounded-lg px-2 py-1 text-xs font-mono outline-none transition-all shadow-inner ${
                                  isDarkMode 
                                    ? 'bg-[#0c0e1a] border-slate-700/80 focus:border-indigo-500 text-slate-100 placeholder-slate-500' 
                                    : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-900 placeholder-slate-400'
                                }`}
                                placeholder="e.g. 2*x^2 + 3"
                              />
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDuplicateFunction(f.id); }}
                                className={`p-1 rounded transition-colors ${
                                  isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-indigo-300' : 'hover:bg-slate-200 text-slate-500 hover:text-indigo-600'
                                }`}
                                title="Duplicate Curve"
                              >
                                <Copy size={13} />
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); updateFunction(f.id, { showDerivative: !f.showDerivative }); }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                  f.showDerivative 
                                    ? 'text-white bg-cyan-600 border border-cyan-400 shadow-sm shadow-cyan-500/30' 
                                    : isDarkMode 
                                      ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-transparent' 
                                      : 'text-slate-500 hover:text-cyan-700 hover:bg-slate-200 border border-transparent'
                                }`}
                                title={f.showDerivative ? "Hide Derivative Curve (f'(x))" : "Show Derivative Curve (f'(x))"}
                              >
                                f'
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); updateFunction(f.id, { showInverse: !f.showInverse }); }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                                  f.showInverse 
                                    ? 'text-white bg-indigo-600 border border-indigo-400 shadow-sm shadow-indigo-500/30' 
                                    : isDarkMode 
                                      ? 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800 border border-transparent' 
                                      : 'text-slate-500 hover:text-indigo-700 hover:bg-slate-200 border border-transparent'
                                }`}
                                title={f.showInverse ? "Hide Inverse Curve (f⁻¹)" : "Show Inverse Curve (f⁻¹)"}
                              >
                                f⁻¹
                              </button>

                              <button 
                                onClick={(e) => { e.stopPropagation(); updateFunction(f.id, { visible: !f.visible }); }}
                                className={`p-1 rounded transition-colors ${
                                  isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
                                } ${f.visible ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : (isDarkMode ? 'text-slate-600' : 'text-slate-400')}`}
                                title="Toggle Visibility"
                              >
                                {f.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                              </button>
                              
                              <button 
                                onClick={(e) => { e.stopPropagation(); removeFunction(f.id); }}
                                className={`p-1 rounded text-slate-500 hover:text-red-400 transition-colors ${
                                  isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
                                }`}
                                title="Delete Function"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {isSelected && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className={`pt-2.5 mt-2.5 border-t space-y-2.5 text-[11px] ${
                                isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <span className={`text-[10px] font-medium uppercase tracking-wider block ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Quick Math Palette</span>
                                <div className="grid grid-cols-6 gap-1 font-mono text-[10px]">
                                  {[
                                    { label: 'x', insert: 'x' },
                                    { label: '+', insert: '+' },
                                    { label: '-', insert: '-' },
                                    { label: '*', insert: '*' },
                                    { label: '/', insert: '/' },
                                    { label: 'x²', insert: '^2' },
                                    { label: 'x³', insert: '^3' },
                                    { label: 'xⁿ', insert: '^' },
                                    { label: '√x', insert: 'sqrt(x)' },
                                    { label: '|x|', insert: 'abs(x)' },
                                    { label: 'sin', insert: 'sin(x)' },
                                    { label: 'cos', insert: 'cos(x)' },
                                    { label: 'tan', insert: 'tan(x)' },
                                    { label: 'log', insert: 'log(x)' },
                                    { label: 'ln', insert: 'ln(x)' },
                                    { label: '(', insert: '(' },
                                    { label: ')', insert: ')' },
                                    { label: 'e', insert: 'e' },
                                  ].map((btn) => (
                                    <button
                                      key={btn.label}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        appendSmartInput(btn.insert);
                                      }}
                                      className={`rounded py-1 font-bold transition-all text-center ${
                                        isDarkMode 
                                          ? 'bg-[#0c0e1a] hover:bg-indigo-600/30 text-indigo-300 border border-slate-800 hover:border-indigo-500/50' 
                                          : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 shadow-xs'
                                      }`}
                                    >
                                      {btn.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className={`flex items-center justify-between gap-2 pt-1 border-t ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200'}`}>
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Style</span>
                                <select 
                                  value={f.style}
                                  onChange={(e) => updateFunction(f.id, { style: e.target.value as any })}
                                  className={`border rounded px-2 py-0.5 font-sans text-[11px] ${
                                    isDarkMode ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                  }`}
                                >
                                  <option value="solid">Solid</option>
                                  <option value="dashed">Dashed</option>
                                </select>

                                <span className={`ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Width</span>
                                <input 
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="6"
                                  value={f.strokeWidth}
                                  onChange={(e) => updateFunction(f.id, { strokeWidth: parseFloat(e.target.value) || 2.5 })}
                                  className={`w-12 border rounded px-1.5 py-0.5 font-mono text-[11px] ${
                                    isDarkMode ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                                  }`}
                                />
                              </div>

                              <div className="flex flex-col gap-1.5 pt-1">
                                <label className={`flex items-center gap-2 cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <input 
                                    type="checkbox"
                                    checked={!!f.showDerivative}
                                    onChange={(e) => updateFunction(f.id, { showDerivative: e.target.checked })}
                                    className="rounded border-slate-400 text-cyan-500 focus:ring-0"
                                  />
                                  <span className="flex items-center gap-1.5">
                                    <span>Show Derivative Curve</span>
                                    <span className="font-mono text-[10px] px-1 py-0.2 rounded font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                      f'(x)
                                    </span>
                                  </span>
                                </label>

                                <label className={`flex items-center gap-2 cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <input 
                                    type="checkbox"
                                    checked={f.showTangent}
                                    onChange={(e) => updateFunction(f.id, { showTangent: e.target.checked })}
                                    className="rounded border-slate-400 text-indigo-500 focus:ring-0"
                                  />
                                  <span>Show tangent line</span>
                                </label>

                                <label className={`flex items-center gap-2 cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <input 
                                    type="checkbox"
                                    checked={f.showExtrema}
                                    onChange={(e) => updateFunction(f.id, { showExtrema: e.target.checked })}
                                    className="rounded border-slate-400 text-purple-500 focus:ring-0"
                                  />
                                  <span>Show extremum points</span>
                                </label>

                                <label className={`flex items-center gap-2 cursor-pointer ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <input 
                                    type="checkbox"
                                    checked={!!f.showIntegral}
                                    onChange={(e) => updateFunction(f.id, {
                                      showIntegral: e.target.checked,
                                      integralLower: f.integralLower !== undefined ? f.integralLower : 0,
                                      integralUpper: f.integralUpper !== undefined ? f.integralUpper : 2,
                                      integralSubdivisions: f.integralSubdivisions || 50
                                    })}
                                    className="rounded border-slate-400 text-emerald-500 focus:ring-0"
                                  />
                                  <span>Definite Integral & Area [a, b]</span>
                                </label>
                              </div>

                              {/* --- DERIVATIVE CURVE INSPECTOR (IN FUNCTION CARD) --- */}
                              {f.showDerivative && (() => {
                                const derivInfo = getDerivativeEquation(f.equation);
                                return (
                                  <div className={`p-2.5 rounded-lg border space-y-2 mt-2 ${
                                    isDarkMode ? 'bg-[#081b24] border-cyan-500/30' : 'bg-cyan-50/60 border-cyan-200'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                                        isDarkMode ? 'text-cyan-400' : 'text-cyan-700'
                                      }`}>
                                        <Activity size={12} />
                                        <span>Derivative Curve (f'(x))</span>
                                      </div>
                                      <span className="text-[8px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono font-semibold">
                                        d/dx • Plotted in Cyan
                                      </span>
                                    </div>

                                    <div className={`p-1.5 rounded font-mono text-[11px] font-bold flex items-center justify-between ${
                                      isDarkMode ? 'bg-[#0f2937] text-cyan-300 border border-cyan-800/60' : 'bg-white text-cyan-900 border border-cyan-200 shadow-xs'
                                    }`}>
                                      <span className="truncate">f'(x) = {derivInfo.symbolic}</span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(derivInfo.symbolic);
                                          showToast(`Copied f'(x) = ${derivInfo.symbolic}`);
                                        }}
                                        className={`p-1 rounded text-[10px] transition-colors ${
                                          isDarkMode ? 'hover:bg-cyan-900/50 text-cyan-400' : 'hover:bg-cyan-100 text-cyan-700'
                                        }`}
                                        title="Copy Derivative Formula"
                                      >
                                        <Copy size={11} />
                                      </button>
                                    </div>

                                    <div className={`flex items-center justify-between gap-2 pt-1 border-t text-[10px] ${
                                      isDarkMode ? 'border-cyan-900/50 text-slate-400' : 'border-cyan-200 text-slate-600'
                                    }`}>
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-0.5 bg-cyan-500 rounded-full inline-block"></span>
                                        <span>Graph Style: <strong className="text-cyan-500 font-mono">Dashed Cyan</strong></span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (derivInfo.isValid) {
                                            const nextColor = COLORS[(functions.length) % COLORS.length];
                                            const newFn: FunctionConfig = {
                                              id: Date.now().toString(),
                                              equation: derivInfo.symbolic,
                                              color: nextColor,
                                              visible: true,
                                              style: 'solid',
                                              strokeWidth: 2.5,
                                              showDerivative: false,
                                              showTangent: false,
                                              tangentPoint: 0,
                                              showExtrema: false,
                                              showInverse: false
                                            };
                                            setFunctions(prev => [...prev, newFn]);
                                            setEditingFunctionId(newFn.id);
                                            showToast(`Added f'(x) = ${derivInfo.symbolic} as independent function`);
                                          }
                                        }}
                                        className={`py-0.5 px-2 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                                          isDarkMode 
                                            ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30' 
                                            : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-300 shadow-xs'
                                        }`}
                                      >
                                        <Plus size={10} /> Add as New f(x)
                                      </button>
                                    </div>

                                    {/* --- KEY DERIVATIVE POINTS (x, f'(x)) & CRITICAL EXTREMA (CLICK TO NAVIGATE) --- */}
                                    {(() => {
                                      // 1. Current Tangent Point
                                      const currentX = f.tangentPoint !== undefined ? f.tangentPoint : 0;
                                      const currentDerivY = getDerivative(f.equation, currentX);
                                      const currentOrigY = evaluateFunction(f.equation, currentX);

                                      // 2. Critical Extrema of f(x) (where f'(x) = 0)
                                      const fnExtrema = findExtrema(f.equation, [-20, 20]);

                                      // 3. Extrema of f'(x) (Inflection points of f(x) where f''(x) = 0)
                                      const derivExtrema = derivInfo.isValid ? findExtrema(derivInfo.symbolic, [-20, 20]) : [];

                                      // Structure points list
                                      interface DerivKeyPoint {
                                        id: string;
                                        label: string;
                                        tag: string;
                                        type: 'tangent' | 'critical' | 'inflection';
                                        x: number;
                                        derivY: number | null;
                                        origY: number | null;
                                        description: string;
                                      }

                                      const pointsList: DerivKeyPoint[] = [];

                                      // Current Tangent point
                                      pointsList.push({
                                        id: `tangent-${currentX}`,
                                        label: `Tangent Point x₀ = ${currentX.toFixed(currentX % 1 === 0 ? 0 : 2)}`,
                                        tag: 'Active Tangent',
                                        type: 'tangent',
                                        x: currentX,
                                        derivY: currentDerivY,
                                        origY: currentOrigY,
                                        description: currentDerivY !== null ? `Slope m = ${currentDerivY.toFixed(3)}` : 'Undefined slope'
                                      });

                                      // Critical Extrema (roots of derivative f'(x) = 0)
                                      fnExtrema.forEach((ex, idx) => {
                                        const dVal = getDerivative(f.equation, ex.x);
                                        pointsList.push({
                                          id: `extrema-${idx}-${ex.x}`,
                                          label: `${ex.type === 'max' ? 'Local Max' : 'Local Min'} of f(x)`,
                                          tag: `Critical (f'=0)`,
                                          type: 'critical',
                                          x: ex.x,
                                          derivY: dVal !== null ? (Math.abs(dVal) < 0.001 ? 0 : dVal) : 0,
                                          origY: ex.y,
                                          description: `f(x) = ${ex.y.toFixed(2)}, f'(x) = 0.000`
                                        });
                                      });

                                      // Inflection Points
                                      derivExtrema.forEach((inf, idx) => {
                                        if (!pointsList.some(p => Math.abs(p.x - inf.x) < 0.25)) {
                                          const origVal = evaluateFunction(f.equation, inf.x);
                                          pointsList.push({
                                            id: `inflection-${idx}-${inf.x}`,
                                            label: `Inflection Point (Max/Min Rate)`,
                                            tag: `f''(x) = 0`,
                                            type: 'inflection',
                                            x: inf.x,
                                            derivY: inf.y,
                                            origY: origVal,
                                            description: `f'(x) = ${inf.y.toFixed(2)} (Peak slope)`
                                          });
                                        }
                                      });

                                      const navigateToPoint = (pt: DerivKeyPoint) => {
                                        const targetX = pt.x;
                                        const targetY = pt.derivY !== null && isFinite(pt.derivY) ? pt.derivY : 0;

                                        // Set viewport domain centered on this x coordinate
                                        setViewportDomain([targetX - 4, targetX + 4]);

                                        // Center range to display both derivative curve point and primitive function value
                                        if (pt.origY !== null && isFinite(pt.origY)) {
                                          const minY = Math.min(targetY, pt.origY);
                                          const maxY = Math.max(targetY, pt.origY);
                                          const midY = (minY + maxY) / 2;
                                          const spanY = Math.max(maxY - minY + 3, 6);
                                          setViewportRange([midY - spanY / 2, midY + spanY / 2]);
                                        } else {
                                          setViewportRange([targetY - 3, targetY + 3]);
                                        }

                                        // Snap active tangent line to this coordinate
                                        updateFunction(f.id, {
                                          showTangent: true,
                                          tangentPoint: targetX
                                        });

                                        showToast(`Navigated graph to (x: ${targetX.toFixed(2)}, f'(x): ${targetY.toFixed(2)})`);
                                      };

                                      return (
                                        <div className="pt-2 border-t border-cyan-900/40 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                                              isDarkMode ? 'text-cyan-400' : 'text-cyan-800'
                                            }`}>
                                              <Crosshair size={11} />
                                              <span>Points on Derivative (x, f'(x))</span>
                                            </span>
                                            <span className={`text-[8.5px] font-sans font-medium px-1.5 py-0.5 rounded ${
                                              isDarkMode ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60' : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                            }`}>
                                              Click to navigate
                                            </span>
                                          </div>

                                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-0.5 custom-scrollbar">
                                            {pointsList.map((pt) => {
                                              const isTangent = pt.type === 'tangent';
                                              const isCritical = pt.type === 'critical';

                                              return (
                                                <button
                                                  key={pt.id}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigateToPoint(pt);
                                                  }}
                                                  title={`Click to navigate graph to x = ${pt.x.toFixed(2)}, f'(x) = ${pt.derivY !== null ? pt.derivY.toFixed(2) : '?'}`}
                                                  className={`w-full text-left p-2 rounded-lg border transition-all flex items-center justify-between group cursor-pointer ${
                                                    isDarkMode 
                                                      ? 'bg-[#081822] hover:bg-[#0c2434] border-cyan-900/60 hover:border-cyan-500/60 text-slate-200 shadow-xs' 
                                                      : 'bg-white hover:bg-cyan-50/80 border-cyan-200 hover:border-cyan-400 text-slate-800 shadow-xs'
                                                  }`}
                                                >
                                                  <div className="space-y-0.5 min-w-0 pr-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className="font-mono font-bold text-[11px] text-cyan-600 dark:text-cyan-300">
                                                        ({pt.x.toFixed(2)}, {pt.derivY !== null ? pt.derivY.toFixed(2) : 'Undefined'})
                                                      </span>
                                                      <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase font-sans ${
                                                        isTangent 
                                                          ? (isDarkMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-100 text-amber-800 border border-amber-200')
                                                          : isCritical 
                                                            ? (isDarkMode ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-100 text-purple-800 border border-purple-200')
                                                            : (isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                                                      }`}>
                                                        {pt.tag}
                                                      </span>
                                                    </div>
                                                    <div className={`text-[9.5px] font-sans flex items-center gap-1.5 ${
                                                      isDarkMode ? 'text-slate-400' : 'text-slate-500'
                                                    }`}>
                                                      <span>{pt.label}</span>
                                                      <span>•</span>
                                                      <span className="font-mono">{pt.description}</span>
                                                    </div>
                                                  </div>

                                                  <div className={`shrink-0 flex items-center gap-1 text-[9.5px] font-sans font-medium px-2 py-1 rounded-md border transition-all ${
                                                    isDarkMode 
                                                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800/60 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-500' 
                                                      : 'bg-cyan-50 text-cyan-800 border-cyan-200 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600'
                                                  }`}>
                                                    <Focus size={10} />
                                                    <span>Navigate</span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* --- COMPUTE INTEGRAL OF DERIVATIVE (FTC DEMONSTRATION) --- */}
                                    <div className="pt-2 border-t border-cyan-900/40 space-y-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateFunction(f.id, {
                                            showDerivativeIntegral: !f.showDerivativeIntegral,
                                            derivativeIntegralLower: f.derivativeIntegralLower !== undefined ? f.derivativeIntegralLower : 0,
                                            derivativeIntegralUpper: f.derivativeIntegralUpper !== undefined ? f.derivativeIntegralUpper : 2,
                                          });
                                        }}
                                        className={`w-full py-1.5 px-2.5 rounded-lg text-[10.5px] font-semibold flex items-center justify-between transition-all ${
                                          f.showDerivativeIntegral
                                            ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                                            : (isDarkMode
                                                ? 'bg-[#0f2838] hover:bg-[#153448] text-cyan-300 border border-cyan-500/40 shadow-xs'
                                                : 'bg-cyan-100/80 hover:bg-cyan-200/80 text-cyan-900 border border-cyan-300 shadow-xs')
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Sigma size={13} />
                                          <span>Compute Integral of Derivative ∫ f'(x) dx</span>
                                        </div>
                                        <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                          f.showDerivativeIntegral
                                            ? 'bg-white/20 text-white'
                                            : (isDarkMode ? 'bg-cyan-900/50 text-cyan-300' : 'bg-cyan-200 text-cyan-900')
                                        }`}>
                                          {f.showDerivativeIntegral ? 'Hide FTC' : 'Fundamental Theorem of Calculus'}
                                        </span>
                                      </button>

                                      {f.showDerivativeIntegral && (() => {
                                        const a = f.derivativeIntegralLower !== undefined ? f.derivativeIntegralLower : 0;
                                        const b = f.derivativeIntegralUpper !== undefined ? f.derivativeIntegralUpper : 2;

                                        // 1. Definite integral of the derivative curve ∫_a^b f'(x) dx
                                        const derivIntRes = computeDefiniteIntegral(
                                          (x) => getDerivative(f.equation, x),
                                          a,
                                          b,
                                          80
                                        );

                                        // 2. Evaluation of the original primitive function f(b) - f(a)
                                        const fa = evaluateFunction(f.equation, a);
                                        const fb = evaluateFunction(f.equation, b);
                                        const netChange = (fb !== null && fa !== null && isFinite(fb) && isFinite(fa))
                                          ? fb - fa
                                          : null;

                                        const integralVal = derivIntRes.signedValue;
                                        const diff = (integralVal !== null && netChange !== null)
                                          ? Math.abs(integralVal - netChange)
                                          : null;
                                        const isVerified = diff !== null && diff < 0.02;

                                        return (
                                          <div className={`p-2.5 rounded-lg border space-y-2.5 ${
                                            isDarkMode ? 'bg-[#05141d] border-cyan-500/40' : 'bg-white border-cyan-200 shadow-xs'
                                          }`}>
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-[10px] uppercase tracking-wider text-cyan-500 dark:text-cyan-400 flex items-center gap-1.5">
                                                <Activity size={11} />
                                                <span>Fundamental Theorem of Calculus</span>
                                              </span>
                                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                                isVerified
                                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                  : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                              }`}>
                                                {isVerified ? '✓ Theorem Verified' : 'Evaluating...'}
                                              </span>
                                            </div>

                                            {/* Bound inputs [a, b] */}
                                            <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                                              <div>
                                                <span className={`block text-[9px] mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Lower Bound (a):</span>
                                                <input
                                                  type="number"
                                                  step="0.5"
                                                  value={a}
                                                  onChange={(e) => updateFunction(f.id, { derivativeIntegralLower: parseFloat(e.target.value) || 0 })}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className={`w-full border rounded px-1.5 py-0.5 font-mono ${
                                                    isDarkMode ? 'bg-[#0e222e] border-slate-700 text-cyan-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                                                  }`}
                                                />
                                              </div>
                                              <div>
                                                <span className={`block text-[9px] mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Upper Bound (b):</span>
                                                <input
                                                  type="number"
                                                  step="0.5"
                                                  value={b}
                                                  onChange={(e) => updateFunction(f.id, { derivativeIntegralUpper: parseFloat(e.target.value) || 0 })}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className={`w-full border rounded px-1.5 py-0.5 font-mono ${
                                                    isDarkMode ? 'bg-[#0e222e] border-slate-700 text-cyan-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                                                  }`}
                                                />
                                              </div>
                                            </div>

                                            {/* Quick Bound Presets */}
                                            <div className="flex items-center gap-1 font-mono text-[9px]">
                                              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Presets:</span>
                                              {[
                                                { label: '[0, 1]', a: 0, b: 1 },
                                                { label: '[0, 2]', a: 0, b: 2 },
                                                { label: '[-1, 1]', a: -1, b: 1 },
                                                { label: '[1, 3]', a: 1, b: 3 },
                                              ].map(preset => (
                                                <button
                                                  key={preset.label}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateFunction(f.id, {
                                                      derivativeIntegralLower: preset.a,
                                                      derivativeIntegralUpper: preset.b
                                                    });
                                                  }}
                                                  className={`px-1.5 py-0.5 rounded border transition-all ${
                                                    a === preset.a && b === preset.b
                                                      ? 'bg-cyan-500 text-white border-cyan-400'
                                                      : isDarkMode 
                                                        ? 'bg-slate-800/80 text-cyan-300 border-slate-700 hover:border-cyan-500/50' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:border-cyan-300'
                                                  }`}
                                                >
                                                  {preset.label}
                                                </button>
                                              ))}
                                            </div>

                                            {/* Live Theorem Comparison Box */}
                                            <div className={`p-2 rounded font-mono text-[10.5px] space-y-1.5 border ${
                                              isDarkMode ? 'bg-[#0b1d28] border-cyan-500/30 text-slate-200' : 'bg-cyan-50/70 border-cyan-200 text-slate-800'
                                            }`}>
                                              {/* Definite Integral */}
                                              <div className="flex items-center justify-between">
                                                <span className="text-cyan-600 dark:text-cyan-300 font-semibold">
                                                  ∫<sub>{a}</sub><sup>{b}</sup> f'(x) dx:
                                                </span>
                                                <span className="font-bold text-cyan-600 dark:text-cyan-300">
                                                  {integralVal !== null ? integralVal.toFixed(4) : 'Undefined'}
                                                </span>
                                              </div>

                                              {/* Primitive Evaluation */}
                                              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                                <span>f({b}) − f({a}):</span>
                                                <span>
                                                  {fb !== null ? fb.toFixed(3) : '?'} − ({fa !== null ? fa.toFixed(3) : '?'})
                                                </span>
                                              </div>

                                              {/* Net Change f(b) - f(a) */}
                                              <div className="flex items-center justify-between pt-1 border-t border-cyan-800/30">
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                  Net Change f({b}) − f({a}):
                                                </span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                  {netChange !== null ? netChange.toFixed(4) : 'Undefined'}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Educational theorem banner */}
                                            <div className={`p-1.5 rounded text-[9.5px] space-y-0.5 ${
                                              isDarkMode ? 'bg-cyan-950/40 text-cyan-200 border border-cyan-900/60' : 'bg-cyan-100/50 text-cyan-900 border border-cyan-200'
                                            }`}>
                                              <div className="font-mono font-bold text-center">
                                                ∫<sub>a</sub><sup>b</sup> f'(x) dx = f(b) − f(a)
                                              </div>
                                              <div className="text-[9px] text-center opacity-80">
                                                The total area under the derivative curve over [{a}, {b}] exactly matches the net displacement Δy = f({b}) − f({a}).
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* --- DEFINITE INTEGRAL INSPECTOR (IN FUNCTION CARD) --- */}
                              {f.showIntegral && (() => {
                                const a = f.integralLower !== undefined ? f.integralLower : 0;
                                const b = f.integralUpper !== undefined ? f.integralUpper : 2;
                                const intRes = computeDefiniteIntegral((x) => evaluateFunction(f.equation, x), a, b, f.integralSubdivisions || 50);

                                return (
                                  <div className={`p-2.5 rounded-lg border space-y-2 mt-2 ${
                                    isDarkMode ? 'bg-[#0c161c] border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-200'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                                        isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                      }`}>
                                        <Sigma size={12} />
                                        <span>Definite Integral [a, b]</span>
                                      </div>
                                      <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-sans font-semibold">
                                        Shaded on Graph
                                      </span>
                                    </div>

                                    {/* Bound Inputs */}
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                      <div>
                                        <span className={`text-[10px] block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Lower bound (a):</span>
                                        <input
                                          type="number"
                                          step="0.25"
                                          value={a}
                                          onChange={(e) => updateFunction(f.id, { integralLower: parseFloat(e.target.value) || 0 })}
                                          className={`w-full border rounded px-2 py-1 text-xs font-mono ${
                                            isDarkMode ? 'bg-[#141e24] border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
                                          }`}
                                        />
                                      </div>
                                      <div>
                                        <span className={`text-[10px] block mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Upper bound (b):</span>
                                        <input
                                          type="number"
                                          step="0.25"
                                          value={b}
                                          onChange={(e) => updateFunction(f.id, { integralUpper: parseFloat(e.target.value) || 0 })}
                                          className={`w-full border rounded px-2 py-1 text-xs font-mono ${
                                            isDarkMode ? 'bg-[#141e24] border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-800'
                                          }`}
                                        />
                                      </div>
                                    </div>

                                    {/* Quick Result Badge */}
                                    <div className={`p-2 rounded font-mono text-xs font-bold flex items-center justify-between border ${
                                      isDarkMode ? 'bg-[#122223] text-emerald-300 border-emerald-500/30' : 'bg-white text-emerald-800 border-emerald-200'
                                    }`}>
                                      <span>∫ f(x) dx:</span>
                                      <span>{intRes.signedValue !== null ? intRes.signedValue.toFixed(4) : 'Undefined'}</span>
                                    </div>

                                    {/* Strips checkbox */}
                                    <label className={`flex items-center gap-1.5 cursor-pointer text-[10px] font-sans ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                      <input
                                        type="checkbox"
                                        checked={!!f.showRiemannStrips}
                                        onChange={(e) => updateFunction(f.id, { showRiemannStrips: e.target.checked })}
                                        className="rounded border-slate-400 text-emerald-500 focus:ring-0"
                                      />
                                      <span>Show Riemann Partition Strips</span>
                                    </label>
                                  </div>
                                );
                              })()}

                              {/* --- INVERSE FUNCTION INSPECTOR --- */}
                              {(() => {
                                const invInfo = getInverseEquationInfo(f.equation);
                                return (
                                  <div className={`p-2.5 rounded-lg border space-y-2 mt-2 ${
                                    isDarkMode ? 'bg-[#0c0e1a] border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider ${
                                        isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                                      }`}>
                                        <RotateCcw size={11} />
                                        <span>Inverse Function Inspector</span>
                                      </div>
                                      {invInfo.isExact ? (
                                        <span className="text-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-sans font-semibold">
                                          Exact
                                        </span>
                                      ) : (
                                        <span className="text-[8px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-1 py-0.2 rounded font-sans font-semibold">
                                          Parametric
                                        </span>
                                      )}
                                    </div>

                                    <div className={`p-1.5 rounded font-mono text-[11px] font-bold ${
                                      isDarkMode ? 'bg-[#14182b] text-indigo-300' : 'bg-white text-indigo-800 border border-indigo-100 shadow-xs'
                                    }`}>
                                      {invInfo.displayName}
                                    </div>

                                    <div className={`text-[9px] font-sans space-y-0.5 border-t pt-1 ${
                                      isDarkMode ? 'text-slate-400 border-slate-800/80' : 'text-slate-600 border-slate-200'
                                    }`}>
                                      <div><strong className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>Parametric:</strong> {invInfo.parametricForm}</div>
                                      <div><strong className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>Domain:</strong> {invInfo.domainConstraint}</div>
                                    </div>

                                    <div className={`grid grid-cols-2 gap-1.5 pt-1 border-t font-sans ${
                                      isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                                    }`}>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                                            const nextColor = COLORS[(functions.length) % COLORS.length];
                                            const newFn: FunctionConfig = {
                                              id: Date.now().toString(),
                                              equation: invInfo.symbolicEquation,
                                              color: nextColor,
                                              visible: true,
                                              style: 'dashed',
                                              strokeWidth: 2.5,
                                              showDerivative: false,
                                              showTangent: false,
                                              tangentPoint: 0,
                                              showExtrema: false,
                                              showInverse: false
                                            };
                                            setFunctions(prev => [...prev, newFn]);
                                            setEditingFunctionId(newFn.id);
                                            showToast(`Added ${invInfo.symbolicEquation} as independent function`);
                                          } else {
                                            showToast('Parametric reflection active on canvas across y = x');
                                          }
                                        }}
                                        className={`py-1 px-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                                          isDarkMode 
                                            ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' 
                                            : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-300 shadow-xs'
                                        }`}
                                      >
                                        <Plus size={10} /> + Add as New f(x)
                                      </button>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                                            updateFunction(f.id, { equation: invInfo.symbolicEquation, showInverse: false });
                                            showToast(`Inverted in-place to ${invInfo.symbolicEquation}`);
                                          } else {
                                            showToast('Expression inverted parametrically');
                                          }
                                        }}
                                        className={`py-1 px-1.5 rounded text-[10px] font-semibold flex items-center justify-center gap-1 transition-all ${
                                          isDarkMode 
                                            ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30' 
                                            : 'bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 shadow-xs'
                                        }`}
                                      >
                                        <RotateCcw size={10} /> Invert In-Place
                                      </button>
                                    </div>

                                    <label className={`flex items-center gap-1.5 cursor-pointer pt-1 border-t font-sans text-[10px] ${
                                      isDarkMode ? 'text-slate-300 border-slate-800/80' : 'text-slate-700 border-slate-200'
                                    }`}>
                                      <input 
                                        type="checkbox"
                                        checked={f.showInverse}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          updateFunction(f.id, { showInverse: e.target.checked });
                                        }}
                                        className="rounded border-slate-400 text-indigo-500 focus:ring-0"
                                      />
                                      <span>Show reflected curve across y = x</span>
                                    </label>
                                  </div>
                                );
                              })()}
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={`pt-2 border-t ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
                  <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 flex items-center justify-between ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    <span>Quick Actions</span>
                    {activeQuickAction && (
                      <span className={`text-[9px] font-semibold lowercase px-1.5 py-0.5 rounded border ${
                        isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                      }`}>
                        {activeQuickAction} active
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 'line', label: 'Draw Line', icon: Ruler, color: isDarkMode ? 'text-sky-400' : 'text-sky-600' },
                      { id: 'circle', label: 'Circle', icon: CircleDot, color: isDarkMode ? 'text-blue-400' : 'text-blue-600' },
                      { id: 'semicircle', label: 'Semi-Circle', icon: Compass, color: isDarkMode ? 'text-pink-400' : 'text-pink-600' },
                      { id: 'integral', label: 'Integral', icon: Sigma, color: isDarkMode ? 'text-emerald-400' : 'text-emerald-600' },
                      { id: 'tangent', label: 'Tangent', icon: Activity, color: isDarkMode ? 'text-amber-400' : 'text-amber-600' },
                      { id: 'point', label: 'Point Pin', icon: Crosshair, color: isDarkMode ? 'text-cyan-400' : 'text-cyan-600' },
                      { id: 'inverse', label: 'Inverse', icon: RotateCcw, color: isDarkMode ? 'text-indigo-400' : 'text-indigo-600' },
                      { id: 'intersect', label: 'Intersect', icon: GitCommit, color: isDarkMode ? 'text-purple-400' : 'text-purple-600' },
                      { id: 'reset', label: 'Reset All', icon: RotateCcw, color: isDarkMode ? 'text-slate-400' : 'text-slate-600' },
                    ].map(action => {
                      const Icon = action.icon;
                      const isActive = activeQuickAction === action.id;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action.id)}
                          className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all relative ${
                            isActive 
                              ? (isDarkMode 
                                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-md shadow-indigo-500/20' 
                                  : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20')
                              : (isDarkMode 
                                  ? 'bg-[#121524] border-slate-800/80 hover:bg-slate-800/60 text-slate-300 hover:text-white' 
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-xs')
                          }`}
                          title={`Activate ${action.label} Quick Action`}
                        >
                          <Icon size={14} className={isActive ? (isDarkMode ? 'text-indigo-300' : 'text-white') : action.color} />
                          <span className="text-[9.5px] font-medium">{action.label}</span>
                          {isActive && (
                            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-2 animate-pulse ${
                              isDarkMode ? 'ring-[#0f1222]' : 'ring-white'
                            }`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* --- GEOMETRIC SHAPES & DRAWN ELEMENTS MANAGER --- */}
                {drawnShapes.length > 0 && (
                  <section className={`pt-3 border-t ${isDarkMode ? 'border-slate-800/80' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        <Shapes size={12} className="text-sky-400" />
                        <span>Drawn Geometric Shapes ({drawnShapes.length})</span>
                      </h3>
                      <button
                        onClick={() => {
                          recordHistory();
                          setDrawnShapes([]);
                          showToast('Cleared all geometric shapes');
                        }}
                        className="text-[9.5px] text-red-400 hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={10} />
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {drawnShapes.map(shape => {
                        let equationText = shape.label;
                        if (shape.type === 'line' && shape.points && shape.points.length >= 2) {
                          equationText = formatLineEquation(shape.points[0], shape.points[1]);
                        } else if (shape.type === 'circle' && shape.center && shape.radius) {
                          equationText = formatCircleEquation(shape.center, shape.radius);
                        } else if (shape.type === 'semicircle' && shape.center && shape.radius) {
                          equationText = formatSemicircleEquation(shape.center, shape.radius, shape.semiOrientation);
                        }

                        return (
                          <div
                            key={shape.id}
                            className={`p-2.5 rounded-xl border flex flex-col gap-2 text-xs font-mono transition-all ${
                              isDarkMode ? 'bg-[#121524] border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 truncate">
                                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: shape.color }} />
                                <div className="flex flex-col truncate">
                                  <span className={`font-bold text-[11px] truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {equationText}
                                  </span>
                                  <span className="text-[9px] text-slate-400 capitalize">
                                    {shape.type} {shape.type === 'line' ? `(${shape.lineMode || 'segment'})` : shape.type === 'semicircle' ? `(${shape.semiOrientation || 'top'})` : ''}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(equationText);
                                    showToast(`Copied ${equationText}`);
                                  }}
                                  className={`p-1 rounded ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                  title="Copy Equation"
                                >
                                  <Copy size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    recordHistory();
                                    setDrawnShapes(prev => prev.map(s => s.id === shape.id ? { ...s, visible: !s.visible } : s));
                                  }}
                                  className={`p-1 rounded ${shape.visible ? 'text-sky-400' : 'text-slate-500'}`}
                                  title="Toggle Visibility"
                                >
                                  {shape.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                                <button
                                  onClick={() => {
                                    recordHistory();
                                    setDrawnShapes(prev => prev.filter(s => s.id !== shape.id));
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-red-500"
                                  title="Delete Shape"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Shape Rotation Degree Angle Slider */}
                            <div className={`pt-2 border-t flex flex-col gap-1.5 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                              <div className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-1 text-slate-400">
                                  <RotateCw size={11} className="text-sky-400" />
                                  <span className="font-sans font-medium">Rotation Angle:</span>
                                </div>
                                <span className={`font-mono font-bold px-1.5 py-0.2 rounded border ${
                                  isDarkMode ? 'bg-[#181c30] text-sky-400 border-slate-700' : 'bg-white text-sky-600 border-slate-300'
                                }`}>
                                  {Math.round(shape.rotation || 0)}°
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="0"
                                  max="360"
                                  step="1"
                                  value={shape.rotation || 0}
                                  onPointerDown={() => recordHistory()}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setDrawnShapes(prev => prev.map(s => s.id === shape.id ? { ...s, rotation: val } : s));
                                  }}
                                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                                />
                                <div className="flex items-center gap-0.5 shrink-0">
                                  {[0, 45, 90, 180, 270].map(deg => (
                                    <button
                                      key={deg}
                                      onClick={() => {
                                        recordHistory();
                                        setDrawnShapes(prev => prev.map(s => s.id === shape.id ? { ...s, rotation: deg } : s));
                                      }}
                                      className={`px-1 py-0.5 rounded text-[8.5px] font-mono border transition-all ${
                                        Math.round(shape.rotation || 0) === deg
                                          ? 'bg-sky-600 text-white border-sky-400 font-bold'
                                          : (isDarkMode ? 'bg-[#181c30] text-slate-400 border-slate-700 hover:text-white' : 'bg-white text-slate-600 border-slate-300')
                                      }`}
                                    >
                                      {deg}°
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* --- TAB 2: ANALYSIS --- */}
            {activeTab === 'Analysis' && (
              <div className="space-y-4">
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>Select Active Function</label>
                  <select 
                    value={editingFunctionId || functions[0]?.id}
                    onChange={(e) => setEditingFunctionId(e.target.value)}
                    className={`w-full text-xs font-mono rounded-lg p-2 outline-none border transition-colors ${
                      isDarkMode 
                        ? 'bg-[#121524] border-slate-700/80 text-indigo-300' 
                        : 'bg-slate-50 border-slate-300 text-indigo-700'
                    }`}
                  >
                    {functions.map((f, i) => (
                      <option key={f.id} value={f.id}>
                        {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`} = {f.equation}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const activeFn = functions.find(f => f.id === editingFunctionId) || functions[0];
                  if (!activeFn) return <p className="text-xs text-slate-500">No active function selected.</p>;

                  const yInt = evaluateFunction(activeFn.equation, 0);
                  const roots = findRoots(activeFn.equation, [-20, 20]);
                  const extrema = findExtrema(activeFn.equation, [-20, 20]);
                  const evalY = evaluateFunction(activeFn.equation, evalX);
                  const slope = getDerivative(activeFn.equation, evalX);

                  return (
                    <div className="space-y-4 text-xs font-mono">
                      {/* Overview Card */}
                      <div className={`p-3 rounded-xl border space-y-2 ${
                        isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className={`flex items-center justify-between border-b pb-1.5 ${
                          isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                        }`}>
                          <span className={`font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                            f(x) = {activeFn.equation}
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeFn.color }} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                          <div>
                            <span className={`block text-[9px] uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Y-Intercept</span>
                            <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {yInt !== null ? `(0, ${yInt.toFixed(2)})` : 'Undefined'}
                            </span>
                          </div>
                          <div>
                            <span className={`block text-[9px] uppercase ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Roots Found</span>
                            <span className="text-emerald-500 font-bold">{roots.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Calculated Roots */}
                      <div className={`p-3 rounded-xl border space-y-2 ${
                        isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <h4 className={`text-[10px] font-bold uppercase tracking-wider flex items-center justify-between ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          <span>Calculated Roots (x-intercepts)</span>
                          <span className="text-emerald-500 text-[9px]">{roots.length} found</span>
                        </h4>
                        {roots.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {roots.map((r, idx) => (
                              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
                                isDarkMode ? 'bg-[#0c0e1a] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
                              }`}>
                                <span>x = {r.toFixed(3)}</span>
                                <button 
                                  onClick={() => {
                                    setViewportDomain([r - 4, r + 4]);
                                    setViewportRange([-3, 3]);
                                    showToast(`Focused on root x = ${r.toFixed(2)}`);
                                  }}
                                  className={`text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                                    isDarkMode 
                                      ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border-indigo-500/20' 
                                      : 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 border-indigo-200'
                                  }`}
                                >
                                  <Focus size={10} /> Focus
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No real roots detected in [-20, 20]</p>
                        )}
                      </div>

                      {/* Calculated Extrema */}
                      <div className={`p-3 rounded-xl border space-y-2 ${
                        isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>Extrema Points (Min/Max)</h4>
                        {extrema.length > 0 ? (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {extrema.map((ex, idx) => (
                              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${
                                isDarkMode ? 'bg-[#0c0e1a] border-slate-800' : 'bg-white border-slate-200'
                              }`}>
                                <div>
                                  <span className={`text-[9px] uppercase px-1 py-0.5 rounded mr-1.5 font-bold ${
                                    ex.type === 'min' 
                                      ? (isDarkMode ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800') 
                                      : (isDarkMode ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-800')
                                  }`}>
                                    {ex.type}
                                  </span>
                                  <span className={isDarkMode ? 'text-slate-300' : 'text-slate-800'}>
                                    ({ex.x.toFixed(2)}, {ex.y.toFixed(2)})
                                  </span>
                                </div>
                                <button 
                                  onClick={() => {
                                    setViewportDomain([ex.x - 4, ex.x + 4]);
                                    setViewportRange([ex.y - 4, ex.y + 4]);
                                    showToast(`Focused on ${ex.type} at (${ex.x.toFixed(1)}, ${ex.y.toFixed(1)})`);
                                  }}
                                  className={`text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                                    isDarkMode 
                                      ? 'text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border-indigo-500/20' 
                                      : 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 border-indigo-200'
                                  }`}
                                >
                                  <Focus size={10} /> Focus
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">No local extrema detected in [-20, 20]</p>
                        )}
                      </div>

                      {/* Derivative & Tangent Evaluator */}
                      <div className={`p-3 rounded-xl border space-y-2.5 ${
                        isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDarkMode ? 'text-slate-400' : 'text-slate-600'
                        }`}>Derivative & Tangent Inspector</h4>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>x₀ =</span>
                          <input 
                            type="number"
                            step="0.5"
                            value={evalX}
                            onChange={(e) => setEvalX(parseFloat(e.target.value) || 0)}
                            className={`w-16 p-1 rounded text-[11px] border ${
                              isDarkMode 
                                ? 'bg-[#0c0e1a] border-slate-700/80 text-indigo-300' 
                                : 'bg-white border-slate-300 text-indigo-700'
                            }`}
                          />
                          <input 
                            type="range"
                            min="-10"
                            max="10"
                            step="0.1"
                            value={evalX}
                            onChange={(e) => setEvalX(parseFloat(e.target.value))}
                            className="flex-1 accent-indigo-500"
                          />
                        </div>

                        <div className={`space-y-1 text-[11px] pt-1 border-t ${
                          isDarkMode ? 'border-slate-800' : 'border-slate-200'
                        }`}>
                          <div className={`flex justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            <span>f({evalX.toFixed(1)}) =</span>
                            <span className={`font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                              {evalY !== null ? evalY.toFixed(3) : 'Undefined'}
                            </span>
                          </div>
                          <div className={`flex justify-between ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            <span>f'({evalX.toFixed(1)}) slope =</span>
                            <span className="text-amber-500 font-bold">{slope !== null ? slope.toFixed(3) : 'Undefined'}</span>
                          </div>
                          {evalY !== null && slope !== null && (
                            <div className={`p-1.5 rounded text-[10px] text-center font-mono mt-1 ${
                              isDarkMode ? 'bg-[#0c0e1a] text-purple-300' : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              Tangent: y = {slope.toFixed(2)}(x - {evalX.toFixed(1)}) + {evalY.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button 
                            onClick={() => {
                              updateFunction(activeFn.id, { showTangent: true, tangentPoint: evalX });
                              showToast(`Tangent set at x₀ = ${evalX.toFixed(1)}`);
                            }}
                            className={`py-1.5 rounded-lg text-[11px] font-sans font-semibold border transition-all ${
                              isDarkMode 
                                ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/30' 
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            Set Tangent (x₀)
                          </button>

                          <button 
                            onClick={() => {
                              updateFunction(activeFn.id, { showDerivative: !activeFn.showDerivative });
                              showToast(activeFn.showDerivative ? "Derivative curve hidden" : "Derivative curve f'(x) plotted in Cyan");
                            }}
                            className={`py-1.5 rounded-lg text-[11px] font-sans font-semibold border transition-all flex items-center justify-center gap-1 ${
                              activeFn.showDerivative
                                ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                                : (isDarkMode 
                                    ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/30' 
                                    : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300')
                            }`}
                          >
                            {activeFn.showDerivative ? "f'(x) Canvas: ON" : "Plot f'(x) Curve"}
                          </button>
                        </div>
                      </div>

                      {/* Dedicated Inverse Function Analysis Card */}
                      {(() => {
                        const invInfo = getInverseEquationInfo(activeFn.equation);
                        const x0 = evalX;
                        const y0 = evaluateFunction(activeFn.equation, x0);
                        const slopeF = getDerivative(activeFn.equation, x0);
                        const slopeInv = slopeF !== null && Math.abs(slopeF) > 1e-6 ? (1 / slopeF) : null;

                        return (
                          <div className={`p-3 rounded-xl border space-y-3 ${
                            isDarkMode ? 'bg-[#121524] border-indigo-500/40' : 'bg-indigo-50/50 border-indigo-200'
                          }`}>
                            <div className={`flex items-center justify-between border-b pb-2 ${
                              isDarkMode ? 'border-slate-800/80' : 'border-indigo-100'
                            }`}>
                              <div className="flex items-center gap-2">
                                <RotateCcw size={14} className={isDarkMode ? 'text-indigo-400' : 'text-indigo-600'} />
                                <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                                }`}>
                                  Inverse Function Analysis
                                </h4>
                              </div>
                              <button
                                onClick={() => {
                                  updateFunction(activeFn.id, { showInverse: !activeFn.showInverse });
                                  showToast(activeFn.showInverse ? 'Inverse curve hidden' : 'Inverse curve displayed (reflection across y = x)');
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  activeFn.showInverse 
                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm shadow-indigo-500/30' 
                                    : (isDarkMode 
                                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
                                }`}
                              >
                                {activeFn.showInverse ? 'Canvas: ON' : 'Toggle Inverse'}
                              </button>
                            </div>

                            {/* Inverted Equation and Badge */}
                            <div className={`p-2.5 rounded-lg border space-y-1.5 ${
                              isDarkMode ? 'bg-[#0c0e1a] border-slate-800' : 'bg-white border-indigo-100'
                            }`}>
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Inverted Form:</span>
                                {invInfo.isExact ? (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold border ${
                                    isDarkMode 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    Exact Symbolic
                                  </span>
                                ) : (
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans font-semibold border ${
                                    isDarkMode 
                                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  }`}>
                                    Parametric Reflection
                                  </span>
                                )}
                              </div>
                              <div className={`font-bold text-xs p-2 rounded border font-mono ${
                                isDarkMode 
                                  ? 'bg-[#161a2e] text-indigo-300 border-indigo-500/30' 
                                  : 'bg-indigo-50/80 text-indigo-900 border-indigo-200'
                              }`}>
                                {invInfo.displayName}
                              </div>
                              <p className={`text-[10px] font-sans ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{invInfo.notes}</p>
                            </div>

                            {/* Domain & Range Constraints */}
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                              <div className={`p-2 rounded-lg border ${
                                isDarkMode ? 'bg-[#0c0e1a] border-slate-800/80' : 'bg-white border-slate-200'
                              }`}>
                                <span className={`uppercase block font-bold text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>f(x) Domain → f⁻¹ Range</span>
                                <span className={`font-mono font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{invInfo.rangeConstraint}</span>
                              </div>
                              <div className={`p-2 rounded-lg border ${
                                isDarkMode ? 'bg-[#0c0e1a] border-slate-800/80' : 'bg-white border-slate-200'
                              }`}>
                                <span className={`uppercase block font-bold text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>f(x) Range → f⁻¹ Domain</span>
                                <span className={`font-mono font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{invInfo.domainConstraint}</span>
                              </div>
                            </div>

                            {/* Point Reflection & Derivative Calculus Inspector */}
                            <div className={`p-2.5 rounded-lg border space-y-1.5 ${
                              isDarkMode ? 'bg-[#0c0e1a] border-slate-800' : 'bg-white border-slate-200'
                            }`}>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                  Point Reflection at x₀ = {x0.toFixed(1)}
                                </span>
                                <span className={`font-mono ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>Axis: y = x</span>
                              </div>

                              <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between">
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Point on f(x):</span>
                                  <span className={`font-bold font-mono ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                    {y0 !== null ? `(${x0.toFixed(2)}, ${y0.toFixed(2)})` : 'Undefined'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Reflected on f⁻¹(x):</span>
                                  <span className={`font-bold font-mono ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                    {y0 !== null ? `(${y0.toFixed(2)}, ${x0.toFixed(2)})` : 'Undefined'}
                                  </span>
                                </div>
                                <div className={`flex justify-between pt-1 border-t text-[10px] ${
                                  isDarkMode ? 'border-slate-800/80' : 'border-slate-200'
                                }`}>
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>f'(x₀) slope:</span>
                                  <span className="text-amber-500 font-mono font-bold">{slopeF !== null ? slopeF.toFixed(3) : '—'}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>(f⁻¹)'(y₀) = 1 / f'(x₀):</span>
                                  <span className="text-emerald-500 font-mono font-bold">{slopeInv !== null ? slopeInv.toFixed(3) : 'Undefined / Vertical'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
                              <button
                                onClick={() => {
                                  if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                                    recordHistory();
                                    const nextColor = COLORS[(functions.length) % COLORS.length];
                                    const newFn: FunctionConfig = {
                                      id: Date.now().toString(),
                                      equation: invInfo.symbolicEquation,
                                      color: nextColor,
                                      visible: true,
                                      style: 'dashed',
                                      strokeWidth: 2.5,
                                      showDerivative: false,
                                      showTangent: false,
                                      tangentPoint: 0,
                                      showExtrema: false,
                                      showInverse: false
                                    };
                                    setFunctions(prev => [...prev, newFn]);
                                    setEditingFunctionId(newFn.id);
                                    showToast(`Added ${invInfo.symbolicEquation} to functions`);
                                  } else {
                                    showToast('Parametric inverse plotted on canvas');
                                  }
                                }}
                                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
                                  isDarkMode 
                                    ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30' 
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                <Plus size={12} /> Add as New f(x)
                              </button>

                              <button
                                onClick={() => {
                                  if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                                    updateFunction(activeFn.id, { equation: invInfo.symbolicEquation, showInverse: false });
                                    showToast(`Inverted in-place to ${invInfo.symbolicEquation}`);
                                  } else {
                                    showToast('Expression inverted parametrically');
                                  }
                                }}
                                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border ${
                                  isDarkMode 
                                    ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/30' 
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                                }`}
                              >
                                <RotateCcw size={12} /> Invert In-Place
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* --- DEFINITE INTEGRAL & AREA CALCULATOR CARD IN ANALYSIS --- */}
                      {(() => {
                        const a = activeFn.integralLower !== undefined ? activeFn.integralLower : 0;
                        const b = activeFn.integralUpper !== undefined ? activeFn.integralUpper : 2;
                        const n = activeFn.integralSubdivisions || 50;
                        const intResult = computeDefiniteIntegral((x) => evaluateFunction(activeFn.equation, x), a, b, n);
                        const isShadedOnCanvas = !!activeFn.showIntegral;

                        return (
                          <div className={`p-3 rounded-xl border space-y-3 ${
                            isDarkMode ? 'bg-[#121c24] border-emerald-500/40' : 'bg-emerald-50/50 border-emerald-200'
                          }`}>
                            <div className={`flex items-center justify-between border-b pb-2 ${
                              isDarkMode ? 'border-slate-800/80' : 'border-emerald-100'
                            }`}>
                              <div className="flex items-center gap-2">
                                <Sigma size={15} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
                                <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                                  isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                                }`}>
                                  Definite Integral & Area Calculator
                                </h4>
                              </div>
                              <button
                                onClick={() => {
                                  updateFunction(activeFn.id, {
                                    showIntegral: !activeFn.showIntegral,
                                    integralLower: a,
                                    integralUpper: b,
                                    integralSubdivisions: n
                                  });
                                  showToast(activeFn.showIntegral ? 'Shaded integral area hidden' : 'Definite integral shaded on canvas');
                                }}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${
                                  isShadedOnCanvas 
                                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-500/30' 
                                    : (isDarkMode 
                                        ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
                                }`}
                              >
                                {isShadedOnCanvas ? 'Canvas: ON' : 'Shade Canvas'}
                              </button>
                            </div>

                            {/* Integration Bounds [a, b] Inputs */}
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                              <div className={`p-2 rounded-lg border space-y-1 ${
                                isDarkMode ? 'bg-[#0c141c] border-slate-800' : 'bg-white border-emerald-100'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <label className={`text-[9px] uppercase font-bold text-emerald-500`}>Lower Bound (a)</label>
                                  <span className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>x = {a.toFixed(2)}</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.25"
                                  value={a}
                                  onChange={(e) => updateFunction(activeFn.id, { integralLower: parseFloat(e.target.value) || 0, showIntegral: true })}
                                  className={`w-full rounded px-2 py-1 text-xs font-mono border ${
                                    isDarkMode ? 'bg-[#141e28] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                                  }`}
                                />
                              </div>

                              <div className={`p-2 rounded-lg border space-y-1 ${
                                isDarkMode ? 'bg-[#0c141c] border-slate-800' : 'bg-white border-emerald-100'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <label className={`text-[9px] uppercase font-bold text-cyan-500`}>Upper Bound (b)</label>
                                  <span className={`text-[9px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>x = {b.toFixed(2)}</span>
                                </div>
                                <input
                                  type="number"
                                  step="0.25"
                                  value={b}
                                  onChange={(e) => updateFunction(activeFn.id, { integralUpper: parseFloat(e.target.value) || 0, showIntegral: true })}
                                  className={`w-full rounded px-2 py-1 text-xs font-mono border ${
                                    isDarkMode ? 'bg-[#141e28] border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-800'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Preset Bound Shortcuts */}
                            <div className="flex flex-wrap gap-1 text-[9px] font-mono">
                              <span className={`self-center text-[9px] font-sans mr-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Presets:</span>
                              {[
                                { label: '[0, 1]', a: 0, b: 1 },
                                { label: '[0, 2]', a: 0, b: 2 },
                                { label: '[-1, 1]', a: -1, b: 1 },
                                { label: '[0, π]', a: 0, b: Math.round(Math.PI * 100) / 100 },
                                { label: '[-π, π]', a: -Math.round(Math.PI * 100) / 100, b: Math.round(Math.PI * 100) / 100 },
                              ].map((preset, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    updateFunction(activeFn.id, { integralLower: preset.a, integralUpper: preset.b, showIntegral: true });
                                    showToast(`Bounds set to ${preset.label}`);
                                  }}
                                  className={`px-1.5 py-0.5 rounded border transition-colors ${
                                    isDarkMode 
                                      ? 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300' 
                                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                              {roots.length >= 2 && (
                                <button
                                  onClick={() => {
                                    const sortedRoots = [...roots].sort((r1, r2) => r1 - r2);
                                    updateFunction(activeFn.id, {
                                      integralLower: Math.round(sortedRoots[0] * 100) / 100,
                                      integralUpper: Math.round(sortedRoots[sortedRoots.length - 1] * 100) / 100,
                                      showIntegral: true
                                    });
                                    showToast('Bounds snapped to root interval');
                                  }}
                                  className={`px-1.5 py-0.5 rounded border text-emerald-400 font-semibold ${
                                    isDarkMode ? 'bg-emerald-950/60 border-emerald-500/40' : 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                  }`}
                                >
                                  Between Roots
                                </button>
                              )}
                            </div>

                            {/* Method Comparison Tabs */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Numerical Integration Method</span>
                                <span className={`font-mono text-[9px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>n = {n} strips</span>
                              </div>
                              <div className="grid grid-cols-5 gap-1 text-[9px] font-medium text-center">
                                {[
                                  { id: 'simpson', label: "Simpson's" },
                                  { id: 'trapezoid', label: 'Trapezoid' },
                                  { id: 'midpoint', label: 'Midpoint' },
                                  { id: 'left', label: 'Left End' },
                                  { id: 'right', label: 'Right End' }
                                ].map(m => (
                                  <button
                                    key={m.id}
                                    onClick={() => setIntegralMethodTab(m.id as any)}
                                    className={`py-1 px-0.5 rounded border transition-all truncate ${
                                      integralMethodTab === m.id
                                        ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-xs'
                                        : (isDarkMode 
                                            ? 'bg-[#0c141c] text-slate-300 border-slate-800 hover:bg-slate-800' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100')
                                    }`}
                                  >
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Primary Result Box */}
                            <div className={`p-3 rounded-lg border space-y-2 font-mono ${
                              isDarkMode ? 'bg-[#0b161f] border-emerald-500/30' : 'bg-white border-emerald-200 shadow-xs'
                            }`}>
                              <div className="flex items-baseline justify-between">
                                <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                  ∫<sub>{a.toFixed(2)}</sub><sup>{b.toFixed(2)}</sup> f(x) dx
                                </span>
                                <span className={`text-base font-bold font-mono ${
                                  isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
                                }`}>
                                  {(() => {
                                    if (intResult.signedValue === null) return 'Undefined';
                                    if (integralMethodTab === 'simpson') return intResult.simpsons?.toFixed(5);
                                    if (integralMethodTab === 'trapezoid') return intResult.trapezoidal?.toFixed(5);
                                    if (integralMethodTab === 'midpoint') return intResult.midpointRiemann?.toFixed(5);
                                    if (integralMethodTab === 'left') return intResult.leftRiemann?.toFixed(5);
                                    if (integralMethodTab === 'right') return intResult.rightRiemann?.toFixed(5);
                                    return intResult.signedValue.toFixed(5);
                                  })()}
                                </span>
                              </div>

                              <div className={`grid grid-cols-2 gap-2 pt-2 border-t text-[10px] ${
                                isDarkMode ? 'border-slate-800/80 text-slate-400' : 'border-slate-200 text-slate-600'
                              }`}>
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-slate-500">Total Absolute Area</span>
                                  <span className={`font-bold font-mono ${isDarkMode ? 'text-teal-300' : 'text-teal-700'}`}>
                                    {intResult.absoluteArea !== null ? intResult.absoluteArea.toFixed(4) : '—'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[9px] uppercase font-bold text-slate-500">Average Value (f_avg)</span>
                                  <span className={`font-bold font-mono ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                                    {intResult.averageValue !== null ? intResult.averageValue.toFixed(4) : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Subdivisions Slider and Riemann toggle */}
                            <div className="space-y-2 pt-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Subdivision Partitions (n):</span>
                                <span className="font-mono font-bold text-emerald-500">{n} strips</span>
                              </div>
                              <input
                                type="range"
                                min="4"
                                max="200"
                                step="2"
                                value={n}
                                onChange={(e) => updateFunction(activeFn.id, { integralSubdivisions: parseInt(e.target.value) || 50, showIntegral: true })}
                                className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded-lg"
                              />

                              <div className="flex items-center justify-between pt-1">
                                <label className={`flex items-center gap-1.5 cursor-pointer text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                  <input
                                    type="checkbox"
                                    checked={!!activeFn.showRiemannStrips}
                                    onChange={(e) => updateFunction(activeFn.id, { showRiemannStrips: e.target.checked, showIntegral: true })}
                                    className="rounded border-slate-400 text-emerald-500 focus:ring-0"
                                  />
                                  <span>Show Riemann partition strips on canvas</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* --- TAB 3: TABLE --- */}
            {activeTab === 'Table' && (
              <div className="space-y-4">
                <div className={`p-3 rounded-xl border space-y-3 ${
                  isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <h3 className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-600'
                  }`}>Table Settings</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className={`text-[9px] uppercase block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>X Min</label>
                      <input 
                        type="number"
                        value={tableMinX}
                        onChange={(e) => setTableMinX(parseFloat(e.target.value) || -5)}
                        className={`w-full rounded p-1 font-mono text-xs border ${
                          isDarkMode 
                            ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-200' 
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[9px] uppercase block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>X Max</label>
                      <input 
                        type="number"
                        value={tableMaxX}
                        onChange={(e) => setTableMaxX(parseFloat(e.target.value) || 5)}
                        className={`w-full rounded p-1 font-mono text-xs border ${
                          isDarkMode 
                            ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-200' 
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`text-[9px] uppercase block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>Step (Δx)</label>
                      <input 
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={tableStep}
                        onChange={(e) => setTableStep(parseFloat(e.target.value) || 1)}
                        className={`w-full rounded p-1 font-mono text-xs border ${
                          isDarkMode 
                            ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-200' 
                            : 'bg-white border-slate-300 text-slate-800'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => {
                        const visibleFns = functions.filter(f => f.visible);
                        let csv = 'x,' + visibleFns.map((f, i) => i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`).join(',') + '\n';
                        const min = Math.min(tableMinX, tableMaxX);
                        const max = Math.max(tableMinX, tableMaxX);
                        const step = Math.max(0.01, Math.abs(tableStep));
                        for (let x = min; x <= max + 1e-9; x += step) {
                          const rx = Number(x.toFixed(4));
                          const row: (number | string)[] = [rx];
                          visibleFns.forEach(f => {
                            const y = evaluateFunction(f.equation, rx);
                            row.push(y !== null ? Number(y.toFixed(4)) : 'NaN');
                          });
                          csv += row.join(',') + '\n';
                        }
                        navigator.clipboard.writeText(csv);
                        showToast('Table copied as CSV');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                        isDarkMode 
                          ? 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border-indigo-500/40' 
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                      }`}
                    >
                      <Copy size={13} /> Copy CSV
                    </button>

                    <button 
                      onClick={() => {
                        setTableMinX(-5);
                        setTableMaxX(5);
                        setTableStep(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-colors border ${
                        isDarkMode 
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                      title="Reset Range"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Values Table */}
                <div className={`overflow-x-auto rounded-xl border max-h-[420px] ${
                  isDarkMode ? 'border-slate-800 bg-[#121524]' : 'border-slate-200 bg-white'
                }`}>
                  <table className="w-full text-xs font-mono border-collapse">
                    <thead>
                      <tr className={`text-[10px] uppercase border-b sticky top-0 ${
                        isDarkMode ? 'bg-[#161a2e] text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <th className="p-2 text-left">x</th>
                        {functions.filter(f => f.visible).map((f, i) => (
                          <th key={f.id} className="p-2 text-left" style={{ color: f.color }}>
                            {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = [];
                        const min = Math.min(tableMinX, tableMaxX);
                        const max = Math.max(tableMinX, tableMaxX);
                        const step = Math.max(0.01, Math.abs(tableStep));
                        const visibleFns = functions.filter(f => f.visible);

                        for (let x = min; x <= max + 1e-9; x += step) {
                          const rx = Number(x.toFixed(3));
                          rows.push(
                            <tr key={rx} className={`border-b transition-colors ${
                              isDarkMode 
                                ? 'border-slate-800/40 hover:bg-slate-800/30 text-slate-300' 
                                : 'border-slate-100 hover:bg-slate-50 text-slate-800'
                            }`}>
                              <td className={`p-2 font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{rx}</td>
                              {visibleFns.map(f => {
                                const y = evaluateFunction(f.equation, rx);
                                return (
                                  <td key={f.id} className="p-2">
                                    {y !== null ? y.toFixed(3) : <span className="text-red-400">NaN</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        }
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- TAB 4: INTERSECTIONS --- */}
            {activeTab === 'Intersections' && (
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <h3 className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Intersection Finder</h3>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Finds exact points where curves cross</p>
                  </div>
                  <button 
                    onClick={() => handleQuickAction('intersect')}
                    className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-xs rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all"
                  >
                    Scan
                  </button>
                </div>

                <div className="space-y-2">
                  {intersections.length > 0 ? (
                    intersections.map((p, idx) => (
                      <div key={idx} className={`p-3 border rounded-xl space-y-2 ${
                        isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs font-mono ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                            Point P{idx + 1}
                          </span>
                          <span className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                            ({p.x.toFixed(3)}, {p.y.toFixed(3)})
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setViewportDomain([p.x - 3, p.x + 3]);
                              setViewportRange([p.y - 3, p.y + 3]);
                              showToast(`Centered on P${idx + 1}`);
                            }}
                            className={`flex-1 py-1 rounded text-[11px] font-sans font-medium flex items-center justify-center gap-1 border transition-all ${
                              isDarkMode 
                                ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30' 
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}
                          >
                            <Focus size={12} /> Focus Graph
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
                              showToast('Coordinates copied');
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-sans transition-colors border ${
                              isDarkMode 
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                            title="Copy coordinates"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`p-4 border rounded-xl text-center space-y-2 ${
                      isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <GitCommit size={24} className={`mx-auto ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>No intersections detected in current domain.</p>
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ensure at least 2 visible functions intersect in [-20, 20].</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- TAB 5: TRANSFORM --- */}
            {activeTab === 'Transform' && (
              <div className="space-y-4">
                <div>
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>Target Function</label>
                  <select 
                    value={editingFunctionId || functions[0]?.id}
                    onChange={(e) => setEditingFunctionId(e.target.value)}
                    className={`w-full text-xs font-mono rounded-lg p-2 outline-none border transition-colors ${
                      isDarkMode 
                        ? 'bg-[#121524] border-slate-700/80 text-indigo-300' 
                        : 'bg-slate-50 border-slate-300 text-indigo-700'
                    }`}
                  >
                    {functions.map((f, i) => (
                      <option key={f.id} value={f.id}>
                        {i === 0 ? 'f(x)' : i === 1 ? 'g(x)' : `f${i+1}(x)`} = {f.equation}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`p-3 rounded-xl border space-y-3 text-xs ${
                  isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`p-2 rounded border text-center font-mono text-xs ${
                    isDarkMode 
                      ? 'bg-[#0c0e1a] border-indigo-500/30 text-indigo-300' 
                      : 'bg-indigo-50 border-indigo-200 text-indigo-800 font-semibold'
                  }`}>
                    g(x) = {transformA !== 1 ? `${transformA} * ` : ''}f({transformB !== 1 ? `${transformB}*` : ''}(x {transformC >= 0 ? `- ${transformC}` : `+ ${Math.abs(transformC)}`})) {transformD >= 0 ? `+ ${transformD}` : `- ${Math.abs(transformD)}`}
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <div>
                      <div className={`flex justify-between text-[10px] mb-1 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        <span>Vertical Scale (a)</span>
                        <span className={`font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{transformA}</span>
                      </div>
                      <input 
                        type="range" min="-5" max="5" step="0.5"
                        value={transformA} onChange={(e) => setTransformA(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className={`flex justify-between text-[10px] mb-1 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        <span>Horizontal Compression (b)</span>
                        <span className={`font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{transformB}</span>
                      </div>
                      <input 
                        type="range" min="-5" max="5" step="0.5"
                        value={transformB} onChange={(e) => setTransformB(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className={`flex justify-between text-[10px] mb-1 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        <span>Horizontal Shift (c)</span>
                        <span className={`font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{transformC}</span>
                      </div>
                      <input 
                        type="range" min="-10" max="10" step="0.5"
                        value={transformC} onChange={(e) => setTransformC(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className={`flex justify-between text-[10px] mb-1 ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        <span>Vertical Shift (d)</span>
                        <span className={`font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{transformD}</span>
                      </div>
                      <input 
                        type="range" min="-10" max="10" step="0.5"
                        value={transformD} onChange={(e) => setTransformD(parseFloat(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>

                  <div className={`grid grid-cols-2 gap-1.5 pt-2 border-t ${
                    isDarkMode ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <button 
                      onClick={() => setTransformA(prev => prev * -1)}
                      className={`p-1.5 rounded text-[10px] border transition-colors ${
                        isDarkMode 
                          ? 'bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 border-slate-800' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      Reflect X-Axis
                    </button>
                    <button 
                      onClick={() => setTransformB(prev => prev * -1)}
                      className={`p-1.5 rounded text-[10px] border transition-colors ${
                        isDarkMode 
                          ? 'bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 border-slate-800' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      Reflect Y-Axis
                    </button>
                    <button 
                      onClick={() => setTransformD(prev => prev + 2)}
                      className={`p-1.5 rounded text-[10px] border transition-colors ${
                        isDarkMode 
                          ? 'bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 border-slate-800' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      Shift Up +2
                    </button>
                    <button 
                      onClick={() => { setTransformA(1); setTransformB(1); setTransformC(0); setTransformD(0); }}
                      className={`p-1.5 rounded text-[10px] border transition-colors ${
                        isDarkMode 
                          ? 'bg-[#0c0e1a] hover:bg-slate-800 text-slate-300 border-slate-800' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      Reset Sliders
                    </button>
                  </div>

                  <button 
                    onClick={() => {
                      const targetFn = functions.find(f => f.id === editingFunctionId) || functions[0];
                      if (targetFn) {
                        let base = targetFn.equation;
                        let innerX = transformC === 0 ? 'x' : transformC > 0 ? `(x - ${transformC})` : `(x + ${Math.abs(transformC)})`;
                        if (transformB !== 1) innerX = `${transformB}*${innerX}`;
                        let expr = base.replace(/\bx\b/g, innerX);
                        if (transformA !== 1) expr = `${transformA} * (${expr})`;
                        if (transformD !== 0) expr = transformD > 0 ? `${expr} + ${transformD}` : `${expr} - ${Math.abs(transformD)}`;
                        
                        updateFunction(targetFn.id, { equation: expr });
                        showToast(`Updated equation: ${expr}`);
                      }
                    }}
                    className="w-full py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-xs shadow-md transition-all active:scale-95"
                  >
                    Apply Transformation to Function
                  </button>
                </div>
              </div>
            )}

            {/* --- TAB 6: EXAMPLES --- */}
            {activeTab === 'Examples' && (
              <div className="space-y-4">
                <p className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Select a pre-built mathematical curve or preset system to load directly onto the graph canvas.
                </p>
                
                <div className="space-y-2">
                  {[
                    { label: 'Standard Parabola', eq: 'x^2', category: 'Algebra' },
                    { label: 'Cubic Inflection', eq: 'x^3 - 3*x', category: 'Algebra' },
                    { label: 'Rational Hyperbola', eq: '1/x', category: 'Algebra' },
                    { label: 'Absolute V-Shape', eq: 'abs(x)', category: 'Algebra' },
                    { label: 'Harmonic Sine Wave', eq: 'sin(x)', category: 'Trigonometry' },
                    { label: 'Phase Shifted Wave', eq: '2*sin(2*x - 1)', category: 'Trigonometry' },
                    { label: 'Exponential Growth', eq: 'e^x', category: 'Calculus' },
                    { label: 'Natural Logarithm', eq: 'ln(x)', category: 'Calculus' },
                    { label: 'Square Root Radical', eq: 'sqrt(x)', category: 'Inverse & Powers' },
                    { label: 'Arcsine Inverse', eq: 'asin(x)', category: 'Inverse & Powers' },
                    { label: 'Gaussian Bell Curve', eq: 'e^(-x^2)', category: 'Statistics' },
                    { label: 'Logistic Sigmoid', eq: '1/(1 + e^(-x))', category: 'Statistics' },
                    { label: 'Damped Oscillator', eq: 'e^(-0.2*x)*cos(3*x)', category: 'Physics' },
                  ].map((ex, i) => (
                    <div key={i} className={`p-2.5 rounded-xl flex items-center justify-between border transition-all ${
                      isDarkMode 
                        ? 'bg-[#121524] border-slate-800/80 hover:border-indigo-500/50' 
                        : 'bg-slate-50 border-slate-200 hover:border-indigo-400 shadow-xs'
                    }`}>
                      <div>
                        <span className={`text-[9px] uppercase tracking-wider font-bold block ${
                          isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                        }`}>{ex.category}</span>
                        <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{ex.label}</h4>
                        <code className={`text-[10px] font-mono ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>f(x) = {ex.eq}</code>
                      </div>
                      <button 
                        onClick={() => {
                          recordHistory();
                          const newFn: FunctionConfig = {
                            id: Date.now().toString(),
                            equation: ex.eq,
                            color: COLORS[functions.length % COLORS.length],
                            visible: true,
                            style: 'solid',
                            strokeWidth: 2.5,
                            showDerivative: false,
                            showTangent: false,
                            tangentPoint: 0,
                            showExtrema: true,
                            showInverse: false
                          };
                          setFunctions(prev => [...prev, newFn]);
                          setEditingFunctionId(newFn.id);
                          showToast(`Added ${ex.label}`);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          isDarkMode 
                            ? 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border-indigo-500/30' 
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- TAB 7: SAVED PRESETS --- */}
            {activeTab === 'Saved' && (
              <div className="space-y-4">
                <div className={`p-3 rounded-xl border space-y-2.5 ${
                  isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <h3 className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Save Current Graph Preset</h3>
                  <input 
                    type="text"
                    placeholder="Preset name (e.g. Calculus HW #3)"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className={`w-full rounded-lg p-2 text-xs outline-none border transition-colors ${
                      isDarkMode 
                        ? 'bg-[#0c0e1a] border-slate-700/80 text-slate-100' 
                        : 'bg-white border-slate-300 text-slate-800'
                    }`}
                  />
                  <button 
                    onClick={() => {
                      if (!newPresetName.trim()) {
                        showToast('Please enter a preset name');
                        return;
                      }
                      const newPreset = {
                        id: Date.now().toString(),
                        name: newPresetName.trim(),
                        funcs: JSON.parse(JSON.stringify(functions))
                      };
                      setSavedPresets(prev => [newPreset, ...prev]);
                      setNewPresetName('');
                      showToast('Graph preset saved!');
                    }}
                    className="w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg text-xs shadow-md transition-all active:scale-95"
                  >
                    Save Preset
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>Your Saved Presets</h4>
                  {savedPresets.map((preset) => (
                    <div key={preset.id} className={`p-3 rounded-xl border space-y-2 ${
                      isDarkMode ? 'bg-[#121524] border-slate-800' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{preset.name}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                          isDarkMode 
                            ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' 
                            : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                        }`}>
                          {preset.funcs.length} curves
                        </span>
                      </div>

                      <div className={`space-y-0.5 font-mono text-[10px] ${
                        isDarkMode ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {preset.funcs.map((f, i) => (
                          <div key={i} className="truncate">
                            • {f.equation}
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button 
                          onClick={() => {
                            recordHistory();
                            setFunctions(JSON.parse(JSON.stringify(preset.funcs)));
                            showToast(`Loaded "${preset.name}"`);
                          }}
                          className={`flex-1 py-1 rounded text-xs font-semibold border transition-all ${
                            isDarkMode 
                              ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          Load
                        </button>
                        <button 
                          onClick={() => {
                            setSavedPresets(prev => prev.filter(p => p.id !== preset.id));
                            showToast('Preset deleted');
                          }}
                          className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                            isDarkMode 
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20' 
                              : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                          }`}
                          title="Delete preset"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </motion.aside>

        {/* --- MAIN GRAPH CANVAS AREA --- */}
        <div className="flex-1 relative bg-[#090b17] flex flex-col" ref={containerRef}>
          
          {/* Top Left Sidebar Toggle & Quick Draw Action Bar */}
          <div data-export-hide="true" className="absolute top-4 left-4 z-20 flex items-center gap-1.5 overflow-x-auto max-w-[calc(100%-120px)] p-1 rounded-xl backdrop-blur-md border shadow-lg bg-[#121524]/90 border-slate-700/80">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={`transition-all border w-7 h-7 rounded-lg flex items-center justify-center shadow-xs shrink-0 ${
                isDarkMode 
                  ? 'bg-[#181c30] hover:bg-slate-800 text-slate-300 border-slate-700' 
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>

            <div className={`w-px h-5 mx-0.5 ${isDarkMode ? 'bg-slate-700/60' : 'bg-slate-300'}`} />

            {/* Quick Geometric & Interactive Tool Buttons */}
            {[
              { id: 'line', label: 'Draw Line', icon: Ruler, activeBg: 'bg-sky-600 text-white' },
              { id: 'circle', label: 'Circle', icon: CircleDot, activeBg: 'bg-blue-600 text-white' },
              { id: 'semicircle', label: 'Semi-Circle', icon: Compass, activeBg: 'bg-pink-600 text-white' },
              { id: 'point', label: 'Point', icon: Crosshair, activeBg: 'bg-cyan-600 text-white' },
              { id: 'tangent', label: 'Tangent', icon: Activity, activeBg: 'bg-amber-600 text-white' },
              { id: 'integral', label: 'Integral', icon: Sigma, activeBg: 'bg-emerald-600 text-white' },
            ].map(tool => {
              const Icon = tool.icon;
              const isActive = activeQuickAction === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => handleQuickAction(tool.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? `${tool.activeBg} shadow-sm ring-2 ring-white/20 font-bold`
                      : (isDarkMode ? 'text-slate-300 hover:text-white hover:bg-slate-800/80' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100')
                  }`}
                  title={`${tool.label} tool`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline text-[11px]">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* D3 SVG Canvas */}
          <svg 
            ref={svgRef} 
            className={`w-full h-full touch-none ${
              activeGraphTool === 'pan' ? 'cursor-grab active:cursor-grabbing' :
              activeGraphTool === 'zoomIn' ? 'cursor-zoom-in' :
              activeGraphTool === 'zoomOut' ? 'cursor-zoom-out' :
              'cursor-crosshair'
            }`}
            style={{ backgroundColor: '#090b17' }}
          />

          {/* Toast Banner */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                data-export-hide="true"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-indigo-950/95 border border-indigo-500/50 text-indigo-100 text-xs font-semibold px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2"
              >
                <Sparkles size={14} className="text-indigo-400" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Quick Action Inspectors */}
          <AnimatePresence>
            {activeQuickAction === 'integral' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121c24]/95 border-emerald-500/50 text-slate-200' : 'bg-white/95 border-emerald-300 text-slate-800 shadow-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    <Sigma size={16} />
                    <span>Definite Integral & Area Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {(() => {
                  const targetFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
                  if (!targetFn) {
                    return <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Please select or add a visible function to integrate.</p>;
                  }

                  const a = targetFn.integralLower !== undefined ? targetFn.integralLower : 0;
                  const b = targetFn.integralUpper !== undefined ? targetFn.integralUpper : 2;
                  const n = targetFn.integralSubdivisions || 50;
                  const intRes = computeDefiniteIntegral((x) => evaluateFunction(targetFn.equation, x), a, b, n);

                  return (
                    <div className="space-y-2.5 text-xs">
                      {/* Target function badge */}
                      <div className={`flex items-center justify-between p-2 rounded-lg font-mono border ${
                        isDarkMode ? 'bg-[#18242b] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: targetFn.color }} />
                          <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>f(x) =</span>
                          <span className="font-bold text-emerald-400">{targetFn.equation}</span>
                        </div>
                        <span className="text-[9px] font-sans font-semibold text-emerald-500">Shaded on canvas</span>
                      </div>

                      {/* Click mode selector */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>Graph Click Mode:</span>
                          <span className="text-[9px] text-slate-400 font-mono">Click graph to set bound</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          {[
                            { id: 'auto', label: 'Auto Closest' },
                            { id: 'a', label: 'Set Lower (a)' },
                            { id: 'b', label: 'Set Upper (b)' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => setIntegralClickMode(mode.id as any)}
                              className={`py-1 px-1.5 rounded border font-medium transition-all text-center ${
                                integralClickMode === mode.id
                                  ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-xs'
                                  : (isDarkMode 
                                      ? 'bg-[#0c141c] text-slate-300 border-slate-700/80 hover:bg-slate-800' 
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Bound a and b controls */}
                      <div className="grid grid-cols-2 gap-2 font-mono">
                        <div className={`p-2 rounded-lg border space-y-1 ${
                          isDarkMode ? 'bg-[#0c141c] border-slate-800' : 'bg-white border-emerald-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-bold text-emerald-500">Bound a</span>
                            <span className="text-[10px] font-bold text-emerald-400">{a.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range"
                            min="-10"
                            max="10"
                            step="0.1"
                            value={a}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateFunction(targetFn.id, { integralLower: val, showIntegral: true });
                            }}
                            className="w-full accent-emerald-500 cursor-pointer h-1.5 rounded"
                          />
                        </div>

                        <div className={`p-2 rounded-lg border space-y-1 ${
                          isDarkMode ? 'bg-[#0c141c] border-slate-800' : 'bg-white border-cyan-100'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] uppercase font-bold text-cyan-500">Bound b</span>
                            <span className="text-[10px] font-bold text-cyan-400">{b.toFixed(2)}</span>
                          </div>
                          <input 
                            type="range"
                            min="-10"
                            max="10"
                            step="0.1"
                            value={b}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateFunction(targetFn.id, { integralUpper: val, showIntegral: true });
                            }}
                            className="w-full accent-cyan-500 cursor-pointer h-1.5 rounded"
                          />
                        </div>
                      </div>

                      {/* Definite Integral Result Display */}
                      <div className={`p-2.5 rounded-lg border space-y-1.5 font-mono ${
                        isDarkMode ? 'bg-[#0b161f] border-emerald-500/40 text-emerald-200' : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-sans font-medium text-slate-400">Definite Integral:</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ∫<sub>{a.toFixed(1)}</sub><sup>{b.toFixed(1)}</sup> = {intRes.signedValue !== null ? intRes.signedValue.toFixed(4) : 'Undefined'}
                          </span>
                        </div>
                        <div className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                          isDarkMode ? 'border-slate-800 text-slate-400' : 'border-emerald-200 text-slate-600'
                        }`}>
                          <span>Absolute Area: <strong className="text-teal-400 font-mono">{intRes.absoluteArea !== null ? intRes.absoluteArea.toFixed(4) : '—'}</strong></span>
                          <span>Avg Value: <strong className="text-cyan-400 font-mono">{intRes.averageValue !== null ? intRes.averageValue.toFixed(3) : '—'}</strong></span>
                        </div>
                      </div>

                      {/* Quick preset buttons */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        <button
                          onClick={() => {
                            updateFunction(targetFn.id, {
                              integralLower: b,
                              integralUpper: a,
                              showIntegral: true
                            });
                            showToast('Swapped lower & upper bounds');
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-sans font-semibold border transition-all ${
                            isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                          }`}
                        >
                          ⇄ Swap [b, a]
                        </button>
                        <button
                          onClick={() => {
                            updateFunction(targetFn.id, {
                              showRiemannStrips: !targetFn.showRiemannStrips,
                              showIntegral: true
                            });
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-sans font-semibold border transition-all ${
                            targetFn.showRiemannStrips
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : (isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700')
                          }`}
                        >
                          {targetFn.showRiemannStrips ? 'Strips: ON' : 'Riemann Strips'}
                        </button>
                      </div>

                      <div className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                        isDarkMode ? 'border-slate-800' : 'border-slate-200'
                      }`}>
                        <button 
                          onClick={() => {
                            setActiveTab('Analysis');
                            setActiveQuickAction(null);
                          }} 
                          className={`hover:underline flex items-center gap-1 font-medium ${
                            isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                          }`}
                        >
                          Open comprehensive Analysis & Methods →
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {activeQuickAction === 'inverse' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-indigo-500/50 text-slate-200' : 'bg-white/95 border-indigo-300 text-slate-800 shadow-indigo-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>
                    <RotateCcw size={15} />
                    <span>Inverse Function & Symmetry Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {(() => {
                  const targetFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
                  if (!targetFn) {
                    return <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Please select or add a visible function to view its inverse.</p>;
                  }
                  const invInfo = getInverseEquationInfo(targetFn.equation);
                  return (
                    <div className="space-y-2 text-xs">
                      <div className={`flex items-center justify-between p-2 rounded-lg font-mono border ${
                        isDarkMode ? 'bg-[#181c30] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Original f(x):</span>
                        <span className={`font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>{targetFn.equation}</span>
                      </div>

                      <div className={`p-2.5 rounded-lg border space-y-1.5 font-mono ${
                        isDarkMode ? 'bg-[#0c0e1a] border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${isDarkMode ? 'text-purple-300' : 'text-purple-700'}`}>{invInfo.displayName}</span>
                          {invInfo.isExact && (
                            <span className={`text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded border ${
                              isDarkMode 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Exact Symbolic
                            </span>
                          )}
                        </div>
                        <div className={`text-[10px] font-sans space-y-0.5 pt-1 border-t ${
                          isDarkMode ? 'border-slate-800 text-slate-400' : 'border-indigo-100 text-slate-600'
                        }`}>
                          <div><strong className={isDarkMode ? 'text-slate-300' : 'text-slate-800'}>Parametric Form:</strong> {invInfo.parametricForm}</div>
                          <div><strong className={isDarkMode ? 'text-slate-300' : 'text-slate-800'}>Domain:</strong> {invInfo.domainConstraint}</div>
                          <div><strong className={isDarkMode ? 'text-slate-300' : 'text-slate-800'}>Symmetry Line:</strong> Reflects across diagonal y = x</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => {
                            updateFunction(targetFn.id, { showInverse: !targetFn.showInverse });
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                            targetFn.showInverse
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                              : (isDarkMode 
                                  ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700' 
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
                          }`}
                        >
                          <RotateCcw size={12} />
                          {targetFn.showInverse ? 'Inverse Active (Dashed)' : 'Show Inverse Curve'}
                        </button>
                      </div>

                      <div className={`grid grid-cols-2 gap-1.5 pt-1 border-t font-sans ${
                        isDarkMode ? 'border-slate-800' : 'border-slate-200'
                      }`}>
                        <button
                          onClick={() => {
                            if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                              recordHistory();
                              const nextColor = COLORS[(functions.length) % COLORS.length];
                              const newFn: FunctionConfig = {
                                id: Date.now().toString(),
                                equation: invInfo.symbolicEquation,
                                color: nextColor,
                                visible: true,
                                style: 'dashed',
                                strokeWidth: 2.5,
                                showDerivative: false,
                                showTangent: false,
                                tangentPoint: 0,
                                showExtrema: false,
                                showInverse: false
                              };
                              setFunctions(prev => [...prev, newFn]);
                              setEditingFunctionId(newFn.id);
                              showToast(`Added ${invInfo.symbolicEquation} as independent function`);
                            } else {
                              showToast('Parametric inverse plotted on canvas');
                            }
                          }}
                          className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 border transition-all ${
                            isDarkMode 
                              ? 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border-indigo-500/30' 
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          <Plus size={11} /> + Add as New f(x)
                        </button>

                        <button
                          onClick={() => {
                            if (invInfo.symbolicEquation && invInfo.symbolicEquation !== 'f⁻¹(x)') {
                              updateFunction(targetFn.id, { equation: invInfo.symbolicEquation, showInverse: false });
                              showToast(`Inverted in-place to ${invInfo.symbolicEquation}`);
                            } else {
                              showToast('Expression inverted parametrically');
                            }
                          }}
                          className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 border transition-all ${
                            isDarkMode 
                              ? 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/30' 
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                          }`}
                        >
                          <RotateCcw size={11} /> Invert In-Place
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {activeQuickAction === 'intersect' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2 ${
                  isDarkMode ? 'bg-[#121524]/95 border-purple-500/50 text-slate-200' : 'bg-white/95 border-purple-300 text-slate-800 shadow-purple-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                    <GitCommit size={15} />
                    <span>⚡ Intersections Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {intersections.length > 0 
                    ? `Found ${intersections.length} intersection point${intersections.length > 1 ? 's' : ''} between active functions:`
                    : 'No intersections found between visible functions in this range.'}
                </p>

                {intersections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {intersections.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setViewportDomain([p.x - 3, p.x + 3]);
                          setViewportRange([p.y - 3, p.y + 3]);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all active:scale-95 border ${
                          isDarkMode 
                            ? 'bg-purple-950/80 hover:bg-purple-900 border-purple-500/40 text-purple-200' 
                            : 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-800'
                        }`}
                        title="Click to jump & center viewport on this point"
                      >
                        <Focus size={12} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                        <span>P{idx + 1}: ({p.x.toFixed(2)}, {p.y.toFixed(2)})</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className={`flex items-center justify-between pt-1 border-t text-[10px] ${
                  isDarkMode ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <button 
                    onClick={() => setActiveTab('Intersections')} 
                    className={`hover:underline flex items-center gap-1 font-medium ${
                      isDarkMode ? 'text-purple-400' : 'text-purple-700'
                    }`}
                  >
                    Open full details in Intersections Tab →
                  </button>
                </div>
              </motion.div>
            )}

            {activeQuickAction === 'tangent' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-amber-500/50 text-slate-200' : 'bg-white/95 border-amber-300 text-slate-800 shadow-amber-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                    <Activity size={15} />
                    <span>📐 Tangent Line Inspector</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {(() => {
                  const activeFn = functions.find(f => f.id === editingFunctionId) || functions.find(f => f.visible);
                  if (!activeFn) {
                    return <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Please select or add a function to view tangents.</p>;
                  }
                  const x0 = activeFn.tangentPoint || 0;
                  const y0 = evaluateFunction(activeFn.equation, x0);
                  const slope = getDerivative(activeFn.equation, x0);

                  return (
                    <div className="space-y-2 text-xs">
                      <div className={`flex items-center justify-between p-2 rounded-lg font-mono border ${
                        isDarkMode ? 'bg-[#181c30] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>Function:</span>
                        <span className={`font-bold ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>{activeFn.equation}</span>
                      </div>

                      <div className="space-y-1">
                        <div className={`flex justify-between text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          <span>Tangent Point (x₀): <strong className="text-amber-500 font-mono">{x0.toFixed(1)}</strong></span>
                          <span>Slope (m): <strong className="text-amber-500 font-mono">{slope !== null ? slope.toFixed(2) : '—'}</strong></span>
                        </div>
                        <input 
                          type="range"
                          min="-10"
                          max="10"
                          step="0.1"
                          value={x0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateFunction(activeFn.id, { showTangent: true, tangentPoint: val });
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <span className={`text-[10px] shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Presets:</span>
                        {[-2, -1, 0, 1, 2].map(presetX => (
                          <button
                            key={presetX}
                            onClick={() => updateFunction(activeFn.id, { showTangent: true, tangentPoint: presetX })}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                              x0 === presetX 
                                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' 
                                : (isDarkMode 
                                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' 
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100')
                            }`}
                          >
                            x₀={presetX}
                          </button>
                        ))}
                      </div>

                      {y0 !== null && slope !== null && (
                        <div className={`p-2 rounded-lg border text-[11px] font-mono ${
                          isDarkMode 
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-200' 
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}>
                          Tangent Eq: y = {slope.toFixed(2)}x {y0 - slope * x0 >= 0 ? '+' : ''} {(y0 - slope * x0).toFixed(2)}
                        </div>
                      )}

                      <p className={`text-[10px] italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>💡 Tip: Click graph curve to move x₀ instantly.</p>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {activeQuickAction === 'point' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-blue-500/50 text-slate-200' : 'bg-white/95 border-blue-300 text-slate-800 shadow-blue-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                    <Crosshair size={15} />
                    <span>📍 Point Inspector & Pins</span>
                  </div>
                  <button onClick={() => setActiveQuickAction(null)} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                <p className={`text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Click anywhere on the graph canvas to place permanent coordinate pins.
                </p>

                {placedPins.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {placedPins.map(pin => (
                      <div key={pin.id} className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono ${
                        isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-bold">{pin.label}:</span>
                          <span className={isDarkMode ? 'text-blue-300' : 'text-blue-600'}>({pin.x.toFixed(2)}, {pin.y.toFixed(2)})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`(${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})`);
                              showToast(`Copied ${pin.label} coordinates`);
                            }}
                            className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            title="Copy Coordinates"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={() => {
                              recordHistory();
                              setPlacedPins(prev => prev.filter(p => p.id !== pin.id));
                            }}
                            className="p-1 text-slate-400 hover:text-red-500"
                            title="Remove Pin"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-lg border border-dashed text-center text-[11px] ${
                    isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
                  }`}>
                    No pins dropped yet. Tap on graph canvas to drop a pin!
                  </div>
                )}

                {placedPins.length > 0 && (
                  <button 
                    onClick={() => {
                      recordHistory();
                      setPlacedPins([]);
                      showToast('Cleared all pins');
                    }}
                    className={`w-full py-1 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 border ${
                      isDarkMode 
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    <Trash2 size={12} />
                    Clear All Pins ({placedPins.length})
                  </button>
                )}
              </motion.div>
            )}

            {/* --- LINE DRAWING TOOL OVERLAY --- */}
            {activeQuickAction === 'line' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm w-84 flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-sky-500/50 text-slate-200' : 'bg-white/95 border-sky-300 text-slate-800 shadow-sky-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-sky-400' : 'text-sky-700'}`}>
                    <Ruler size={15} />
                    <span>📏 Line Drawing & Equation Tool</span>
                  </div>
                  <button onClick={() => { setActiveQuickAction(null); setDrawingPoints([]); }} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {/* Line Mode Selector */}
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg border bg-black/10 border-slate-700/50 text-[10px]">
                  {[
                    { id: 'segment', label: '2-Point' },
                    { id: 'polyline', label: 'Multi-Point' },
                    { id: 'infinite', label: 'Infinite' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setDrawingLineMode(mode.id as any);
                        setDrawingPoints([]);
                      }}
                      className={`py-1 rounded font-medium transition-all ${
                        drawingLineMode === mode.id
                          ? (isDarkMode ? 'bg-sky-600 text-white font-bold' : 'bg-sky-600 text-white font-bold')
                          : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Style and Color Bar */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {['#38bdf8', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setDrawingColor(c)}
                        className={`w-4 h-4 rounded-full border transition-transform ${
                          drawingColor === c ? 'scale-125 ring-2 ring-sky-400' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDrawingStyle(prev => prev === 'solid' ? 'dashed' : 'solid')}
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                        drawingStyle === 'dashed' ? 'bg-sky-500/20 text-sky-400 border-sky-500/40' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {drawingStyle}
                    </button>
                    <select
                      value={drawingStrokeWidth}
                      onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))}
                      className={`text-[9px] rounded px-1 py-0.5 border ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value={1.5}>1.5px</option>
                      <option value={2.5}>2.5px</option>
                      <option value={4}>4.0px</option>
                    </select>
                  </div>
                </div>

                {/* Active Drawing Step Guide */}
                <div className={`p-2 rounded-lg border text-[11px] ${
                  isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  {drawingPoints.length === 0 ? (
                    <p className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                      <span>Click anywhere in <strong>any quadrant</strong> to place Point 1.</span>
                    </p>
                  ) : drawingLineMode === 'polyline' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-400">{drawingPoints.length} vertices placed</span>
                        <button
                          onClick={() => {
                            if (drawingPoints.length >= 2) {
                              recordHistory();
                              const newLine: CustomShape = {
                                id: Date.now().toString(),
                                type: 'line',
                                lineMode: 'polyline',
                                label: `Polyline ${drawnShapes.filter(s => s.type === 'line').length + 1}`,
                                color: drawingColor,
                                strokeWidth: drawingStrokeWidth,
                                style: drawingStyle,
                                visible: true,
                                points: [...drawingPoints]
                              };
                              setDrawnShapes(prev => [...prev, newLine]);
                              setDrawingPoints([]);
                              showToast(`Polyline with ${drawingPoints.length} points created`);
                            }
                          }}
                          disabled={drawingPoints.length < 2}
                          className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-[10px]"
                        >
                          Finish Line ({drawingPoints.length})
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">Click graph to add next vertex across any quadrant.</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>P1: ({drawingPoints[0].x.toFixed(2)}, {drawingPoints[0].y.toFixed(2)}) → Click Point 2</span>
                      <button
                        onClick={() => setDrawingPoints([])}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Reset P1
                      </button>
                    </div>
                  )}
                </div>

                {/* List of Drawn Lines */}
                {drawnShapes.filter(s => s.type === 'line').length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Drawn Lines ({drawnShapes.filter(s => s.type === 'line').length})</span>
                    {drawnShapes.filter(s => s.type === 'line').map(line => {
                      const pts = line.points || [];
                      const eq = pts.length >= 2 ? formatLineEquation(pts[0], pts[1]) : line.label;
                      return (
                        <div key={line.id} className={`flex flex-col gap-1.5 p-2 rounded-lg border text-xs font-mono ${
                          isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
                              <span className="font-bold text-[11px] truncate">{eq}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(eq);
                                  showToast(`Copied equation: ${eq}`);
                                }}
                                className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                title="Copy Equation"
                              >
                                <Copy size={11} />
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.map(s => s.id === line.id ? { ...s, visible: !s.visible } : s));
                                }}
                                className={`p-1 ${line.visible ? 'text-sky-400' : 'text-slate-500'}`}
                                title="Toggle Visibility"
                              >
                                {line.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.filter(s => s.id !== line.id));
                                }}
                                className="p-1 text-slate-400 hover:text-red-500"
                                title="Delete Line"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Line Rotation Slider */}
                          <div className={`pt-1.5 border-t flex items-center gap-1.5 text-[9.5px] ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <RotateCw size={10} className="text-sky-400 shrink-0" />
                            <span className="text-slate-400 font-sans">Rotate:</span>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="1"
                              value={line.rotation || 0}
                              onPointerDown={() => recordHistory()}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDrawnShapes(prev => prev.map(s => s.id === line.id ? { ...s, rotation: val } : s));
                              }}
                              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                            <span className="font-mono font-bold text-sky-400 w-7 text-right">
                              {Math.round(line.rotation || 0)}°
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* --- CIRCLE DRAWING TOOL OVERLAY --- */}
            {activeQuickAction === 'circle' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm w-84 flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-blue-500/50 text-slate-200' : 'bg-white/95 border-blue-300 text-slate-800 shadow-blue-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                    <CircleDot size={15} />
                    <span>⭕ Circle Drawing & Equation Tool</span>
                  </div>
                  <button onClick={() => { setActiveQuickAction(null); setDrawingPoints([]); }} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {/* Color and Style Palette */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {['#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#38bdf8'].map(c => (
                      <button
                        key={c}
                        onClick={() => setDrawingColor(c)}
                        className={`w-4 h-4 rounded-full border transition-transform ${
                          drawingColor === c ? 'scale-125 ring-2 ring-blue-400' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDrawingStyle(prev => prev === 'solid' ? 'dashed' : 'solid')}
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                        drawingStyle === 'dashed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {drawingStyle}
                    </button>
                    <select
                      value={drawingStrokeWidth}
                      onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))}
                      className={`text-[9px] rounded px-1 py-0.5 border ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value={1.5}>1.5px</option>
                      <option value={2.5}>2.5px</option>
                      <option value={4}>4.0px</option>
                    </select>
                  </div>
                </div>

                {/* Active Guide */}
                <div className={`p-2 rounded-lg border text-[11px] ${
                  isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  {drawingPoints.length === 0 ? (
                    <p className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                      <span>Step 1: Click anywhere on graph to place <strong>Center (h, k)</strong>.</span>
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>Center: ({drawingPoints[0].x.toFixed(2)}, {drawingPoints[0].y.toFixed(2)}) → Click to set radius</span>
                      <button
                        onClick={() => setDrawingPoints([])}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Reset Center
                      </button>
                    </div>
                  )}
                </div>

                {/* List of Drawn Circles */}
                {drawnShapes.filter(s => s.type === 'circle').length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Drawn Circles ({drawnShapes.filter(s => s.type === 'circle').length})</span>
                    {drawnShapes.filter(s => s.type === 'circle').map(circle => {
                      const eq = circle.center && circle.radius ? formatCircleEquation(circle.center, circle.radius) : circle.label;
                      const area = circle.radius ? Math.PI * circle.radius * circle.radius : 0;
                      return (
                        <div key={circle.id} className={`flex flex-col gap-1.5 p-2 rounded-lg border text-xs font-mono ${
                          isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: circle.color }} />
                              <span className="font-bold text-[11px] truncate">{eq}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(eq);
                                  showToast(`Copied equation: ${eq}`);
                                }}
                                className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                title="Copy Equation"
                              >
                                <Copy size={11} />
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.map(s => s.id === circle.id ? { ...s, visible: !s.visible } : s));
                                }}
                                className={`p-1 ${circle.visible ? 'text-blue-400' : 'text-slate-500'}`}
                                title="Toggle Visibility"
                              >
                                {circle.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.filter(s => s.id !== circle.id));
                                }}
                                className="p-1 text-slate-400 hover:text-red-500"
                                title="Delete Circle"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                            <span>Radius r = {circle.radius?.toFixed(2)}</span>
                            <span>Area = {area.toFixed(2)} | Circumference = {(2 * Math.PI * (circle.radius || 0)).toFixed(2)}</span>
                          </div>

                          {/* Circle Rotation Slider */}
                          <div className={`pt-1.5 border-t flex items-center gap-1.5 text-[9.5px] ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <RotateCw size={10} className="text-blue-400 shrink-0" />
                            <span className="text-slate-400 font-sans">Rotate:</span>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="1"
                              value={circle.rotation || 0}
                              onPointerDown={() => recordHistory()}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDrawnShapes(prev => prev.map(s => s.id === circle.id ? { ...s, rotation: val } : s));
                              }}
                              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <span className="font-mono font-bold text-blue-400 w-7 text-right">
                              {Math.round(circle.rotation || 0)}°
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* --- SEMI-CIRCLE DRAWING TOOL OVERLAY --- */}
            {activeQuickAction === 'semicircle' && (
              <motion.div 
                data-export-hide="true"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`absolute top-16 left-4 z-30 backdrop-blur-md border rounded-xl p-3 shadow-2xl max-w-sm w-84 flex flex-col gap-2.5 ${
                  isDarkMode ? 'bg-[#121524]/95 border-pink-500/50 text-slate-200' : 'bg-white/95 border-pink-300 text-slate-800 shadow-pink-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 font-bold text-xs ${isDarkMode ? 'text-pink-400' : 'text-pink-700'}`}>
                    <Compass size={15} />
                    <span>🌓 Semi-Circle Drawing Tool</span>
                  </div>
                  <button onClick={() => { setActiveQuickAction(null); setDrawingPoints([]); }} className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                    <X size={14} />
                  </button>
                </div>

                {/* Orientation Selectors */}
                <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg border bg-black/10 border-slate-700/50 text-[10px]">
                  {[
                    { id: 'top', label: 'Top (∪)' },
                    { id: 'bottom', label: 'Bottom (∩)' },
                    { id: 'left', label: 'Left (⊂)' },
                    { id: 'right', label: 'Right (⊃)' },
                  ].map(ori => (
                    <button
                      key={ori.id}
                      onClick={() => setDrawingSemiOrientation(ori.id as any)}
                      className={`py-1 rounded font-medium transition-all ${
                        drawingSemiOrientation === ori.id
                          ? 'bg-pink-600 text-white font-bold'
                          : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      {ori.label}
                    </button>
                  ))}
                </div>

                {/* Colors and Stroke Width */}
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    {['#ec4899', '#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
                      <button
                        key={c}
                        onClick={() => setDrawingColor(c)}
                        className={`w-4 h-4 rounded-full border transition-transform ${
                          drawingColor === c ? 'scale-125 ring-2 ring-pink-400' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c, borderColor: isDarkMode ? '#334155' : '#cbd5e1' }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDrawingStyle(prev => prev === 'solid' ? 'dashed' : 'solid')}
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                        drawingStyle === 'dashed' ? 'bg-pink-500/20 text-pink-400 border-pink-500/40' : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {drawingStyle}
                    </button>
                    <select
                      value={drawingStrokeWidth}
                      onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))}
                      className={`text-[9px] rounded px-1 py-0.5 border ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value={1.5}>1.5px</option>
                      <option value={2.5}>2.5px</option>
                      <option value={4}>4.0px</option>
                    </select>
                  </div>
                </div>

                {/* Active Guide */}
                <div className={`p-2 rounded-lg border text-[11px] ${
                  isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  {drawingPoints.length === 0 ? (
                    <p className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
                      <span>Step 1: Click anywhere on graph to place <strong>Center (h, k)</strong>.</span>
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>Center: ({drawingPoints[0].x.toFixed(2)}, {drawingPoints[0].y.toFixed(2)}) → Click for radius</span>
                      <button
                        onClick={() => setDrawingPoints([])}
                        className="text-[10px] text-red-400 hover:underline"
                      >
                        Reset Center
                      </button>
                    </div>
                  )}
                </div>

                {/* List of Drawn Semicircles */}
                {drawnShapes.filter(s => s.type === 'semicircle').length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Drawn Semi-Circles ({drawnShapes.filter(s => s.type === 'semicircle').length})</span>
                    {drawnShapes.filter(s => s.type === 'semicircle').map(semi => {
                      const eq = semi.center && semi.radius ? formatSemicircleEquation(semi.center, semi.radius, semi.semiOrientation) : semi.label;
                      const area = semi.radius ? (Math.PI * semi.radius * semi.radius) / 2 : 0;
                      return (
                        <div key={semi.id} className={`flex flex-col gap-1.5 p-2 rounded-lg border text-xs font-mono ${
                          isDarkMode ? 'bg-[#181c30] border-slate-700/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: semi.color }} />
                              <span className="font-bold text-[11px] truncate">{eq}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(eq);
                                  showToast(`Copied equation: ${eq}`);
                                }}
                                className={`p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                                title="Copy Equation"
                              >
                                <Copy size={11} />
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.map(s => s.id === semi.id ? { ...s, visible: !s.visible } : s));
                                }}
                                className={`p-1 ${semi.visible ? 'text-pink-400' : 'text-slate-500'}`}
                                title="Toggle Visibility"
                              >
                                {semi.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                              </button>
                              <button
                                onClick={() => {
                                  recordHistory();
                                  setDrawnShapes(prev => prev.filter(s => s.id !== semi.id));
                                }}
                                className="p-1 text-slate-400 hover:text-red-500"
                                title="Delete Semi-Circle"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans">
                            <span>Orientation: {semi.semiOrientation || 'top'} | r = {semi.radius?.toFixed(2)}</span>
                            <span>Area = {area.toFixed(2)}</span>
                          </div>

                          {/* Semicircle Rotation Slider */}
                          <div className={`pt-1.5 border-t flex items-center gap-1.5 text-[9.5px] ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                            <RotateCw size={10} className="text-pink-400 shrink-0" />
                            <span className="text-slate-400 font-sans">Rotate:</span>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="1"
                              value={semi.rotation || 0}
                              onPointerDown={() => recordHistory()}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setDrawnShapes(prev => prev.map(s => s.id === semi.id ? { ...s, rotation: val } : s));
                              }}
                              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                            />
                            <span className="font-mono font-bold text-pink-400 w-7 text-right">
                              {Math.round(semi.rotation || 0)}°
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Right Controls Bar */}
          <div data-export-hide="true" className={`absolute top-16 right-4 z-20 flex flex-col items-center gap-1.5 backdrop-blur-md border rounded-xl p-2 shadow-2xl ${
            isDarkMode 
              ? 'bg-[#121524]/95 border-slate-700/80 shadow-black/40' 
              : 'bg-white/95 border-slate-300 shadow-slate-300/50'
          }`}>
            {/* Pointer Tool */}
            <button 
              onClick={() => setActiveGraphTool('select')}
              className={`p-1.5 rounded-lg transition-all ${
                activeGraphTool === 'select' 
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50' 
                  : (isDarkMode ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }`}
              title="Pointer / Select Tool (Click to inspect / select)"
            >
              <MousePointer size={15} />
            </button>

            {/* Pan Tool */}
            <button 
              onClick={() => setActiveGraphTool('pan')}
              className={`p-1.5 rounded-lg transition-all ${
                activeGraphTool === 'pan' 
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50' 
                  : (isDarkMode ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
              }`}
              title="Pan Canvas (Click and drag to move graph)"
            >
              <Hand size={15} />
            </button>

            <div className={`w-full h-px my-0.5 ${isDarkMode ? 'bg-slate-800/80' : 'bg-slate-200'}`} />

            {/* Continuous Vertical Zoom Slider Container */}
            <div className="flex flex-col items-center gap-1.5 py-1">
              {/* Zoom In Button (+ at top) */}
              <button 
                onClick={() => handleContinuousZoom(Math.min(100, zoomPercent + 5))}
                className={`p-1 rounded transition-colors ${
                  isDarkMode 
                    ? 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/60' 
                    : 'text-indigo-600 hover:text-indigo-800 hover:bg-slate-100'
                }`}
                title="Zoom In (+)"
              >
                <ZoomIn size={14} />
              </button>

              {/* Vertical Slider Track (Up = Zoom In, Down = Zoom Out) */}
              <div className="h-32 w-8 flex items-center justify-center relative my-0.5">
                <input 
                  type="range"
                  {...({ orient: 'vertical' } as any)}
                  min="0"
                  max="100"
                  step="1"
                  value={Math.max(0, Math.min(100, zoomPercent))}
                  onChange={(e) => handleContinuousZoom(parseFloat(e.target.value))}
                  className={`h-28 w-3 accent-indigo-500 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/50 ${
                    isDarkMode ? 'bg-slate-800/90' : 'bg-slate-200'
                  }`}
                  style={{
                    WebkitAppearance: 'slider-vertical',
                    writingMode: 'vertical-lr',
                  }}
                  title={`Continuous Zoom: ${zoomPercent}% (0% to 100%, slide up to zoom in, down to zoom out)`}
                />
              </div>

              {/* Zoom Out Button (- at bottom) */}
              <button 
                onClick={() => handleContinuousZoom(Math.max(0, zoomPercent - 5))}
                className={`p-1 rounded transition-colors ${
                  isDarkMode 
                    ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Zoom Out (-)"
              >
                <ZoomOut size={14} />
              </button>

              {/* Zoom Scale Badge */}
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border whitespace-nowrap shadow-sm min-w-[40px] text-center mt-0.5 ${
                isDarkMode 
                  ? 'text-indigo-300 bg-indigo-950/90 border-indigo-500/30' 
                  : 'text-indigo-800 bg-indigo-50 border-indigo-200'
              }`}>
                {zoomPercent}%
              </span>
            </div>

            <div className={`w-full h-px my-0.5 ${isDarkMode ? 'bg-slate-800/80' : 'bg-slate-200'}`} />

            {/* Reset View Fit */}
            <button 
              onClick={() => {
                setActiveGraphTool('select');
                handleResetZoom();
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Reset View Fit (25% default)"
            >
              <Focus size={15} />
            </button>
          </div>

          {/* Floating Bottom Zoom Status Toolbar */}
          <div data-export-hide="true" className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 backdrop-blur-md border rounded-xl px-3 py-1.5 shadow-xl flex items-center gap-3 ${
            isDarkMode 
              ? 'bg-[#121524]/90 border-slate-700/80 text-slate-200' 
              : 'bg-white/90 border-slate-300 text-slate-800 shadow-slate-200/50'
          }`}>
            <button 
              onClick={() => handleZoom(0.8)} 
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <ZoomOut size={14} />
            </button>
            <span className={`font-mono text-xs font-semibold min-w-[45px] text-center ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>
              {zoomPercent}%
            </span>
            <button 
              onClick={() => handleZoom(1.25)} 
              className={`p-1 rounded transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <ZoomIn size={14} />
            </button>

            <div className={`w-px h-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

            <button 
              onClick={() => setIsGridLocked(!isGridLocked)}
              className={`p-1 transition-colors ${
                isGridLocked 
                  ? 'text-indigo-500' 
                  : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700')
              }`}
              title={isGridLocked ? "Unlock Grid Zoom" : "Lock Grid Zoom"}
            >
              {isGridLocked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>
          </div>

          {/* --- SMART INPUT BOTTOM BAR --- */}
          <div data-export-hide="true" className={`border-t px-4 py-2.5 z-20 flex items-center gap-3 ${
            isDarkMode ? 'bg-[#0e1120] border-slate-800/80' : 'bg-slate-100 border-slate-200'
          }`}>
            <div className={`flex items-center gap-1.5 text-xs font-bold shrink-0 pr-2 border-r ${
              isDarkMode ? 'text-indigo-400 border-slate-800' : 'text-indigo-600 border-slate-300'
            }`}>
              <Sparkles size={14} />
              <span>Smart Input</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              {[
                'x^2', 'sqrt(x)', 'sin(x)', 'cos(x)', 'tan(x)', 'ln(x)', 'e^x', 'abs(x)', 'pi', '...'
              ].map(snippet => (
                <button
                  key={snippet}
                  onClick={() => appendSmartInput(snippet)}
                  className={`border rounded-lg px-2.5 py-1 text-xs font-mono transition-all active:scale-95 shrink-0 ${
                    isDarkMode 
                      ? 'bg-[#161a2e] hover:bg-slate-800/80 text-slate-300 border-slate-700/60' 
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm'
                  }`}
                >
                  {snippet === 'x^2' ? 'x²' : snippet === 'sqrt(x)' ? '√x' : snippet === 'e^x' ? 'eˣ' : snippet === 'abs(x)' ? '|x|' : snippet === 'pi' ? 'π' : snippet}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* --- HELP & USER GUIDE MODAL --- */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
                isDarkMode ? 'bg-[#0f1222] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-5 border-b flex items-center justify-between ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Linecraft Help & User Guide</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Master function input, calculus tools, and graph exports
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className={`flex items-center gap-2 px-5 pt-3 border-b text-xs font-semibold ${
                isDarkMode ? 'border-slate-800' : 'border-slate-200'
              }`}>
                {[
                  { id: 'syntax', label: 'Syntax & Math' },
                  { id: 'tools', label: 'Graph Controls' },
                  { id: 'calculus', label: 'Calculus Tools' },
                  { id: 'export', label: 'PDF Exporting' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHelpActiveTab(tab.id as any)}
                    className={`pb-2.5 px-3 border-b-2 transition-all ${
                      helpActiveTab === tab.id
                        ? 'border-indigo-500 text-indigo-400 font-bold'
                        : isDarkMode
                          ? 'border-transparent text-slate-400 hover:text-slate-200'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Area */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {helpActiveTab === 'syntax' && (
                  <div className="space-y-4">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Enter mathematical expressions into the top search bar or smart input bar. You can type variables using <code className="text-indigo-400 font-mono">x</code>.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5 font-mono">
                      {[
                        { expr: 'x^2 + 2x - 3', desc: 'Polynomials & powers' },
                        { expr: 'sin(x), cos(x), tan(x)', desc: 'Trigonometric functions' },
                        { expr: 'sqrt(x)', desc: 'Square root function' },
                        { expr: 'ln(x) or log(x)', desc: 'Natural & base-10 log' },
                        { expr: 'e^x or exp(x)', desc: 'Exponential functions' },
                        { expr: 'abs(x)', desc: 'Absolute value |x|' },
                        { expr: 'pi, e', desc: 'Constants' },
                        { expr: '(x - 1)*(x + 3)', desc: 'Multiplication & brackets' },
                      ].map((item, i) => (
                        <div key={i} className={`p-2.5 rounded-xl border ${
                          isDarkMode ? 'bg-[#14172a] border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="text-indigo-400 font-bold">{item.expr}</div>
                          <div className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {helpActiveTab === 'tools' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Use interactive controls to explore functions in high resolution:
                    </p>
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><Sliders size={14} /></span>
                        <div>
                          <strong className="text-slate-200">Vertical Zoom Slider (0% - 100%):</strong> Located on the right edge of the graph. Smoothly scales the view scale from 100x zoom down to full 100% view.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><Move size={14} /></span>
                        <div>
                          <strong className="text-slate-200">Pan & Drag:</strong> Select the Pan tool from the right toolbar and click-drag the grid to shift coordinates.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><Undo2 size={14} /></span>
                        <div>
                          <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Undo & Redo:</strong> Click the Undo / Redo buttons next to the Day/Night toggle or use <kbd className="font-mono font-semibold px-1 py-0.5 rounded bg-slate-800 text-indigo-300">Ctrl+Z</kbd> and <kbd className="font-mono font-semibold px-1 py-0.5 rounded bg-slate-800 text-indigo-300">Ctrl+Y</kbd> (or <kbd className="font-mono font-semibold px-1 py-0.5 rounded bg-slate-800 text-indigo-300">Ctrl+Shift+Z</kbd>) to easily revert or reapply function edits, pins, or grid preferences.
                        </div>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="p-1 bg-indigo-500/20 text-indigo-400 rounded mt-0.5"><MapPin size={14} /></span>
                        <div>
                          <strong className={isDarkMode ? 'text-slate-200' : 'text-slate-800'}>Point Pinning:</strong> Click "Pin Point" and click anywhere on a curve to lock exact coordinates on screen.
                        </div>
                      </li>
                    </ul>
                  </div>
                )}

                {helpActiveTab === 'calculus' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Perform advanced numerical analysis and calculus operations:
                    </p>
                    <ul className="space-y-2">
                      <li className="p-2.5 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                        <strong className="text-indigo-300">Tangent Lines:</strong> Select "Tangent Line", click on any curve x-value to calculate and plot the exact tangent line equation and slope f'(x).
                      </li>
                      <li className="p-2.5 rounded-xl border bg-purple-500/5 border-purple-500/20">
                        <strong className="text-purple-300">Area Integration:</strong> Define lower (a) and upper (b) bounds to shade the area under the curve and calculate definite integral values.
                      </li>
                      <li className="p-2.5 rounded-xl border bg-blue-500/5 border-blue-500/20">
                        <strong className="text-blue-300">Derivative Curve Overlay:</strong> Toggle f'(x) in the function panel to view the instant slope derivative curve drawn alongside f(x).
                      </li>
                    </ul>
                  </div>
                )}

                {helpActiveTab === 'export' && (
                  <div className="space-y-3">
                    <p className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>
                      Export clean, high-resolution graphics for homework, presentations, or research:
                    </p>
                    <div className={`p-3.5 rounded-xl border ${
                      isDarkMode ? 'bg-[#14172a] border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      <p className="font-semibold text-indigo-400 mb-1">Graph-Only Clean Export</p>
                      <p>
                        When exporting to PDF, PNG, or SVG, all navigation sidebars, floating toolbars, toast popups, and search inputs are automatically hidden, producing a clean, publication-ready graph output.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex justify-end ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
                >
                  Got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- SETTINGS & PREFERENCES MODAL --- */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
                isDarkMode ? 'bg-[#0f1222] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Modal Header */}
              <div className={`p-5 border-b flex items-center justify-between ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">Settings & Preferences</h2>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Customize grid rendering, units, theme, and precision
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Settings Form Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                
                {/* Theme Setting */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDarkMode ? 'border-slate-800 bg-[#14172a]' : 'border-slate-200 bg-slate-50'
                }`}>
                  <div>
                    <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Appearance Mode</label>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Toggle between Day (Light) and Night (Dark) themes</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsDarkMode(!isDarkMode);
                      showToast(!isDarkMode ? "Night Mode Enabled" : "Day Mode Enabled");
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700' 
                        : 'bg-white border-slate-300 text-indigo-600 hover:bg-slate-100 shadow-sm'
                    }`}
                  >
                    {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{isDarkMode ? 'Night Mode' : 'Day Mode'}</span>
                  </button>
                </div>

                {/* Grid Type Setting */}
                <div className="space-y-2">
                  <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Coordinate Grid Style</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'Cartesian', label: 'Cartesian' },
                      { id: 'Polar', label: 'Polar Grid' },
                      { id: 'Isometric', label: 'Isometric' },
                      { id: 'Blank', label: 'Blank' },
                    ].map(styleOption => (
                      <button
                        key={styleOption.id}
                        onClick={() => {
                          recordHistory();
                          setGridStyle(styleOption.id as any);
                          showToast(`Grid set to ${styleOption.label}`);
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          gridStyle === styleOption.id
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                            : isDarkMode
                              ? 'bg-[#14172a] border-slate-800 text-slate-300 hover:bg-slate-800'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {styleOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Angle Unit Setting */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  isDarkMode ? 'border-slate-800 bg-[#14172a]' : 'border-slate-200 bg-slate-50'
                }`}>
                  <div>
                    <label className={`font-bold block ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Trigonometric Angle Unit</label>
                    <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Unit for sin(x), cos(x), tan(x) evaluation</span>
                  </div>
                  <div className={`flex items-center p-1 rounded-lg border ${
                    isDarkMode ? 'bg-[#0e1120] border-slate-700' : 'bg-white border-slate-300'
                  }`}>
                    <button
                      onClick={() => {
                        recordHistory();
                        setAngleUnit('radians');
                        showToast("Angle unit set to Radians");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        angleUnit === 'radians' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      Radians
                    </button>
                    <button
                      onClick={() => {
                        recordHistory();
                        setAngleUnit('degrees');
                        showToast("Angle unit set to Degrees");
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        angleUnit === 'degrees' 
                          ? 'bg-indigo-600 text-white shadow-sm' 
                          : (isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900')
                      }`}
                    >
                      Degrees
                    </button>
                  </div>
                </div>

                {/* Decimal Precision */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Decimal Precision</label>
                    <span className={`font-mono font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{decimalPrecision} Decimals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map(precision => (
                      <button
                        key={precision}
                        onClick={() => {
                          recordHistory();
                          setDecimalPrecision(precision);
                        }}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                          decimalPrecision === precision
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                            : isDarkMode
                              ? 'bg-[#14172a] border-slate-800 text-slate-400 hover:bg-slate-800'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {precision} Dec
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Toggles */}
                <div className={`space-y-2 pt-2 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Show Grid Lines</span>
                    <input 
                      type="checkbox"
                      checked={showGridLines}
                      onChange={(e) => setShowGridLines(e.target.checked)}
                      className="rounded border-slate-400 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className={`font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Show Axis Ticks & Labels</span>
                    <input 
                      type="checkbox"
                      checked={showAxisLabels}
                      onChange={(e) => setShowAxisLabels(e.target.checked)}
                      className="rounded border-slate-400 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

              </div>

              {/* Modal Footer */}
              <div className={`p-4 border-t flex justify-end gap-2 ${
                isDarkMode ? 'border-slate-800 bg-[#14182e]' : 'border-slate-200 bg-slate-50'
              }`}>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    showToast("Settings Saved Successfully!");
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-xs shadow-md transition-all active:scale-95"
                >
                  Save & Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        isDarkMode={isDarkMode}
        currentUserEmail={currentUser?.email || ''}
      />
    </div>
  );
}
