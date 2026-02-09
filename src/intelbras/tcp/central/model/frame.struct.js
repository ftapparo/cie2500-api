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
exports.FrameStruct = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var SIZE_PAYLOAD = 128;
var SIZE_FRAME = 144;
var FrameStruct = /** @class */ (function () {
  function FrameStruct() {
    this.struct = new struct_1.Struct()
      .chars("origem", 3)
      .chars("destino", 3)
      .chars("comandoResposta", 3)
      .word8("comando")
      .word8("tamanhoPayload")
      .word8("sequencialPayload")
      .chars("aguardarMaisPayload", 1)
      .chars("livre", 3)
      .array("payload", SIZE_PAYLOAD, "word8");
    this.struct.allocate();
  }
  FrameStruct.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    proxy.origem = "App";
    proxy.destino = "Cie";
    proxy.comandoResposta = "Cmd";
    proxy.comando = properties.comando;
    proxy.tamanhoPayload =
      properties.tamanhoPayload !== undefined
        ? properties.tamanhoPayload
        : properties.payload
        ? properties.payload.byteLength
        : 0;
    proxy.sequencialPayload = properties.payload
      ? properties.sequencialPayload
        ? properties.sequencialPayload
        : 0
      : 0;
    proxy.livre = "012";
    proxy.aguardarMaisPayload = properties.aguardarMaisPayload || "N";
    var bufferPayload = new buffer_1.Buffer(128);
    bufferPayload.set(properties.payload);
    for (var indexByte = 0; indexByte < SIZE_FRAME; indexByte++) {
      proxy.payload[indexByte] = bufferPayload[indexByte];
    }
    this.properties = this.struct.fields;
    return buf;
  };
  FrameStruct.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(SIZE_FRAME, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var properties = {
      origem: proxy.origem,
      destino: proxy.destino,
      comandoResposta: proxy.comandoResposta,
      comando: proxy.comando,
      payload: new buffer_1.Buffer(Object.values(proxy.payload)),
      tamanhoPayload: proxy.tamanhoPayload,
      sequencialPayload: proxy.sequencialPayload,
      livre: proxy.livre,
      aguardarMaisPayload: proxy.aguardarMaisPayload,
    };
    return properties;
  };
  FrameStruct.prototype.isEmptyPayload = function (payload) {
    if (payload === undefined) {
      return true;
    }
    if (payload.byteLength) {
      for (var _i = 0, payload_1 = payload; _i < payload_1.length; _i++) {
        var byte = payload_1[_i];
        if (byte !== 0) {
          return false;
        }
      }
    }
    return true;
  };
  FrameStruct.prototype.printProperties = function () {
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
  return FrameStruct;
})();
exports.FrameStruct = FrameStruct;
