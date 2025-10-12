export function collapseMarginSet(margins) {
    const positives = [];
    const negatives = [];
    for (const margin of margins) {
        if (margin > 0) {
            positives.push(margin);
        }
        else if (margin < 0) {
            negatives.push(margin);
        }
    }
    if (negatives.length === 0) {
        return positives.length > 0 ? Math.max(...positives) : 0;
    }
    if (positives.length === 0) {
        return Math.min(...negatives);
    }
    return Math.max(...positives) + Math.min(...negatives);
}
export function collapsedGapBetween(prevBottomMargin, nextTopMargin, parentEstablishesBfc) {
    if (parentEstablishesBfc) {
        return prevBottomMargin + nextTopMargin;
    }
    return collapseMarginSet([prevBottomMargin, nextTopMargin]);
}
