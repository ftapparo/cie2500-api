"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CentralInfoPayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var CentralInfoPayload = /** @class */ (function () {
  function CentralInfoPayload() {
    this.struct = new struct_1.Struct()
      .word8("major")
      .word8("minor")
      .word8("path");
    this.struct.allocate();
  }
  CentralInfoPayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    return buf;
  };
  CentralInfoPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var version = ""
      .concat(proxy.major, ".")
      .concat(proxy.minor, ".")
      .concat(proxy.path);
    var firmwareVersion = {
      version: version,
    };
    return firmwareVersion;
  };
  return CentralInfoPayload;
})();
exports.CentralInfoPayload = CentralInfoPayload;
