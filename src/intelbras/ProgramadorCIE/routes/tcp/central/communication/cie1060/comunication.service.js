"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while (_)
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommunicationService = void 0;
var buffer_1 = require("buffer");
var commands_type_1 = require("../../config/commands.type");
var device_payload_1 = require("../../model/device.payload");
var password_payload_1 = require("../../model/password.payload");
var localInstalation_payload_1 = require("../../model/localInstalation.payload");
var maxDelayTime_payload_1 = require("../../model/maxDelayTime.payload");
var defaultRule_payload_1 = require("../../model/defaultRule.payload");
var loopClass_payload_1 = require("../../model/loopClass.payload");
var dateTime_payload_1 = require("../../model/dateTime.payload");
var centralInfo_payload_1 = require("../../model/centralInfo.payload");
var blockDevices_payload_1 = require("../../model/blockDevices.payload");
var log_payload_1 = require("../../model/log.payload");
var string_1 = require("../../../utils/string");
var usbConnected_payload_1 = require("../../model/usbConnected.payload");
var socket_interface_1 = require("../../socket/socket.interface");
var socket_1 = require("../../../../tcp/central/socket");
var emptyPayload = new buffer_1.Buffer([]);
var CommunicationService = /** @class */ (function () {
  function CommunicationService() {
    this.transmitting = false;
    this.socketService = new socket_1.Socket1060Service();
  }
  CommunicationService.prototype.sendBuffer = function (data) {
    throw new Error("Method not implemented.");
  };
  CommunicationService.prototype.sendConfiguration = function (fileData) {
    throw new Error("Method not implemented.");
  };
  CommunicationService.prototype.send = function (frame, ping) {
    if (ping === void 0) {
      ping = false;
    }
    return __awaiter(this, void 0, void 0, function () {
      var stop, attemps, response;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            stop = false;
            attemps = 1;
            _a.label = 1;
          case 1:
            if (attemps > 1) {
              console.log(">> FALHOU, TENTA NOVAMENTE, TENTATIVA ", attemps);
            }
            if (!this.transmitting) return [3 /*break*/, 3];
            console.log(">> WAIT, TRANSMITTING", attemps);
            return [
              4 /*yield*/,
              new Promise(function (r) {
                return setTimeout(r, 1000);
              }),
            ];
          case 2:
            _a.sent();
            attemps++;
            return [3 /*break*/, 5];
          case 3:
            this.transmitting = true;
            return [4 /*yield*/, this.socketService.send(frame, ping)];
          case 4:
            response = _a.sent();
            this.transmitting = false;
            if (
              response.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              stop = true;
            }
            if (ping) {
              stop = true;
            }
            attemps++;
            _a.label = 5;
          case 5:
            if (!stop && attemps <= 10) return [3 /*break*/, 1];
            _a.label = 6;
          case 6:
            return [2 /*return*/, response];
        }
      });
    });
  };
  CommunicationService.prototype.ping = function () {
    return __awaiter(this, void 0, void 0, function () {
      var request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send(
                {
                  comando: commands_type_1.COMMAND.CMD_GRAVAR_DATA_HORA,
                  payload: emptyPayload,
                },
                true
              ),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.getDevices = function () {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
      var devices,
        sequence,
        stop,
        hasMoreDevices,
        devicesSend,
        deviceFrame,
        devicePayload;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            devices = [];
            sequence = 0;
            stop = false;
            hasMoreDevices = "N";
            _c.label = 1;
          case 1:
            if (!!stop) return [3 /*break*/, 3];
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_TABELA_REGISTROS,
                sequencialPayload: sequence,
                payload: emptyPayload,
              }),
            ];
          case 2:
            devicesSend = _c.sent();
            if (
              devicesSend.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              sequence =
                ((_a = devicesSend.frame) === null || _a === void 0
                  ? void 0
                  : _a.sequencialPayload) || 0;
              hasMoreDevices =
                ((_b = devicesSend.frame) === null || _b === void 0
                  ? void 0
                  : _b.aguardarMaisPayload) || "N";
              deviceFrame = devicesSend.frame;
              devicePayload = new device_payload_1.DevicePayload().unParse(
                deviceFrame.payload,
                sequence
              );
              devices.push.apply(devices, devicePayload);
              if (hasMoreDevices === "N") {
                stop = true;
              }
            } else {
              throw new Error(devicesSend.response);
            }
            return [3 /*break*/, 1];
          case 3:
            return [2 /*return*/, devices];
        }
      });
    });
  };
  CommunicationService.prototype.getLogs = function (type, callback) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
      var logs,
        sequence,
        stop,
        hasMoreLogs,
        logPayload,
        request,
        logFrame,
        logPayload_1;
      return __generator(this, function (_c) {
        switch (_c.label) {
          case 0:
            logs = [];
            sequence = 0;
            stop = false;
            hasMoreLogs = "N";
            logPayload = new log_payload_1.LogPayload().parse(type);
            _c.label = 1;
          case 1:
            if (!!stop) return [3 /*break*/, 3];
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_LISTA_EVENTOS,
                sequencialPayload: sequence,
                payload: logPayload,
              }),
            ];
          case 2:
            request = _c.sent();
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              sequence =
                ((_a = request.frame) === null || _a === void 0
                  ? void 0
                  : _a.sequencialPayload) || 0;
              hasMoreLogs =
                ((_b = request.frame) === null || _b === void 0
                  ? void 0
                  : _b.aguardarMaisPayload) || "N";

              const matchTotalEvents = {
                alarme: {
                  total_events: 500,
                  event_type: 0,
                },
                falha: {
                  total_events: 250,
                  event_type: 1,
                },
                operacao: {
                  total_events: 125,
                  event_type: 3,
                },
              };

              let { total_events, event_type } = matchTotalEvents[type];
              const currentPayloadSequence =
                request.frame.sequencialPayload == 0
                  ? 1
                  : request.frame.sequencialPayload;

              if (hasMoreLogs === "N") {
                total_events = currentPayloadSequence;
              }
              const progress = (
                (currentPayloadSequence / total_events) *
                100
              ).toFixed(2);
              const frameResponse = {
                event_type,
                progress,
                is1060: true,
              };

              callback(frameResponse);

              logFrame = request.frame;
              logPayload_1 = new log_payload_1.LogPayload().unParse(
                logFrame.payload,
                sequence
              );
              logs.push.apply(logs, logPayload_1);
              if (hasMoreLogs === "N") {
                stop = true;
              }
            } else {
              throw new Error(request.response);
            }
            return [3 /*break*/, 1];
          case 3:
            return [2 /*return*/, logs];
        }
      });
    });
  };
  CommunicationService.prototype.getPasswords = function () {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
      var passwords, index, devicePayload, passwordRequest, passwordPayload;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            passwords = [];
            index = 2;
            _b.label = 1;
          case 1:
            if (!(index <= 4)) return [3 /*break*/, 4];
            devicePayload = new password_payload_1.PasswordPayload().parse({
              tipo: index,
              password: "",
            });
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_SENHA_ACESSO,
                payload: devicePayload,
              }),
            ];
          case 2:
            passwordRequest = _b.sent();
            passwordPayload = new password_payload_1.PasswordPayload().unParse(
              (_a = passwordRequest.frame) === null || _a === void 0
                ? void 0
                : _a.payload
            );
            if (
              passwordRequest.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              passwords.push(passwordPayload.password);
            } else {
              throw new Error(passwordRequest.response);
            }
            _b.label = 3;
          case 3:
            index++;
            return [3 /*break*/, 1];
          case 4:
            return [2 /*return*/, passwords];
        }
      });
    });
  };
  CommunicationService.prototype.centralDisconnect = function () {
    return __awaiter(this, void 0, void 0, function () {
      var response, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            response = false;
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_REINICIO_CENTRAL,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              response = true;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, response];
        }
      });
    });
  };
  CommunicationService.prototype.getLocalInstalation = function () {
    return __awaiter(this, void 0, void 0, function () {
      var localInstalation, request, localInstalationPayload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            localInstalation = "";
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_LOCAL_INSTALACAO,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            localInstalationPayload =
              new localInstalation_payload_1.LocalInstalationPayload().unParse(
                request.frame.payload
              );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              localInstalation = localInstalationPayload.localInstalation;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, localInstalation];
        }
      });
    });
  };
  CommunicationService.prototype.getMaxDelayTime = function () {
    return __awaiter(this, void 0, void 0, function () {
      var maxDelayTime, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            maxDelayTime = "";
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND.CMD_SOLICITAR_TEMPO_MAXIMO_RETARDO,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new maxDelayTime_payload_1.MaxDelayTimePayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              maxDelayTime = payload.maxDelayTime;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, maxDelayTime];
        }
      });
    });
  };
  CommunicationService.prototype.getDefaultRule = function () {
    return __awaiter(this, void 0, void 0, function () {
      var defaultRole, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_REGRA_PADRAO,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new defaultRule_payload_1.DefaultRulePayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              defaultRole = payload;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, defaultRole];
        }
      });
    });
  };
  CommunicationService.prototype.getClass = function () {
    return __awaiter(this, void 0, void 0, function () {
      var classLoop, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            classLoop = "";
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_CLASSE_AB,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new loopClass_payload_1.LoopClassPayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              classLoop = payload.type;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, classLoop];
        }
      });
    });
  };
  CommunicationService.prototype.getDateTime = function () {
    return __awaiter(this, void 0, void 0, function () {
      var date, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_DATA_HORA,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new dateTime_payload_1.DateTimePayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              date = payload.date;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, date];
        }
      });
    });
  };
  CommunicationService.prototype.getFirmwareVersion = function () {
    return __awaiter(this, void 0, void 0, function () {
      var version, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            version = "";
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_SOLICITAR_VERSAO_FIRMWARE,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new centralInfo_payload_1.CentralInfoPayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              version = payload.version;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, { version: version }];
        }
      });
    });
  };
  CommunicationService.prototype.refreshControls = function () {
    return __awaiter(this, void 0, void 0, function () {
      var request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND
                    .CMD_SOLICITAR_LIMPEZA_PARAMETROS_ESTATICOS,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.changeHandshakeTimeout = function () {
    return __awaiter(this, void 0, void 0, function () {
      var request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND.CMD_ALTERAR_TEMPO_VALIDADE_HANDSHAKE,
                payload: new buffer_1.Buffer([5]),
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.getBlockDevices = function () {
    return __awaiter(this, void 0, void 0, function () {
      var blockDevices, request, payload;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND.CMD_SOLICITAR_BLOQUEIO_ITENS_LOCAIS,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            payload = new blockDevices_payload_1.BlockDevicesPayload().unParse(
              request.frame.payload
            );
            if (
              request.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              blockDevices = payload;
            } else {
              throw new Error(request.response);
            }
            return [2 /*return*/, blockDevices];
        }
      });
    });
  };
  CommunicationService.prototype.sendPasswords = function (passwords) {
    return __awaiter(this, void 0, void 0, function () {
      var _i, passwords_1, password, frameProperties, payload, passwordSend;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            (_i = 0), (passwords_1 = passwords);
            _a.label = 1;
          case 1:
            if (!(_i < passwords_1.length)) return [3 /*break*/, 4];
            password = passwords_1[_i];
            frameProperties = {
              tipo: password.tipo,
              password: password.password,
            };
            payload = new password_payload_1.PasswordPayload().parse(
              frameProperties
            );
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_GRAVAR_SENHA_ACESSO,
                payload: payload,
              }),
            ];
          case 2:
            passwordSend = _a.sent();
            if (
              passwordSend.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(passwordSend.response);
            }
            _a.label = 3;
          case 3:
            _i++;
            return [3 /*break*/, 1];
          case 4:
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendLocalInstalation = function (
    localInstalation
  ) {
    return __awaiter(this, void 0, void 0, function () {
      var frameProperties, payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            frameProperties = {
              localInstalation: localInstalation,
            };
            payload =
              new localInstalation_payload_1.LocalInstalationPayload().parse(
                frameProperties
              );
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_GRAVAR_LOCAL_INSTALACAO,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendMaxDelayTime = function (maxDelayTime) {
    return __awaiter(this, void 0, void 0, function () {
      var frameProperties, payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            frameProperties = {
              maxDelayTime: maxDelayTime,
            };
            payload = new maxDelayTime_payload_1.MaxDelayTimePayload().parse(
              frameProperties
            );
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND.CMD_GRAVAR_TEMPO_MAXIMO_RETARDO,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendDefaultRule = function (defaultRule) {
    return __awaiter(this, void 0, void 0, function () {
      var payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            payload = new defaultRule_payload_1.DefaultRulePayload().parse(
              defaultRule
            );
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_GRAVAR_REGRA_PADRAO,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendClass = function (loopClass) {
    return __awaiter(this, void 0, void 0, function () {
      var frameProperties, payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            frameProperties = {
              type: loopClass === "A" ? "A" : "B",
            };
            payload = new loopClass_payload_1.LoopClassPayload().parse(
              frameProperties
            );
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_GRAVAR_CLASSE_AB,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendDateTime = function (dateTime) {
    return __awaiter(this, void 0, void 0, function () {
      var frameProperties, payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            frameProperties = {
              date: dateTime,
            };
            payload = new dateTime_payload_1.DateTimePayload().parse(
              frameProperties
            );
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_GRAVAR_DATA_HORA,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendBlockDevices = function (blockDevices) {
    return __awaiter(this, void 0, void 0, function () {
      var payload, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            payload = new blockDevices_payload_1.BlockDevicesPayload().parse(
              blockDevices
            );
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND.CMD_GRAVAR_BLOQUEIO_ITENS_LOCAIS,
                payload: payload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.sendDevices = function (devices) {
    return __awaiter(this, void 0, void 0, function () {
      var payloadDevices, sequencialPayload, _loop_1, this_1, indexDevice;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            payloadDevices = [];
            sequencialPayload = 0;
            _loop_1 = function (indexDevice) {
              var device, payloadDevice, devicePayload, deviceSendResult;
              return __generator(this, function (_b) {
                switch (_b.label) {
                  case 0:
                    device = devices.find(function (d) {
                      return d.endereco === indexDevice;
                    });
                    if (!device) {
                      device = {
                        nome: "Ausente",
                        tipo: 0,
                        endereco: indexDevice,
                        habilitado: false,
                      };
                    }
                    payloadDevice = {
                      nome: (0, string_1.clearString)(device.nome || "").padEnd(
                        14,
                        " "
                      ),
                      tipo: device.tipo,
                      habilitado: device.habilitado,
                      endereco: device.endereco,
                    };
                    payloadDevices.push(payloadDevice);
                    if (!(indexDevice % 8 === 0 || indexDevice === 60))
                      return [3 /*break*/, 2];
                    devicePayload = new device_payload_1.DevicePayload().parse(
                      payloadDevices
                    );
                    return [
                      4 /*yield*/,
                      this_1.send({
                        comando:
                          commands_type_1.COMMAND.CMD_GRAVAR_TABELA_REGISTROS,
                        payload: devicePayload,
                        sequencialPayload: sequencialPayload,
                        tamanhoPayload: 16 * payloadDevices.length,
                        aguardarMaisPayload: indexDevice === 60 ? "N" : "+",
                      }),
                    ];
                  case 1:
                    deviceSendResult = _b.sent();
                    payloadDevices = [];
                    sequencialPayload++;
                    if (
                      deviceSendResult.response !==
                      socket_interface_1.CommunicationResponseType.OK
                    ) {
                      throw new Error(deviceSendResult.response);
                    }
                    _b.label = 2;
                  case 2:
                    return [2 /*return*/];
                }
              });
            };
            this_1 = this;
            indexDevice = 1;
            _a.label = 1;
          case 1:
            if (!(indexDevice <= 60)) return [3 /*break*/, 4];
            return [5 /*yield**/, _loop_1(indexDevice)];
          case 2:
            _a.sent();
            _a.label = 3;
          case 3:
            indexDevice++;
            return [3 /*break*/, 1];
          case 4:
            return [2 /*return*/, true];
        }
      });
    });
  };
  CommunicationService.prototype.isUSBConnected = function () {
    var _a;
    return __awaiter(this, void 0, void 0, function () {
      var request;
      return __generator(this, function (_b) {
        switch (_b.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando: commands_type_1.COMMAND.CMD_VERIFICAR_CONEXAO_CABO_USB,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _b.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [
              2 /*return*/,
              new usbConnected_payload_1.USBConnectedPayload().unParse(
                (_a = request.frame) === null || _a === void 0
                  ? void 0
                  : _a.payload
              ),
            ];
        }
      });
    });
  };
  CommunicationService.prototype.startBootloaerMode = function () {
    return __awaiter(this, void 0, void 0, function () {
      var request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            return [
              4 /*yield*/,
              this.send({
                comando:
                  commands_type_1.COMMAND
                    .CMD_ENTRAR_EM_MODO_ATUALIZACAO_FIRMWARE,
                payload: emptyPayload,
              }),
            ];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            return [2 /*return*/, true];
        }
      });
    });
  };
  return CommunicationService;
})();
exports.CommunicationService = CommunicationService;
