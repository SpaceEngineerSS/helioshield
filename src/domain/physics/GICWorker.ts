// Web Worker for calculating Geoelectric Field (E) using Fast Fourier Transform

/**
 * Basic complex number operations for FFT
 */
class Complex {
  re: number;
  im: number;
  constructor(re: number, im: number) {
    this.re = re;
    this.im = im;
  }
  add(other: Complex) { return new Complex(this.re + other.re, this.im + other.im); }
  sub(other: Complex) { return new Complex(this.re - other.re, this.im - other.im); }
  mul(other: Complex) { 
    return new Complex(
      this.re * other.re - this.im * other.im, 
      this.re * other.im + this.im * other.re
    ); 
  }
  divScalar(scalar: number) { return new Complex(this.re / scalar, this.im / scalar); }
  static exp(im: number) { return new Complex(Math.cos(im), Math.sin(im)); }
}

/**
 * Radix-2 Cooley-Tukey FFT
 */
function fft(x: Complex[]): Complex[] {
  const N = x.length;
  if (N <= 1) return x;
  
  const even = fft(x.filter((_, i) => i % 2 === 0));
  const odd = fft(x.filter((_, i) => i % 2 !== 0));
  
  const res = new Array<Complex>(N);
  for (let k = 0; k < N / 2; k++) {
    const t = Complex.exp(-2 * Math.PI * k / N).mul(odd[k]);
    res[k] = even[k].add(t);
    res[k + N / 2] = even[k].sub(t);
  }
  return res;
}

/**
 * Inverse FFT
 */
function ifft(x: Complex[]): Complex[] {
  const N = x.length;
  // Conjugate
  let conj = x.map(c => new Complex(c.re, -c.im));
  // FFT
  conj = fft(conj);
  // Conjugate and scale
  return conj.map(c => new Complex(c.re / N, -c.im / N));
}

// Ensure array length is a power of 2 by padding with zeros
function padToPowerOfTwo(arr: number[]): number[] {
  const len = arr.length;
  let power = 1;
  while (power < len) power *= 2;
  const padded = new Array(power).fill(0);
  for (let i = 0; i < len; i++) padded[i] = arr[i];
  return padded;
}

self.onmessage = (e: MessageEvent) => {
  const { bFieldSeries, resistivityOhmM, dtSeconds } = e.data;
  
  if (!bFieldSeries || bFieldSeries.length === 0) {
    self.postMessage({ error: 'Empty B-field series' });
    return;
  }

  // Constants
  const mu_0 = 4 * Math.PI * 1e-7;
  const sigma = 1.0 / resistivityOhmM; // Conductivity (S/m)

  // 1. Prepare data (pad to power of 2)
  const paddedB = padToPowerOfTwo(bFieldSeries);
  const N = paddedB.length;
  
  // Convert to Complex array
  const complexB = paddedB.map(b => new Complex(b, 0));

  // 2. Perform FFT
  const B_omega = fft(complexB);

  // 3. Apply Lehtinen-Pirjola transfer function: E(omega) = sqrt(j * omega * mu_0 / sigma) * B(omega)
  // Note: j = sqrt(-1). 
  // sqrt(j * omega) = sqrt(omega) * exp(j * pi / 4) for omega > 0
  // sqrt(j * omega) = sqrt(|omega|) * exp(-j * pi / 4) for omega < 0
  const E_omega = new Array<Complex>(N);
  
  // df is frequency resolution
  const df = 1.0 / (N * dtSeconds);

  for (let k = 0; k < N; k++) {
    // Frequency corresponding to index k
    const f = k <= N / 2 ? k * df : (k - N) * df;
    const omega = 2 * Math.PI * f;
    
    if (omega === 0) {
      E_omega[k] = new Complex(0, 0);
    } else {
      const absOmega = Math.abs(omega);
      const magnitude = Math.sqrt((absOmega * mu_0) / sigma);
      const phase = omega > 0 ? Math.PI / 4 : -Math.PI / 4;
      
      const transferFunc = new Complex(
        magnitude * Math.cos(phase),
        magnitude * Math.sin(phase)
      );
      
      E_omega[k] = B_omega[k].mul(transferFunc);
    }
  }

  // 4. Inverse FFT to get E(t)
  const E_t_complex = ifft(E_omega);
  
  // Extract real part and return original length (unpad)
  // E_t is typically in V/m or mV/km. B was likely in nT.
  // 1 nT = 1e-9 T. E will be in V/m * 1e-9. Multiply by 1e6 to get mV/km.
  const E_t = E_t_complex.slice(0, bFieldSeries.length).map(c => c.re * 1e-9 * 1e6); // mV/km
  
  self.postMessage({ eFieldSeries: E_t });
};
