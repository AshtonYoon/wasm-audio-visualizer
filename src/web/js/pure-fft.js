/**
 * 순수 JavaScript FFT 구현
 * Cooley-Tukey 알고리즘 사용
 * 시간 복잡도: O(N log N)
 */
export class PureFFT {
    constructor(size) {
        this.size = size;

        // FFT는 2의 거듭제곱 크기만 지원
        if (!this.isPowerOfTwo(size)) {
            throw new Error(`FFT size must be a power of 2, got ${size}`);
        }

        // Bit-reversal 테이블 사전 계산
        this.reversedBits = new Uint32Array(size);
        this.computeReversedBits();

        // Twiddle factor (회전 인자) 사전 계산
        this.twiddleCos = new Float32Array(size / 2);
        this.twiddleSin = new Float32Array(size / 2);
        this.computeTwiddleFactors();
    }

    /**
     * 숫자가 2의 거듭제곱인지 확인
     */
    isPowerOfTwo(n) {
        return n > 0 && (n & (n - 1)) === 0;
    }

    /**
     * Bit-reversal 테이블 사전 계산
     * FFT의 첫 단계에서 입력을 재배치하는 데 사용
     */
    computeReversedBits() {
        const n = this.size;
        const log2n = Math.log2(n);

        for (let i = 0; i < n; i++) {
            let reversed = 0;
            let temp = i;

            for (let j = 0; j < log2n; j++) {
                reversed = (reversed << 1) | (temp & 1);
                temp >>= 1;
            }

            this.reversedBits[i] = reversed;
        }
    }

    /**
     * Twiddle factor 사전 계산
     * W_N^k = e^(-2πik/N) = cos(2πk/N) - i*sin(2πk/N)
     */
    computeTwiddleFactors() {
        const n = this.size;

        for (let k = 0; k < n / 2; k++) {
            const angle = -2 * Math.PI * k / n;
            this.twiddleCos[k] = Math.cos(angle);
            this.twiddleSin[k] = Math.sin(angle);
        }
    }

    /**
     * 복소수 배열 생성 (실수부와 허수부 인터리브)
     * @returns {Float32Array} 크기 2*N인 배열
     */
    createComplexArray() {
        return new Float32Array(this.size * 2);
    }

    /**
     * 실수 입력 데이터에 대한 FFT 수행
     * Cooley-Tukey 알고리즘 사용
     *
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Array|Float32Array} input - 실수 입력 배열
     */
    realTransform(output, input) {
        const n = this.size;

        // 1단계: Bit-reversal 순서로 입력 재배치
        for (let i = 0; i < n; i++) {
            const j = this.reversedBits[i];
            output[2 * j] = input[i];      // 실수부
            output[2 * j + 1] = 0;         // 허수부 (실수 입력이므로 0)
        }

        // 2단계: Butterfly 연산 수행 (log2(N) 스테이지)
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const angleStep = n / len;

            // 각 블록에 대해
            for (let i = 0; i < n; i += len) {
                // 블록 내의 각 쌍에 대해 butterfly 연산
                for (let j = 0; j < halfLen; j++) {
                    const k = i + j;
                    const l = i + j + halfLen;

                    // Twiddle factor
                    const twiddleIdx = j * angleStep;
                    const twiddleReal = this.twiddleCos[twiddleIdx];
                    const twiddleImag = this.twiddleSin[twiddleIdx];

                    // 복소수 곱셈: t = twiddle * output[l]
                    const outLReal = output[2 * l];
                    const outLImag = output[2 * l + 1];

                    const tReal = twiddleReal * outLReal - twiddleImag * outLImag;
                    const tImag = twiddleReal * outLImag + twiddleImag * outLReal;

                    // Butterfly 연산
                    const outKReal = output[2 * k];
                    const outKImag = output[2 * k + 1];

                    output[2 * k] = outKReal + tReal;
                    output[2 * k + 1] = outKImag + tImag;
                    output[2 * l] = outKReal - tReal;
                    output[2 * l + 1] = outKImag - tImag;
                }
            }
        }
    }

    /**
     * 역 FFT 수행
     *
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Float32Array} input - 복소수 입력 배열 (실수/허수 인터리브)
     */
    inverseTransform(output, input) {
        const n = this.size;

        // 켤레 복소수로 변환 (허수부 부호 반전)
        const temp = new Float32Array(n * 2);
        for (let i = 0; i < n; i++) {
            temp[2 * i] = input[2 * i];
            temp[2 * i + 1] = -input[2 * i + 1];
        }

        // FFT 수행
        this.complexTransform(output, temp);

        // 결과를 켤레로 변환하고 1/N로 스케일링
        for (let i = 0; i < n; i++) {
            output[2 * i] = output[2 * i] / n;
            output[2 * i + 1] = -output[2 * i + 1] / n;
        }
    }

    /**
     * 복소수 입력 데이터에 대한 FFT 수행
     *
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Float32Array} input - 복소수 입력 배열 (실수/허수 인터리브)
     */
    complexTransform(output, input) {
        const n = this.size;

        // 1단계: Bit-reversal 순서로 입력 재배치
        for (let i = 0; i < n; i++) {
            const j = this.reversedBits[i];
            output[2 * j] = input[2 * i];
            output[2 * j + 1] = input[2 * i + 1];
        }

        // 2단계: Butterfly 연산 수행 (log2(N) 스테이지)
        for (let len = 2; len <= n; len *= 2) {
            const halfLen = len / 2;
            const angleStep = n / len;

            // 각 블록에 대해
            for (let i = 0; i < n; i += len) {
                // 블록 내의 각 쌍에 대해 butterfly 연산
                for (let j = 0; j < halfLen; j++) {
                    const k = i + j;
                    const l = i + j + halfLen;

                    // Twiddle factor
                    const twiddleIdx = j * angleStep;
                    const twiddleReal = this.twiddleCos[twiddleIdx];
                    const twiddleImag = this.twiddleSin[twiddleIdx];

                    // 복소수 곱셈: t = twiddle * output[l]
                    const outLReal = output[2 * l];
                    const outLImag = output[2 * l + 1];

                    const tReal = twiddleReal * outLReal - twiddleImag * outLImag;
                    const tImag = twiddleReal * outLImag + twiddleImag * outLReal;

                    // Butterfly 연산
                    const outKReal = output[2 * k];
                    const outKImag = output[2 * k + 1];

                    output[2 * k] = outKReal + tReal;
                    output[2 * k + 1] = outKImag + tImag;
                    output[2 * l] = outKReal - tReal;
                    output[2 * l + 1] = outKImag - tImag;
                }
            }
        }
    }
}

export default PureFFT;
