"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlyNumbers =
  exports.onlyAscii =
  exports.pad =
  exports.clearString =
    void 0;
var lodash_1 = require("lodash");
function clearString(str) {
  try {
    return str.trim().replace(/\0/g, "");
  } catch (e) {
    return "";
  }
}
exports.clearString = clearString;
function pad(str, length) {
  if (length === void 0) {
    length = 3;
  }
  if (str === undefined) {
    return "";
  }
  try {
    return String(str).padStart(length, "0");
  } catch (e) {
    return String(str);
  }
}
exports.pad = pad;
function onlyAscii(str) {
  if (str === undefined) {
    return "";
  }
  try {
    return lodash_1.default.deburr(str).replace(/[^\x00-\x7F]/g, "");
  } catch (e) {
    return str;
  }
}
exports.onlyAscii = onlyAscii;
function onlyNumbers(str) {
  if (str === undefined) {
    return "";
  }
  try {
    return String(str).replace(/\D/g, "");
  } catch (e) {
    return String(str) || "";
  }
}
exports.onlyNumbers = onlyNumbers;
