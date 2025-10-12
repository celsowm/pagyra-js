export const AUTO_LENGTH = { kind: "auto" };
export function px(value) {
    return { kind: "absolute", unit: "px", value };
}
export function percent(ratio) {
    return { kind: "absolute", unit: "percent", value: ratio };
}
export function isAutoLength(value) {
    if (typeof value === "string") {
        return value === "auto";
    }
    if (typeof value === "number") {
        return false;
    }
    return value.kind === "auto";
}
export function normalizeLength(value) {
    if (typeof value === "number") {
        return px(value);
    }
    if (value === "auto") {
        return AUTO_LENGTH;
    }
    return value;
}
export function resolveLength(value, reference, options = { auto: "reference" }) {
    const autoBehavior = options.auto ?? "reference";
    if (value === undefined) {
        return 0;
    }
    if (typeof value === "number") {
        return value;
    }
    if (value === "auto") {
        return resolveAuto(autoBehavior, reference);
    }
    if (value.kind === "auto") {
        return resolveAuto(autoBehavior, reference);
    }
    if (value.unit === "percent") {
        return value.value * reference;
    }
    return value.value;
}
export function clampMinMax(value, minValue, maxValue) {
    const upper = maxValue ?? Number.POSITIVE_INFINITY;
    const lower = minValue ?? Number.NEGATIVE_INFINITY;
    return Math.min(Math.max(value, lower), upper);
}
function resolveAuto(autoBehavior, reference) {
    if (autoBehavior === "reference") {
        return reference;
    }
    if (autoBehavior === "zero") {
        return 0;
    }
    return autoBehavior;
}
