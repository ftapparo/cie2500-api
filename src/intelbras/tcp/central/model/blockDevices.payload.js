"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockDevicesPayload = void 0;
var buffer_1 = require("buffer");
var bitwise_1 = require("bitwise");
var struct_1 = require("../../js-libs/struct");
var BlockDevicesBytePosition = {
  sireneConvencional: 0,
  releDeAlarme: 1,
  releDeFalha: 2,
  regraPadrao: 3,
  laco: 4,
};
var BlockDevicesPayload = /** @class */ (function () {
  function BlockDevicesPayload() {
    this.struct = new struct_1.Struct().word8("config");
    this.struct.allocate();
  }
  BlockDevicesPayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var byteConfig = 0;
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      BlockDevicesBytePosition.sireneConvencional,
      properties.sireneConvencional ? 1 : 0
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      BlockDevicesBytePosition.releDeAlarme,
      properties.releDeAlarme ? 1 : 0
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      BlockDevicesBytePosition.releDeFalha,
      properties.releDeFalha ? 1 : 0
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      BlockDevicesBytePosition.regraPadrao,
      properties.regraPadrao ? 1 : 0
    );
    byteConfig = bitwise_1.default.integer.setBit(
      byteConfig,
      BlockDevicesBytePosition.laco,
      properties.laco ? 1 : 0
    );
    var proxy = this.struct.fields;
    proxy.config = byteConfig;
    return buf;
  };
  BlockDevicesPayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var blockDevices = {
      sireneConvencional:
        bitwise_1.default.integer.getBit(
          proxy.config,
          BlockDevicesBytePosition.sireneConvencional
        ) === 1,
      releDeAlarme:
        bitwise_1.default.integer.getBit(
          proxy.config,
          BlockDevicesBytePosition.releDeAlarme
        ) === 1,
      releDeFalha:
        bitwise_1.default.integer.getBit(
          proxy.config,
          BlockDevicesBytePosition.releDeFalha
        ) === 1,
      regraPadrao:
        bitwise_1.default.integer.getBit(
          proxy.config,
          BlockDevicesBytePosition.regraPadrao
        ) === 1,
      laco:
        bitwise_1.default.integer.getBit(
          proxy.config,
          BlockDevicesBytePosition.laco
        ) === 1,
    };
    return blockDevices;
  };
  return BlockDevicesPayload;
})();
exports.BlockDevicesPayload = BlockDevicesPayload;
