import type { Radius } from "../types.js";
import { formatNumber } from "./shape-utils.js";

/**
 * Rounded rectangle path generator
 * Responsibility: Generate PDF path commands for rounded rectangles
 */

/**
 * Generate PDF path commands for a rounded rectangle
 * Uses Bézier curves to approximate rounded corners
 * 
 * @param width - Rectangle width
 * @param height - Rectangle height  
 * @param radii - Corner radii (should be pre-normalized)
 * @param offsetX - X offset for path origin
 * @param offsetY - Y offset for path origin
 * @returns Array of PDF path command strings
 */
export function generateRoundedRectPath(
    width: number,
    height: number,
    radii: Radius,
    offsetX: number,
    offsetY: number
): string[] {
    const commands: string[] = [];
    if (width <= 0 || height <= 0) {
        return commands;
    }

    const tl = radii.topLeft;
    const tr = radii.topRight;
    const br = radii.bottomRight;
    const bl = radii.bottomLeft;

    // Bézier approximation constant for circular arcs
    const k = 0.5522847498307936;

    // Start at top-left, after the corner radius
    const moveX = offsetX + tl.x;
    const moveY = offsetY;
    commands.push(`${formatNumber(moveX)} ${formatNumber(moveY)} m`);

    // Top edge
    commands.push(`${formatNumber(offsetX + width - tr.x)} ${formatNumber(offsetY)} l`);

    // Top-right corner
    if (tr.x > 0 || tr.y > 0) {
        const cp1x = offsetX + width - tr.x + k * tr.x;
        const cp1y = offsetY;
        const cp2x = offsetX + width;
        const cp2y = offsetY + tr.y - k * tr.y;
        const endX = offsetX + width;
        const endY = offsetY + tr.y;
        commands.push(
            `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
        );
    } else {
        commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY)} l`);
    }

    // Right edge
    commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY + height - br.y)} l`);

    // Bottom-right corner
    if (br.x > 0 || br.y > 0) {
        const cp1x = offsetX + width;
        const cp1y = offsetY + height - br.y + k * br.y;
        const cp2x = offsetX + width - br.x + k * br.x;
        const cp2y = offsetY + height;
        const endX = offsetX + width - br.x;
        const endY = offsetY + height;
        commands.push(
            `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
        );
    } else {
        commands.push(`${formatNumber(offsetX + width)} ${formatNumber(offsetY + height)} l`);
    }

    // Bottom edge
    commands.push(`${formatNumber(offsetX + bl.x)} ${formatNumber(offsetY + height)} l`);

    // Bottom-left corner
    if (bl.x > 0 || bl.y > 0) {
        const cp1x = offsetX + bl.x - k * bl.x;
        const cp1y = offsetY + height;
        const cp2x = offsetX;
        const cp2y = offsetY + height - bl.y + k * bl.y;
        const endX = offsetX;
        const endY = offsetY + height - bl.y;
        commands.push(
            `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
        );
    } else {
        commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY + height)} l`);
    }

    // Left edge
    commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY + tl.y)} l`);

    // Top-left corner
    if (tl.x > 0 || tl.y > 0) {
        const cp1x = offsetX;
        const cp1y = offsetY + tl.y - k * tl.y;
        const cp2x = offsetX + tl.x - k * tl.x;
        const cp2y = offsetY;
        const endX = offsetX + tl.x;
        const endY = offsetY;
        commands.push(
            `${formatNumber(cp1x)} ${formatNumber(cp1y)} ${formatNumber(cp2x)} ${formatNumber(cp2y)} ${formatNumber(endX)} ${formatNumber(endY)} c`,
        );
    } else {
        commands.push(`${formatNumber(offsetX)} ${formatNumber(offsetY)} l`);
    }

    // Close path
    commands.push("h");
    return commands;
}
