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
exports.SocketService = void 0;
var buffer_1 = require("buffer");
var net_1 = require("net");
var frame_struct_1 = require("../../model/frame.struct");
var handshake_model_1 = require("../../model/handshake.model");
var commands_type_1 = require("../../config/commands.type");
var socket_interface_1 = require("../socket.interface");
var TIMEOUT_SOCKET = 2000;
var HOST = "192.168.4.1";
var SocketService = /** @class */ (function () {
  function SocketService() {
    this.attemps = 0;
  }
  SocketService.prototype.clearTimeout = function () {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  };
  SocketService.prototype.createTimeout = function (acc) {
    var _this = this;
    this.clearTimeout();
    this.timeout = setTimeout(function () {
      var _a;
      console.log("timeout");
      (_a = _this.socket) === null || _a === void 0 ? void 0 : _a.destroy();
      acc({
        frame: socket_interface_1.emptyFrame,
        response: socket_interface_1.CommunicationResponseType.TIMEOUT,
      });
    }, TIMEOUT_SOCKET);
  };
  SocketService.prototype.write = function (frame, acc) {
    var _this = this;
    setTimeout(function () {
      var _a;
      (_a = _this.socket) === null || _a === void 0
        ? void 0
        : _a.write(frame, undefined, function (err) {
            if (err && acc) {
              console.log("========================== ERRO WRITE");
              //this.clearTimeout();
              acc({
                frame: socket_interface_1.emptyFrame,
                response: socket_interface_1.CommunicationResponseType.FAIL,
              });
            }
          });
    }, 100);
  };
  SocketService.prototype.send = function (frame, ping) {
    if (ping === void 0) {
      ping = false;
    }
    return __awaiter(this, void 0, void 0, function () {
      var _this = this;
      return __generator(this, function (_a) {
        try {
          return [
            2 /*return*/,
            new Promise(function (acc, rej) {
              var handshake = new handshake_model_1.HandshakeFrame();
              var handshakeFrame = handshake.parse();
              var frameSend = new frame_struct_1.FrameStruct();
              _this.createTimeout(acc);
              _this.socket = (0, net_1.createConnection)(
                {
                  //interface: "wifi",
                  //reuseAddress: true,
                  host: HOST,
                  port: 31320,
                },
                function () {
                  console.log(">> ENVIA", handshake.printProperties());
                  _this.write(handshakeFrame, acc);
                  _this.createTimeout(acc);
                }
              );
              _this.socket.on("timeout", function () {
                console.info("timeout", _this.timeout);
                _this.clearTimeout();
                acc({
                  frame: socket_interface_1.emptyFrame,
                  response:
                    socket_interface_1.CommunicationResponseType.TIMEOUT,
                });
              });
              _this.socket.on("data", function (data) {
                var _a, _b;
                _this.attemps = 0;
                var dataBuffer = buffer_1.Buffer.from(data);
                console.log("<< RECEIVE", Buffer.from(data));
                var frameReceived = new frame_struct_1.FrameStruct().unParse(
                  dataBuffer
                );
                //console.info("<< RECEBE", JSON.stringify(frameReceived));
                if (
                  frameReceived.comando ===
                  commands_type_1.COMMAND.RSP_HAND_SHAKE
                ) {
                  if (ping) {
                    _this.clearTimeout();
                    acc({
                      frame: frameReceived,
                      response: socket_interface_1.CommunicationResponseType.OK,
                    });
                    (_a = _this.socket) === null || _a === void 0
                      ? void 0
                      : _a.destroy();
                  } else {
                    _this.createTimeout(acc);
                    var bufferToSend = frameSend.parse(frame);
                    console.log(">> ENVIA", frameSend.printProperties());
                    _this.write(bufferToSend, acc);
                  }
                } else if (
                  frameReceived.comando ===
                  commands_type_1.COMMAND_RESPONSE[frame.comando]
                ) {
                  _this.clearTimeout();
                  acc({
                    frame: frameReceived,
                    response: socket_interface_1.CommunicationResponseType.OK,
                  });
                  (_b = _this.socket) === null || _b === void 0
                    ? void 0
                    : _b.destroy();
                } else {
                  // this.clearTimeout();
                  // this.socket?.destroy();
                  // console.log('caso 3')
                  // // this.socket?.destroy();
                  // acc({
                  //   frame: emptyFrame,
                  //   response: CommunicationResponseType.FAIL,
                  // });
                }
              });
              _this.socket.on("error", function (error) {
                _this.clearTimeout();
                console.error("SOCKET ERROR", error);
                acc({
                  frame: socket_interface_1.emptyFrame,
                  response: socket_interface_1.CommunicationResponseType.ERROR,
                });
              });
              _this.socket.on("close", function () {
                //console.info("SOCKET CLOSE");
              });
            }),
          ];
        } catch (e) {
          console.error("SOCKET EXCEPTION", e);
          return [
            2 /*return*/,
            {
              frame: socket_interface_1.emptyFrame,
              response: socket_interface_1.CommunicationResponseType.ERROR,
            },
          ];
        }
        return [2 /*return*/];
      });
    });
  };
  SocketService.prototype.sendBuffer = function (data) {
    return Promise.resolve(undefined);
  };
  return SocketService;
})();
exports.SocketService = SocketService;
