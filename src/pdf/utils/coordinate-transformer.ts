export class CoordinateTransformer {
  private ptToPxFactor?: number;

  constructor(
    public readonly pageHeightPt: number,
    private readonly pxToPt: (value: number) => number,
    public readonly pageOffsetPx: number = 0,
  ) {}

  get pageHeightPx(): number {
    return this.ptToPx(this.pageHeightPt);
  }

  private ptToPx(value: number): number {
    if (!this.ptToPxFactor) {
      const factor = this.pxToPt(1);
      this.ptToPxFactor = factor === 0 ? 0 : 1 / factor;
    }
    return value * (this.ptToPxFactor ?? 0);
  }

  public convertPxToPt(value: number): number {
    return this.pxToPt(value);
  }

  // NOVO
  public convertPtToPx(value: number): number {
    return this.ptToPx(value);
  }
}
