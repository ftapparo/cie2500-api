"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxDelayTimePayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var MaxDelayTimePayload = /** @class */ (function () {
  function MaxDelayTimePayload() {
    this.struct = new struct_1.Struct().word8("minutos").word8("segundos");
    this.struct.allocate();
  }
  MaxDelayTimePayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    try {
      var splited = properties.maxDelayTime.split(":");
      proxy.minutos = parseInt(splited[0], 10);
      proxy.segundos = parseInt(splited[1], 10);
    } catch (e) {
      console.error(e);
    }
    return buf;
  };
  MaxDelayTimePayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var maxDelayTime = {
      maxDelayTime: ""
        .concat(String(proxy.minutos).padStart(2, "0"), ":")
        .concat(String(proxy.segundos).padStart(2, "0")),
    };
    return maxDelayTime;
  };
  return MaxDelayTimePayload;
})();
exports.MaxDelayTimePayload = MaxDelayTimePayload;
