"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureDebug = configureDebug;
exports.log = log;
exports.preview = preview;
var CURRENT_LEVEL = "INFO";
var ENABLED = new Set();
function configureDebug(level, cats) {
    if (cats === void 0) { cats = []; }
    CURRENT_LEVEL = level;
    ENABLED = new Set(cats);
}
var order = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"];
function allowed(level, cat) {
    return order.indexOf(level) <= order.indexOf(CURRENT_LEVEL) && (ENABLED.size === 0 || ENABLED.has(cat));
}
function log(cat, level, msg, extra) {
    if (!allowed(level, cat))
        return;
    var prefix = "[".concat(cat, "] ").concat(level);
    if (extra) {
        console.log(prefix, msg, extra);
    } else {
        console.log(prefix, msg);
    }
}
function preview(s, n) {
    if (n === void 0) { n = 60; }
    if (s == null)
        return s;
    return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
