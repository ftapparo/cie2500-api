"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readNibbleInNumber = void 0;
var bitwise_1 = require("bitwise");
// import { Uint4 } from "uint4";
/*function writeNibble(value: number): Bits {
  const bits: Array<Bit> = [0, 0, 0, 0];
  const buffer = new Buffer.alloc(4);
  buffer.fill(0);
  new Uint4().writeUInt4LE(buffer, value, 0);
  for (let i = 0; i < buffer.length; i++) {
    bits[i] = buffer[i] ? 1 : 0;
  }
  return bits;
}

function readNibble(bufferToRead: Bits): Bits {
  const bits: Array<Bit> = [0, 0, 0, 0];
  const buffer = new Buffer.alloc(4);
  buffer.fill(0);
  new Uint4().readUInt4LE(bufferToRead, 0);
  for (let i = 0; i < buffer.length; i++) {
    bits[i] = buffer[i] ? 1 : 0;
  }
  return bits;
}*/
function bufferToByte(buffer) {
  var byte = [0, 0, 0, 0, 0, 0, 0, 0];
  for (var i = 0; i < buffer.length; i++) {
    byte.push(buffer[i] ? 1 : 0);
  }
  return byte;
}
/*export function writeNibbleInNumber(value: number, number: number, index: 0 | 1): number {
  const numberBuffer = bitwise.byte.read(number as UInt8);
  const nibble = writeNibble(value);
  const bufferWithNibble = Buffer.from(numberBuffer);
  bitwise.buffer.modify(bufferWithNibble, nibble, index * 4);
  return bitwise.byte.write(bufferToByte(bufferWithNibble));
}*/
function readNibbleInNumber(number, index) {
  var numberBuffer = bitwise_1.default.byte.read(number);
  var nibbleBuffer = numberBuffer.splice(index ? 0 : 4, index ? 4 : 8);
  // @ts-ignore
  return bitwise_1.default.nibble.write(nibbleBuffer);
  // buffer.readUInt8(Math.floor(cursor)) >> 4
  // return new Uint4().readUInt4LE(Buffer.from(numberBuffer), 4 * index);
}
exports.readNibbleInNumber = readNibbleInNumber;
