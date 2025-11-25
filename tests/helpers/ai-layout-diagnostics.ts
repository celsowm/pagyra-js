type RenderBox = any;

export function findBoxWithBorderRadius(box: RenderBox): RenderBox | null {
    if (box?.borderRadius && box.borderRadius.topLeft?.x > 0) {
        return box;
    }
    for (const child of box.children ?? []) {
        const found = findBoxWithBorderRadius(child);
        if (found) return found;
    }
    return null;
}

export function findChildSpan(box: RenderBox): RenderBox | null {
    for (const child of box.children ?? []) {
        if (child.tagName === "span") return child;
    }
    return null;
}

interface DiagnosticCheck {
    actual: number;
    expected: number;
    diff: number;
    tolerance: number;
    label: string;
    pass: boolean;
}

interface DiagnosticContext {
    testId: string;
    css: any;
    browser: any;
    geometry: {
        borderBox: any;
        contentBox: any;
        spanBox: any;
        padding: any;
        border: any;
    };
    checks: DiagnosticCheck[];
    fontDiagnostics?: string;
    ascii?: string;
}

let context: DiagnosticContext | null = null;

export function createDiagnosticsContext(
    testId: string,
    css: any,
    browser: any,
    borderBox: any,
    contentBox: any,
    spanBox: any,
    padding: any,
    border: any,
    fontDiagnostics?: string
) {
    context = {
        testId,
        css,
        browser,
        geometry: { borderBox, contentBox, spanBox, padding, border },
        checks: [],
        fontDiagnostics,
    };
}

export function addNumericCheck(
    actual: number,
    expected: number,
    tolerance: number,
    label: string
) {
    if (!context) throw new Error("Diagnostics context not initialized");
    const diff = actual - expected;
    const pass = Math.abs(diff) <= tolerance;
    context.checks.push({ actual, expected, diff, tolerance, label, pass });
}

export function renderAsciiLayout(): string {
    if (!context) throw new Error("Diagnostics context not initialized");

    const { geometry } = context;
    const { borderBox, contentBox, spanBox, padding, border } = geometry;

    // Calculate relative positions
    const contentX = contentBox.x - borderBox.x;
    const contentY = contentBox.y - borderBox.y;
    const spanX = spanBox.x - borderBox.x;
    const spanY = spanBox.y - borderBox.y;

    // Simple ASCII representation
    const borderW = Math.round(borderBox.width);
    const borderH = Math.round(borderBox.height);
    const contentW = Math.round(contentBox.width);
    const contentH = Math.round(contentBox.height);
    const spanW = Math.round(spanBox.width);
    const spanH = Math.round(spanBox.height);

    const ascii = `Border Box (W:${borderW}, H:${borderH}) |#########################|
Content Box at (${Math.round(contentX)}, ${Math.round(contentY)}) (W:${contentW}, H:${contentH}) |   +---+   |
|   |###|   |
|   +---+   |
Span Box at (${Math.round(spanX)}, ${Math.round(spanY)}) (W:${spanW}, H:${spanH}) |   [xxx]   |
Padding: T:${padding.top}, R:${padding.right}, B:${padding.bottom}, L:${padding.left}
Border: T:${border.top}, R:${border.right}, B:${border.bottom}, L:${border.left}`;

    context.ascii = ascii;
    return ascii;
}

export function finalizeDiagnostics() {
    if (!context) throw new Error("Diagnostics context not initialized");

    const allPass = context.checks.every((c) => c.pass);
    const computedDiffs = context.checks.map((c) => ({
        label: c.label,
        diff: c.diff,
    }));

    const json = {
        testId: context.testId,
        css: context.css,
        browser: context.browser,
        geometry: context.geometry,
        checks: context.checks,
        computedDiffs,
        fontDiagnostics: context.fontDiagnostics,
        ascii: context.ascii,
        allPass,
    };

    console.log(`AI_DIAGNOSTIC::${JSON.stringify(json)}`);
    if (context.ascii) {
        console.log(`AI_ASCII_RENDER::${context.ascii}`);
    }
    if (!allPass) {
        throw new Error("Tests failed - see AI_DIAGNOSTIC for details");
    }
}
