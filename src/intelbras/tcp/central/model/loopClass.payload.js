"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopClassPayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var LoopClassPayload = /** @class */ (function () {
  function LoopClassPayload() {
    this.struct = new struct_1.Struct().word8("type");
    this.struct.allocate();
  }
  LoopClassPayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    proxy.type = properties.type === "A" ? 0xaa : 0xbb;
    return buf;
  };
  LoopClassPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var loopClass = {
      type: proxy.type === 0xaa ? "A" : "B",
    };
    return loopClass;
  };
  return LoopClassPayload;
})();
exports.LoopClassPayload = LoopClassPayload;
