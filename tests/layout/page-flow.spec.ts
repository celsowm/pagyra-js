import {
  PageFlowMetrics,
  resolvePageMarginsForIndex,
  type PageMarginProfile,
} from "../../src/layout/fragmentation/page-flow.js";

const profile: PageMarginProfile = {
  default: { top: 10, right: 10, bottom: 10, left: 10 },
  first: { top: 20, right: 20, bottom: 30, left: 40 },
  left: { top: 30, right: 10, bottom: 10, left: 50 },
  right: { top: 40, right: 20, bottom: 10, left: 60 },
};

describe("page flow metrics", () => {
  it("selects first, left and right page margins by zero-based index", () => {
    expect(resolvePageMarginsForIndex(profile, 0)).toBe(profile.first);
    expect(resolvePageMarginsForIndex(profile, 1)).toBe(profile.left);
    expect(resolvePageMarginsForIndex(profile, 2)).toBe(profile.right);
    expect(resolvePageMarginsForIndex(profile, 3)).toBe(profile.left);
    expect(resolvePageMarginsForIndex(profile, 4)).toBe(profile.right);
  });

  it("maps variable printable heights to physical page coordinates", () => {
    const flow = new PageFlowMetrics({ pageHeight: 200, margins: profile });

    expect(flow.usableHeightForPage(0)).toBe(150);
    expect(flow.usableHeightForPage(1)).toBe(160);
    expect(flow.usableHeightForPage(2)).toBe(150);
    expect(flow.contentStartForPage(1)).toBe(150);
    expect(flow.contentStartForPage(2)).toBe(310);
    expect(flow.contentStartForPage(3)).toBe(460);

    expect(flow.physicalYForContentY(0)).toBe(20);
    expect(flow.physicalYForContentY(150)).toBe(230);
    expect(flow.physicalYForContentY(310)).toBe(440);
    expect(flow.physicalYForContentY(460)).toBe(630);
  });

  it("includes shared header and footer reservations in every page", () => {
    const flow = new PageFlowMetrics({
      pageHeight: 200,
      margins: profile,
      headerHeightPx: 10,
      footerHeightPx: 5,
    });

    expect(flow.usableHeightForPage(0)).toBe(135);
    expect(flow.usableHeightForPage(1)).toBe(145);
    expect(flow.physicalYForContentY(0)).toBe(30);
    expect(flow.physicalYForContentY(135)).toBe(240);
  });
});
