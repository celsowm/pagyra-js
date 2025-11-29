import { describe, it, expect } from 'vitest';
import {
    calculateTotalGap,
    calculateAvailableSpace,
    calculateItemOffsets,
    calculateTrackOffsets,
    GapCalculator,
} from '../../src/layout/utils/gap-calculator.js';

describe('Gap Calculator Utilities', () => {
    describe('calculateTotalGap', () => {
        it('should return 0 for single item', () => {
            expect(calculateTotalGap(10, 1)).toBe(0);
        });

        it('should return 0 for zero items', () => {
            expect(calculateTotalGap(10, 0)).toBe(0);
        });

        it('should return 0 for negative gap', () => {
            expect(calculateTotalGap(-10, 3)).toBe(0);
        });

        it('should return 0 for zero gap', () => {
            expect(calculateTotalGap(0, 3)).toBe(0);
        });

        it('should calculate correct gap for 2 items', () => {
            expect(calculateTotalGap(10, 2)).toBe(10);
        });

        it('should calculate correct gap for 3 items', () => {
            expect(calculateTotalGap(10, 3)).toBe(20);
        });

        it('should calculate correct gap for 5 items', () => {
            expect(calculateTotalGap(15, 5)).toBe(60); // 15 * (5-1) = 60
        });

        it('should handle decimal gaps', () => {
            expect(calculateTotalGap(10.5, 3)).toBe(21); // 10.5 * 2 = 21
        });
    });

    describe('calculateAvailableSpace', () => {
        it('should return full space when gap is 0', () => {
            expect(calculateAvailableSpace(100, 0, 3)).toBe(100);
        });

        it('should return full space for single item', () => {
            expect(calculateAvailableSpace(100, 10, 1)).toBe(100);
        });

        it('should subtract total gap from available space', () => {
            expect(calculateAvailableSpace(100, 10, 3)).toBe(80); // 100 - 20
        });

        it('should return 0 when gap exceeds available space', () => {
            expect(calculateAvailableSpace(50, 30, 3)).toBe(0); // 50 - 60 = -10, clamped to 0
        });

        it('should handle negative total space gracefully', () => {
            expect(calculateAvailableSpace(-10, 5, 3)).toBe(0);
        });

        it('should work with decimal values', () => {
            expect(calculateAvailableSpace(100.5, 10.5, 3)).toBe(79.5); // 100.5 - 21
        });
    });

    describe('calculateItemOffsets', () => {
        it('should return [0] for single item', () => {
            expect(calculateItemOffsets([50], 10)).toEqual([0]);
        });

        it('should calculate offsets with no gap', () => {
            expect(calculateItemOffsets([50, 30, 40], 0)).toEqual([0, 50, 80]);
        });

        it('should calculate offsets with gap', () => {
            expect(calculateItemOffsets([50, 30, 40], 10)).toEqual([0, 60, 100]);
            // Item 0: 0
            // Item 1: 50 + 10 = 60
            // Item 2: 50 + 10 + 30 + 10 = 100
        });

        it('should handle empty array', () => {
            expect(calculateItemOffsets([], 10)).toEqual([]);
        });

        it('should handle uniform sizes', () => {
            expect(calculateItemOffsets([50, 50, 50], 10)).toEqual([0, 60, 120]);
        });

        it('should work with decimal values', () => {
            expect(calculateItemOffsets([50.5, 30.5, 40], 10.5)).toEqual([0, 61, 102]);
            // Item 0: 0
            // Item 1: 50.5 + 10.5 = 61
            // Item 2: 50.5 + 10.5 + 30.5 + 10.5 = 102
        });

        it('should handle zero-sized items', () => {
            expect(calculateItemOffsets([0, 50, 0, 30], 10)).toEqual([0, 10, 70, 80]);
        });
    });

    describe('calculateTrackOffsets', () => {
        it('should be equivalent to calculateItemOffsets', () => {
            const sizes = [100, 150, 200];
            const gap = 20;
            expect(calculateTrackOffsets(sizes, gap)).toEqual(calculateItemOffsets(sizes, gap));
        });

        it('should calculate grid track offsets correctly', () => {
            expect(calculateTrackOffsets([100, 150, 200], 20)).toEqual([0, 120, 290]);
            // Track 0: 0
            // Track 1: 100 + 20 = 120
            // Track 2: 100 + 20 + 150 + 20 = 290
        });
    });

    describe('GapCalculator', () => {
        describe('getMainAxisGap', () => {
            it('should return columnGap for row direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.getMainAxisGap(true)).toBe(20);
            });

            it('should return rowGap for column direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.getMainAxisGap(false)).toBe(10);
            });
        });

        describe('getCrossAxisGap', () => {
            it('should return rowGap for row direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.getCrossAxisGap(true)).toBe(10);
            });

            it('should return columnGap for column direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.getCrossAxisGap(false)).toBe(20);
            });
        });

        describe('calculateMainAxisTotalGap', () => {
            it('should calculate gap for row direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.calculateMainAxisTotalGap(true, 3)).toBe(40); // columnGap * 2
            });

            it('should calculate gap for column direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.calculateMainAxisTotalGap(false, 3)).toBe(20); // rowGap * 2
            });

            it('should return 0 for single item', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.calculateMainAxisTotalGap(true, 1)).toBe(0);
            });
        });

        describe('calculateMainAxisAvailableSpace', () => {
            it('should calculate available space for row direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.calculateMainAxisAvailableSpace(true, 100, 3)).toBe(60); // 100 - 40
            });

            it('should calculate available space for column direction', () => {
                const calc = new GapCalculator({ rowGap: 10, columnGap: 20 });
                expect(calc.calculateMainAxisAvailableSpace(false, 100, 3)).toBe(80); // 100 - 20
            });

            it('should handle insufficient space', () => {
                const calc = new GapCalculator({ rowGap: 50, columnGap: 50 });
                expect(calc.calculateMainAxisAvailableSpace(true, 80, 3)).toBe(0); // 80 - 100 = -20, clamped to 0
            });
        });

        describe('edge cases', () => {
            it('should handle zero gaps', () => {
                const calc = new GapCalculator({ rowGap: 0, columnGap: 0 });
                expect(calc.getMainAxisGap(true)).toBe(0);
                expect(calc.calculateMainAxisTotalGap(true, 5)).toBe(0);
                expect(calc.calculateMainAxisAvailableSpace(true, 100, 5)).toBe(100);
            });

            it('should handle same row and column gap', () => {
                const calc = new GapCalculator({ rowGap: 15, columnGap: 15 });
                expect(calc.getMainAxisGap(true)).toBe(15);
                expect(calc.getCrossAxisGap(true)).toBe(15);
            });
        });
    });
});
