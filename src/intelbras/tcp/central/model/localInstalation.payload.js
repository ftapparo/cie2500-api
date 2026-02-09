"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalInstalationPayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var LocalInstalationPayload = /** @class */ (function () {
  function LocalInstalationPayload() {
    this.struct = new struct_1.Struct().chars("local_instalacao", 32);
    this.struct.allocate();
  }
  LocalInstalationPayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    proxy.local_instalacao = properties.localInstalation;
    return buf;
  };
  LocalInstalationPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var localInstalation = {
      localInstalation: proxy.local_instalacao,
    };
    return localInstalation;
  };
  return LocalInstalationPayload;
})();
exports.LocalInstalationPayload = LocalInstalationPayload;
