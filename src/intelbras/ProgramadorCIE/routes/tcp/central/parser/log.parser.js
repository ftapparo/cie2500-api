"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogParser = void 0;
var enums_1 = require("../../enums");
var LogParser = /** @class */ (function () {
  function LogParser() {}
  LogParser.unparseLogs = function (logs, type) {
    var parsedLogs = [];
    for (var _i = 0, logs_1 = logs; _i < logs_1.length; _i++) {
      var log = logs_1[_i];
      if (
        log.endereco === 251 ||
        log.endereco === 252 ||
        log.endereco === 253
      ) {
        log.nomeEvento = enums_1.EventsType[type][log.tipo];
      } else if (enums_1.DeviceTypesInitials1060[log.tipo]) {
        if (type === "falha" || type === "operacao") {
          log.nomeDetalhe = enums_1.EventsDetailType[type][log.detalhe];
        }
        log.siglaTipo = enums_1.DeviceTypesInitials1060[log.tipo];
        log.nome_dispositivo = enums_1.DeviceTypes1060[log.tipo].trim();
      }
      parsedLogs.push(log);
    }
    return parsedLogs;
  };
  return LogParser;
})();
exports.LogParser = LogParser;
