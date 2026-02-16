"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogPayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var buffer_2 = require("../../utils/buffer");
var enums_1 = require("../../enums");
var LOGS_FRAME_QUANTITY = 16;
var LogPayload = /** @class */ (function () {
  function LogPayload() {
    var LogPayload = new struct_1.Struct()
      .word8("endereco")
      .word8("tipo")
      .word8("year")
      .word8("month")
      .word8("day")
      .word8("hour")
      .word8("min")
      .word8("sec");
    this.struct = new struct_1.Struct().array(
      "devices",
      LOGS_FRAME_QUANTITY,
      LogPayload
    );
    this.struct.allocate();
  }
  LogPayload.prototype.parse = function (type) {
    var buffer = new buffer_1.Buffer(1);
    buffer.set([enums_1.LogTypeNameNumber[type]]);
    return buffer;
  };
  LogPayload.prototype.unParse = function (data, sequence) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields.devices;
    var logsModel = [];
    var logsPayload = Object.values(proxy);
    for (var addr = 0; addr < logsPayload.length; addr++) {
      var logPayload = logsPayload[addr];
      if (!logPayload.endereco && !logPayload.tipo && !logPayload.year) {
        continue;
      }
      logsModel.push({
        // eslint-disable-next-line
        date: new Date(
          logPayload.year + 2000,
          logPayload.month - 1,
          logPayload.day,
          logPayload.hour,
          logPayload.min,
          logPayload.sec,
          0
        ),
        endereco: logPayload.endereco,
        tipo:
          logPayload.endereco === 251 ||
          logPayload.endereco === 252 ||
          logPayload.endereco === 253
            ? logPayload.tipo
            : (0, buffer_2.readNibbleInNumber)(logPayload.tipo, 0),
        detalhe: (0, buffer_2.readNibbleInNumber)(logPayload.tipo, 1),
      });
    }
    return logsModel;
  };
  return LogPayload;
})();
exports.LogPayload = LogPayload;
