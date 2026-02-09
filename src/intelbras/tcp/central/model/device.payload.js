"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicePayload = void 0;
var buffer_1 = require("buffer");
var bitwise_1 = require("bitwise");
var struct_1 = require("../../js-libs/struct");
var string_1 = require("../../utils/string");
var enums_1 = require("../../enums");
var DEVICES_FRAME_QUANTITY = 8;
var DeviceBytePosition = {
  bloqueio: 0,
  nomeAlterado: 1,
};
var DevicePayload = /** @class */ (function () {
  function DevicePayload() {
    var DevicePayload = new struct_1.Struct()
      .word8("tipo")
      .word8("config")
      .chars("name", 14);
    this.struct = new struct_1.Struct().array(
      "devices",
      DEVICES_FRAME_QUANTITY,
      DevicePayload
    );
    this.struct.allocate();
  }
  DevicePayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields.devices;
    for (var deviceIndex = 0; deviceIndex < properties.length; deviceIndex++) {
      var byteConfig = 0;
      if (properties[deviceIndex].nome !== enums_1.DeviceTypes1060[0]) {
        byteConfig = bitwise_1.default.integer.setBit(
          byteConfig,
          DeviceBytePosition.bloqueio,
          properties[deviceIndex].habilitado ? 0 : 1
        );
        byteConfig = bitwise_1.default.integer.setBit(
          byteConfig,
          DeviceBytePosition.nomeAlterado,
          this.isChangedName(
            properties[deviceIndex].tipo,
            properties[deviceIndex].nome
          )
            ? 0
            : 1
        );
        proxy[deviceIndex].tipo = properties[deviceIndex].tipo;
        proxy[deviceIndex].config = byteConfig;
      }
      proxy[deviceIndex].name = properties[deviceIndex].nome;
    }
    return buf;
  };
  DevicePayload.prototype.unParse = function (data, sequence) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields.devices;
    var devicesModel = [];
    var devicesPayload = Object.values(proxy);
    for (var addr = 0; addr < devicesPayload.length; addr++) {
      var devicePayload = devicesPayload[addr];
      var deviceName = (0, string_1.clearString)(devicePayload.name);
      if (!deviceName || deviceName === "Ausente") {
        continue;
      }
      devicesModel.push({
        habilitado:
          bitwise_1.default.integer.getBit(
            devicePayload.config,
            DeviceBytePosition.bloqueio
          ) === 0,
        tipo: devicePayload.tipo,
        nome: deviceName,
        endereco: sequence * devicesPayload.length + addr + 1,
      });
    }
    return devicesModel;
  };
  DevicePayload.prototype.isChangedName = function (type, deviceName) {
    if (enums_1.DeviceTypes1060[type]) {
      return (
        enums_1.DeviceTypes1060[type].padEnd(14, " ") ===
        deviceName.padEnd(14, " ")
      );
    } else {
      return false;
    }
  };
  return DevicePayload;
})();
exports.DevicePayload = DevicePayload;
