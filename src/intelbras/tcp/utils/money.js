"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.money = void 0;
var money = function (amount) {
  var price;
  var i = parseInt(
    (price = Math.abs(Number(amount) || 0).toFixed(2)),
    10
  ).toString();
  var j = i.length > 3 ? i.length % 3 : 0;
  return ""
    .concat(
      (j ? "".concat(i.substr(0, j), ".") : "") +
        i.substr(j).replace(/(\d{3})(?=\d)/g, "$1."),
      ","
    )
    .concat(
      Math.abs(Number(price) - Number(i))
        .toFixed(2)
        .slice(2)
    );
};
exports.money = money;
