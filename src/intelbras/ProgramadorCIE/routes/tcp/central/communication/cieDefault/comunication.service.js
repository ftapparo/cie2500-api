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
var socket_interface_1 = require("../../socket/socket.interface");
var log_payload_1 = require("../../model/log.payload");
var commands_type_1 = require("../../config/commands.type");
var CommunicationService = /** @class */ (function () {
  function CommunicationService(socketService) {
    this.socketService = socketService;
    this.transmitting = false;
  }
  CommunicationService.prototype.sendConfiguration = function (fileData) {
    throw new Error("Method not implemented.");
  };
  CommunicationService.prototype.sendBuffer = function (data) {
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
              //console.log(">> FALHOU, TENTA NOVAMENTE, TENTATIVA ", attemps);
            }
            if (!this.transmitting) return [3 /*break*/, 3];
            //console.log(">> WAIT, TRANSMITTING", attemps);
            return [
              4 /*yield*/,
              new Promise(function (r) {
                return setTimeout(r, 250);
              }),
            ];
          case 2:
            _a.sent();
            attemps++;
            return [3 /*break*/, 5];
          case 3:
            this.transmitting = true;
            return [4 /*yield*/, this.socketService.sendBuffer(data)];
          case 4:
            response = _a.sent();
            this.transmitting = false;
            if (
              response.response ===
              socket_interface_1.CommunicationResponseType.OK
            ) {
              stop = true;
            }
            attemps++;
            _a.label = 5;
          case 5:
            if (!stop && attemps <= 20) return [3 /*break*/, 1];
            _a.label = 6;
          case 6:
            return [2 /*return*/, response];
        }
      });
    });
  };
  CommunicationService.prototype.getVersion = function () {
    return __awaiter(this, void 0, void 0, function () {
      var version, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            version = "";
            return [4 /*yield*/, this.sendBuffer(new buffer_1.Buffer([0, 1]))];
          case 1:
            request = _a.sent();
            if (
              request.response !==
              socket_interface_1.CommunicationResponseType.OK
            ) {
              throw new Error(request.response);
            }
            version = ""
              .concat(request.frame.payload[2], ".")
              .concat(request.frame.payload[3], ".")
              .concat(request.frame.payload[4]);
            return [2 /*return*/, version];
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
            return [4 /*yield*/, this.sendBuffer(new buffer_1.Buffer([0, 99]))];
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
  CommunicationService.prototype.centralDisconnect = function () {
    return __awaiter(this, void 0, void 0, function () {
      var response, request;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            response = false;
            return [4 /*yield*/, this.sendBuffer(new buffer_1.Buffer([0, 38]))];
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

  return CommunicationService;
})();
exports.CommunicationService = CommunicationService;
