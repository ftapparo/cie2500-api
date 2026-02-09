"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USBConnectedPayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var USBConnectedPayload = /** @class */ (function () {
  function USBConnectedPayload() {
    this.struct = new struct_1.Struct().word8("conectado");
    this.struct.allocate();
  }
  USBConnectedPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    return proxy.conectado === 0x55;
  };
  return USBConnectedPayload;
})();
exports.USBConnectedPayload = USBConnectedPayload;
