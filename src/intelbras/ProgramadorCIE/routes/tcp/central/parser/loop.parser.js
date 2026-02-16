"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoopParser = void 0;
var object_1 = require("../../utils/object");
var inconsistecy_type_1 = require("../config/inconsistecy.type");
var types = {
  4: "saida",
};
var LoopParser = /** @class */ (function () {
  function LoopParser() {}
  LoopParser.deviceTypeToMode = function (type) {
    return types[type];
  };
  LoopParser.parseDevices = function (devices) {
    var loop1Devices = {};
    for (var _i = 0, devices_1 = devices; _i < devices_1.length; _i++) {
      var device = devices_1[_i];
      loop1Devices[device.endereco] = {
        nome: device.nome,
        laco: 1,
        endereco: device.endereco,
        habilitado: device.habilitado,
        zona: 1,
        tipo: device.tipo,
        subtipo: device.tipo,
        supervisao: false,
        saida_padrao: false,
        modo: this.deviceTypeToMode(device.tipo),
      };
    }
    return loop1Devices;
  };
  LoopParser.unparseDevices = function (fileData) {
    var devices = [];
    for (
      var _i = 0,
        _a = (0, object_1.objectToArray)(fileData.lacos[1].dispositivos);
      _i < _a.length;
      _i++
    ) {
      var device = _a[_i];
      devices.push({
        endereco: device.endereco,
        nome: device.nome,
        tipo: device.tipo,
        habilitado: device.habilitado,
      });
    }
    return devices;
  };
  LoopParser.analyzeInconsistency = function (fileData, loops) {
    var _a;
    var inconsistencies =
      ((_a = {}),
      (_a[inconsistecy_type_1.InconsistencyType.HAS_ONLY_CENTRAL] = []),
      (_a[inconsistecy_type_1.InconsistencyType.TYPE] = []),
      (_a[inconsistecy_type_1.InconsistencyType.HAS_ONLY_DATA] = []),
      _a);
    var centralLoop = LoopParser.parseDevices(loops);
    var dataLoop = fileData.lacos["1"].dispositivos;
    for (var addrCentral in centralLoop) {
      var find = false;
      if (dataLoop[addrCentral]) {
        find = true;
        if (dataLoop[addrCentral].tipo !== centralLoop[addrCentral].tipo) {
          inconsistencies[inconsistecy_type_1.InconsistencyType.TYPE].push({
            typeCentral: centralLoop[addrCentral].tipo,
            typeData: dataLoop[addrCentral].tipo,
            addressCentral: centralLoop[addrCentral].endereco,
            addressData: dataLoop[addrCentral].endereco,
          });
        }
      }
      if (!find) {
        inconsistencies[
          inconsistecy_type_1.InconsistencyType.HAS_ONLY_CENTRAL
        ].push({
          addressCentral: centralLoop[addrCentral].endereco,
          typeCentral: centralLoop[addrCentral].tipo,
          addressData: centralLoop[addrCentral].endereco,
          deviceNameCentral: centralLoop[addrCentral].nome,
        });
      }
    }
    for (var addrLoop in dataLoop) {
      var find = false;
      if (centralLoop[addrLoop]) {
        find = true;
      }
      if (!find) {
        inconsistencies[
          inconsistecy_type_1.InconsistencyType.HAS_ONLY_DATA
        ].push({
          addressData: dataLoop[addrLoop].endereco,
          typeData: dataLoop[addrLoop].tipo,
          deviceNameData: dataLoop[addrLoop].nome,
        });
      }
    }
    return inconsistencies;
  };
  return LoopParser;
})();
exports.LoopParser = LoopParser;
