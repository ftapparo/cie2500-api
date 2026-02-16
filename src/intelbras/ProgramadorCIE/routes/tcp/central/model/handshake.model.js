"use strict";
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.HandshakeFrame = void 0;
var buffer_1 = require("buffer");
var commands_type_1 = require("../config/commands.type");
var frame_struct_1 = require("../model/frame.struct");
var HandshakeFrame = /** @class */ (function () {
  function HandshakeFrame() {}
  HandshakeFrame.prototype.parse = function () {
    var properties = {
      origem: "App",
      destino: "Cie",
      comandoResposta: "Cmd",
      comando: commands_type_1.COMMAND.CMD_HAND_SHAKE,
      payload: new buffer_1.Buffer([]),
      sequencialPayload: 0,
      tamanhoPayload: 0,
      aguardarMaisPayload: "N",
      livre: "012",
    };
    var frameSend = new frame_struct_1.FrameStruct();
    var buffer = frameSend.parse(properties);
    this.properties = frameSend.properties;
    return buffer;
  };
  HandshakeFrame.prototype.unParse = function (data) {
    var frameReceived = new frame_struct_1.FrameStruct();
    var unparsed = frameReceived.unParse(data);
    return unparsed.comando === commands_type_1.COMMAND.RSP_HAND_SHAKE;
  };
  HandshakeFrame.prototype.printProperties = function () {
    var _a;
    var print = "";
    var payload =
      (_a = this.properties) === null || _a === void 0 ? void 0 : _a.payload;
    if (payload) {
      var payloadValues = Object.values(payload).filter(function (i) {
        return i !== undefined;
      });
      print = JSON.stringify(
        __assign(__assign({}, this.properties), { payload: payloadValues })
      );
    }
    return print;
  };
  return HandshakeFrame;
})();
exports.HandshakeFrame = HandshakeFrame;
