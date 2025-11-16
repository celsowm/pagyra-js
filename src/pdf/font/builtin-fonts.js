"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBuiltinFontConfig = loadBuiltinFontConfig;
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var log_js_1 = require("../../debug/log.js");
var BUILTIN_FACES = [
    { name: "Roboto-Regular", family: "Roboto", weight: 400, style: "normal", file: "Roboto-Regular.ttf" },
    { name: "Roboto-Bold", family: "Roboto", weight: 700, style: "normal", file: "Roboto-Bold.ttf" },
    { name: "Roboto-Italic", family: "Roboto", weight: 400, style: "italic", file: "Roboto-Italic.ttf" },
    { name: "Roboto-BoldItalic", family: "Roboto", weight: 700, style: "italic", file: "Roboto-BoldItalic.ttf" },
    { name: "NotoSans-Regular", family: "Noto Sans", weight: 400, style: "normal", file: "NotoSans-Regular.ttf" },
];
var cachedConfig;
var loading = null;
function loadBuiltinFontConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            if (cachedConfig !== undefined) {
                return [2 /*return*/, cachedConfig];
            }
            if (loading) {
                return [2 /*return*/, loading];
            }
            if (!isNodeRuntime()) {
                cachedConfig = null;
                return [2 /*return*/, null];
            }
            loading = (function () { return __awaiter(_this, void 0, void 0, function () {
                var baseDir, faces, _i, BUILTIN_FACES_1, face, filePath, buffer, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 5, 6, 7]);
                            baseDir = resolveFontsDir();
                            faces = [];
                            _i = 0, BUILTIN_FACES_1 = BUILTIN_FACES;
                            _a.label = 1;
                        case 1:
                            if (!(_i < BUILTIN_FACES_1.length)) return [3 /*break*/, 4];
                            face = BUILTIN_FACES_1[_i];
                            filePath = node_path_1.default.join(baseDir, face.file);
                            return [4 /*yield*/, promises_1.default.readFile(filePath)];
                        case 2:
                            buffer = _a.sent();
                            faces.push({
                                name: face.name,
                                family: face.family,
                                weight: face.weight,
                                style: face.style,
                                src: filePath,
                                data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
                            });
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            cachedConfig = {
                                fontFaceDefs: faces,
                                defaultStack: ["Roboto", "Noto Sans"],
                            };
                            return [2 /*return*/, cachedConfig];
                        case 5:
                            error_1 = _a.sent();
                            (0, log_js_1.log)("FONT", "WARN", "Unable to load builtin font config", { error: error_1 });
                            cachedConfig = null;
                            return [2 /*return*/, null];
                        case 6:
                            loading = null;
                            return [7 /*endfinally*/];
                        case 7: return [2 /*return*/];
                    }
                });
            }); })();
            return [2 /*return*/, loading];
        });
    });
}
function resolveFontsDir() {
    var here = (0, node_url_1.fileURLToPath)(import.meta.url);
    return node_path_1.default.resolve(node_path_1.default.dirname(here), "../../../assets/fonts");
}
function isNodeRuntime() {
    var _a;
    return typeof process !== "undefined" && !!((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node);
}
