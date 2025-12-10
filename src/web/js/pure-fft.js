/**
 * 순수 JavaScript DFT 구현
 * 이산 푸리에 변환의 직접 계산
 * 시간 복잡도: O(N²)
 */
export class PureFFT {
    constructor(size) {
        this.size = size;

        // 모든 k*n 조합에 대한 코사인 및 사인 테이블 사전 계산
        // 삼각함수 호출 횟수 감소
        this.cosTable = new Float32Array(size * size);
        this.sinTable = new Float32Array(size * size);
        this.computeTrigTables();
    }

    /**
     * DFT를 위한 삼각함수 값 사전 계산
     * 모든 k, n에 대해 cos(2πkn/N)과 sin(2πkn/N) 계산
     */
    computeTrigTables() {
        const n = this.size;
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                const angle = 2 * Math.PI * k * i / n;
                this.cosTable[k * n + i] = Math.cos(angle);
                this.sinTable[k * n + i] = Math.sin(angle);
            }
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
     * 실수 입력 데이터에 대한 DFT 수행
     * DFT 공식: X[k] = Σ(n=0 to N-1) x[n] * e^(-2πikn/N)
     *         = Σ(n=0 to N-1) x[n] * (cos(2πkn/N) - i*sin(2πkn/N))
     *
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Array|Float32Array} input - 실수 입력 배열
     */
    realTransform(output, input) {
        const n = this.size;

        // 각 주파수 빈 k에 대해 DFT 계산
        for (let k = 0; k < n; k++) {
            let sumReal = 0;
            let sumImag = 0;

            // 모든 시간 샘플에 대해 합산
            for (let i = 0; i < n; i++) {
                const cos = this.cosTable[k * n + i];
                const sin = this.sinTable[k * n + i];

                // X[k] = Σ x[n] * (cos(2πkn/N) - i*sin(2πkn/N))
                sumReal += input[i] * cos;
                sumImag += -input[i] * sin;
            }

            // 인터리브된 복소수 출력 저장
            output[2 * k] = sumReal;
            output[2 * k + 1] = sumImag;
        }
    }

    /**
     * 역 DFT 수행
     * IDFT 공식: x[n] = (1/N) * Σ(k=0 to N-1) X[k] * e^(2πikn/N)
     *
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Float32Array} input - 복소수 입력 배열 (실수/허수 인터리브)
     */
    inverseTransform(output, input) {
        const n = this.size;

        // 각 시간 샘플에 대해 IDFT 계산
        for (let i = 0; i < n; i++) {
            let sumReal = 0;
            let sumImag = 0;

            // 모든 주파수 빈에 대해 합산
            for (let k = 0; k < n; k++) {
                const cos = this.cosTable[k * n + i];
                const sin = this.sinTable[k * n + i];

                const inputReal = input[2 * k];
                const inputImag = input[2 * k + 1];

                // x[n] = Σ X[k] * (cos(2πkn/N) + i*sin(2πkn/N))
                sumReal += inputReal * cos - inputImag * sin;
                sumImag += inputReal * sin + inputImag * cos;
            }

            // 1/N로 스케일링하고 저장
            output[2 * i] = sumReal / n;
            output[2 * i + 1] = sumImag / n;
        }
    }

    /**
     * 복소수 입력 데이터에 대한 DFT 수행
     * @param {Float32Array} output - 복소수 출력 배열 (실수/허수 인터리브)
     * @param {Float32Array} input - 복소수 입력 배열 (실수/허수 인터리브)
     */
    complexTransform(output, input) {
        const n = this.size;

        // 각 주파수 빈 k에 대해 DFT 계산
        for (let k = 0; k < n; k++) {
            let sumReal = 0;
            let sumImag = 0;

            // 모든 시간 샘플에 대해 합산
            for (let i = 0; i < n; i++) {
                const cos = this.cosTable[k * n + i];
                const sin = this.sinTable[k * n + i];

                const inputReal = input[2 * i];
                const inputImag = input[2 * i + 1];

                // 복소수 곱셈: (a + bi) * (c - di)
                // X[k] = Σ (x_real + i*x_imag) * (cos - i*sin)
                sumReal += inputReal * cos + inputImag * sin;
                sumImag += inputImag * cos - inputReal * sin;
            }

            // 인터리브된 복소수 출력 저장
            output[2 * k] = sumReal;
            output[2 * k + 1] = sumImag;
        }
    }
}

export default PureFFT;
