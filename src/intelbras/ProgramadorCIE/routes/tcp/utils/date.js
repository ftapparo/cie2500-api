"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAfterToday =
  exports.isBeforeToday =
  exports.isValidDate =
  exports.dateString =
  exports.formattedHourString =
  exports.formattedDateString =
  exports.getDateString =
  exports.getDateObject =
    void 0;
var date_fns_1 = require("date-fns");
var getDateObject = function (date) {
  return new Date(date);
};
exports.getDateObject = getDateObject;
var getDateString = function (date) {
  return ""
    .concat(date.getUTCFullYear(), "-")
    .concat(date.getUTCMonth() + 1 < 10 ? "0" : "")
    .concat(date.getUTCMonth() + 1, "-")
    .concat(date.getUTCDate() < 10 ? "0" : "")
    .concat(date.getUTCDate());
};
exports.getDateString = getDateString;
var formattedDateString = function (date) {
  return ""
    .concat(date.getUTCDate() < 10 ? "0" : "")
    .concat(date.getUTCDate(), "/")
    .concat(date.getUTCMonth() + 1 < 10 ? "0" : "")
    .concat(date.getUTCMonth() + 1, "/")
    .concat(date.getUTCFullYear());
};
exports.formattedDateString = formattedDateString;
var formattedHourString = function (date) {
  return ""
    .concat(date.getUTCHours() < 10 ? "0" : "")
    .concat(date.getUTCHours(), ":")
    .concat(date.getUTCMinutes() < 10 ? "0" : "")
    .concat(date.getUTCMinutes());
};
exports.formattedHourString = formattedHourString;
var dateString = function (brDate) {
  var date = brDate.split("/");
  return "".concat(date[2], "-").concat(date[1], "-").concat(date[0]);
};
exports.dateString = dateString;
var isValidDate = function (input) {
  if (input === void 0) {
    input = " / / ";
  }
  var splitted = input.split("/");
  if (splitted.length !== 3) {
    return false;
  }
  var day = splitted[0],
    month = splitted[1],
    year = splitted[2];
  return (
    (0, date_fns_1.format)(
      new Date(Number(year), Number(month) - 1, Number(day)),
      "dd/MM/yyyy"
    ) === input
  );
};
exports.isValidDate = isValidDate;
var isBeforeToday = function (input) {
  if (input === void 0) {
    input = " / / ";
  }
  var splitted = input.split("/");
  if (splitted.length !== 3) {
    return false;
  }
  var day = splitted[0],
    month = splitted[1],
    year = splitted[2];
  var today = new Date();
  var date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number(year) < 1900) {
    return false;
  }
  return date < today;
};
exports.isBeforeToday = isBeforeToday;
var isAfterToday = function (input) {
  if (input === void 0) {
    input = " / / ";
  }
  var splitted = input.split("/");
  if (splitted.length !== 3) {
    return false;
  }
  var day = splitted[0],
    month = splitted[1],
    year = splitted[2];
  var today = new Date();
  var date = new Date(Number(year), Number(month) - 1, Number(day));
  return date > today;
};
exports.isAfterToday = isAfterToday;
