"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateTimePayload = void 0;
var buffer_1 = require("buffer");
var struct_1 = require("../../js-libs/struct");
var DateTimePayload = /** @class */ (function () {
  function DateTimePayload() {
    this.struct = new struct_1.Struct()
      .word8("year")
      .word8("month")
      .word8("day")
      .word8("hour")
      .word8("min")
      .word8("sec");
    this.struct.allocate();
  }
  DateTimePayload.prototype.parse = function (properties) {
    var buf = this.struct.buffer();
    buf.fill(0);
    var proxy = this.struct.fields;
    proxy.day = properties.date.getDate();
    proxy.month = properties.date.getMonth() + 1;
    proxy.year = properties.date.getFullYear() - 2000;
    proxy.hour = properties.date.getHours();
    proxy.min = properties.date.getMinutes();
    proxy.sec = properties.date.getSeconds();
    return buf;
  };
  DateTimePayload.prototype.unParse = function (data) {
    var buffer = buffer_1.Buffer.alloc(128, 0);
    buffer.set(data, 0);
    this.struct.setBuffer(buffer);
    var proxy = this.struct.fields;
    var date = new Date(
      proxy.year + 2000,
      proxy.month - 1,
      proxy.day,
      proxy.hour,
      proxy.min,
      proxy.sec,
      0
    );
    var dateTime = {
      date: date,
    };
    return dateTime;
  };
  return DateTimePayload;
})();
exports.DateTimePayload = DateTimePayload;
