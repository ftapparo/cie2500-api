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
exports.FrameCieDefault = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var SIZE_PAYLOAD = 132;
var SIZE_FRAME = 144;
var FrameCieDefault = /** @class */ (function () {
  function FrameCieDefault() {
    this.struct = new struct_1.Struct().array("payload", SIZE_PAYLOAD, "word8");
    this.struct.allocate();
  }
  FrameCieDefault.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    var bufferPayload = new buffer_1.Buffer(128);
    bufferPayload.set(properties.payload);
    for (var indexByte = 0; indexByte < SIZE_FRAME; indexByte++) {
      proxy.payload[indexByte] = bufferPayload[indexByte];
    }
    this.properties = this.struct.fields;
    return buf;
  };
  FrameCieDefault.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(SIZE_FRAME, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var properties = {
      payload: new buffer_1.Buffer(Object.values(proxy.payload)),
    };
    return properties;
  };
  FrameCieDefault.prototype.isEmptyPayload = function (payload) {
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
  FrameCieDefault.prototype.printProperties = function () {
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
  return FrameCieDefault;
})();
exports.FrameCieDefault = FrameCieDefault;
