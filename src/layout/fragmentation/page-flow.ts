import type { PageMarginsPx } from "../../units/page-utils.js";

export interface PageMarginProfile {
  default: PageMarginsPx;
  first?: PageMarginsPx;
  left?: PageMarginsPx;
  right?: PageMarginsPx;
}

export interface PageFlowOptions {
  pageHeight: number;
  margins: PageMarginProfile;
  headerHeightPx?: number;
  footerHeightPx?: number;
}

export interface PageLocation {
  pageIndex: number;
  contentPageStart: number;
  remainder: number;
}

/**
 * Maps the continuous layout coordinate space to physical PDF pages whose
 * printable heights and horizontal offsets may vary by page pseudo-class.
 */
export class PageFlowMetrics {
  readonly pageHeight: number;
  readonly headerHeightPx: number;
  readonly footerHeightPx: number;
  private readonly contentStarts: number[] = [0];

  constructor(private readonly options: PageFlowOptions) {
    this.pageHeight = sanitizePositive(options.pageHeight, 1);
    this.headerHeightPx = sanitizeNonNegative(options.headerHeightPx);
    this.footerHeightPx = sanitizeNonNegative(options.footerHeightPx);
  }

  marginsForPage(pageIndex: number): PageMarginsPx {
    const safeIndex = Math.max(0, Math.trunc(pageIndex));
    if (safeIndex === 0 && this.options.margins.first) {
      return this.options.margins.first;
    }
    if (safeIndex % 2 === 0) {
      return this.options.margins.right ?? this.options.margins.default;
    }
    return this.options.margins.left ?? this.options.margins.default;
  }

  usableHeightForPage(pageIndex: number): number {
    const margins = this.marginsForPage(pageIndex);
    const reserved = margins.top + margins.bottom + this.headerHeightPx + this.footerHeightPx;
    return Math.max(1, this.pageHeight - reserved);
  }

  effectiveTopForPage(pageIndex: number): number {
    return this.marginsForPage(pageIndex).top + this.headerHeightPx;
  }

  contentStartForPage(pageIndex: number): number {
    const target = Math.max(0, Math.trunc(pageIndex));
    while (this.contentStarts.length <= target) {
      const previousIndex = this.contentStarts.length - 1;
      this.contentStarts.push(
        this.contentStarts[previousIndex] + this.usableHeightForPage(previousIndex),
      );
    }
    return this.contentStarts[target];
  }

  pageIndexAtContentY(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    let lastIndex = this.contentStarts.length - 1;
    while (value >= this.contentStarts[lastIndex] + this.usableHeightForPage(lastIndex)) {
      this.contentStarts.push(
        this.contentStarts[lastIndex] + this.usableHeightForPage(lastIndex),
      );
      lastIndex++;
    }

    let low = 0;
    let high = this.contentStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.contentStarts[middle] <= value) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  }

  locateContentY(value: number): PageLocation {
    const pageIndex = this.pageIndexAtContentY(value);
    const contentPageStart = this.contentStartForPage(pageIndex);
    return {
      pageIndex,
      contentPageStart,
      remainder: value - contentPageStart,
    };
  }

  physicalYForContentY(value: number): number {
    if (!Number.isFinite(value)) {
      return value;
    }
    const location = this.locateContentY(value);
    return location.pageIndex * this.pageHeight
      + this.effectiveTopForPage(location.pageIndex)
      + location.remainder;
  }

  minimumUsableHeight(): number {
    return Math.min(
      this.usableHeightForPage(0),
      this.usableHeightForPage(1),
      this.usableHeightForPage(2),
    );
  }

  maximumUsableHeight(): number {
    return Math.max(
      this.usableHeightForPage(0),
      this.usableHeightForPage(1),
      this.usableHeightForPage(2),
    );
  }
}

export function createUniformPageFlow(
  pageHeight: number,
  margins: PageMarginsPx,
  headerHeightPx = 0,
  footerHeightPx = 0,
): PageFlowMetrics {
  return new PageFlowMetrics({
    pageHeight,
    margins: { default: margins },
    headerHeightPx,
    footerHeightPx,
  });
}

function sanitizePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
}

function sanitizeNonNegative(value: number | undefined): number {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}
