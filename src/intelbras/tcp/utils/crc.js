"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCRC = void 0;
var crc_32_1 = require("crc-32");
var generateCRC = function (fileData) {
  if (fileData.crc) {
    delete fileData.crc;
  }
  return (0, crc_32_1.str)(JSON.stringify(fileData) + "1NT3LBR4S_C13_F1L3");
};
exports.generateCRC = generateCRC;
