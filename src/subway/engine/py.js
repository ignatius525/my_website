/*
 * The few CPython float semantics the port depends on.
 *
 * The engine is checked against the original Python for identical output, and
 * these are the places where JavaScript's operators differ from Python's.
 */

/** Python's `x % y` for floats: the result takes the sign of the divisor. */
export function pyMod(x, y) {
  let mod = x % y; // C fmod
  if (mod) {
    if ((y < 0) !== (mod < 0)) mod += y;
  } else {
    mod = y < 0 ? -0 : 0;
  }
  return mod;
}

/** Python's `x // y` for floats (CPython's _float_div_mod, not Math.floor(x / y)). */
export function pyFloorDiv(x, y) {
  let mod = x % y;
  let div = (x - mod) / y;
  if (mod && ((y < 0) !== (mod < 0))) div -= 1.0;
  if (div) {
    let floordiv = Math.floor(div);
    if (div - floordiv > 0.5) floordiv += 1.0;
    return floordiv;
  }
  return (x / y) < 0 ? -0 : 0;
}

/** Python 3.12+ `sum()` of floats: Neumaier compensated summation. */
export function pySum(arr, lo = 0, hi = arr.length) {
  let s = 0.0;
  let c = 0.0;
  for (let i = lo; i < hi; i++) {
    const x = arr[i];
    const t = s + x;
    if (Math.abs(s) >= Math.abs(x)) c += (s - t) + x;
    else c += (x - t) + s;
    s = t;
  }
  if (c && Number.isFinite(c)) s += c;
  return s;
}

/** bisect.bisect_right: first index whose value is > x. */
export function bisectRight(a, x) {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x < a[mid]) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Python's int() on a float: truncate toward zero. */
export const pyInt = (x) => Math.trunc(x);
