"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InconsistencyTypeNames = exports.InconsistencyType = void 0;
var InconsistencyType;
(function (InconsistencyType) {
  InconsistencyType[(InconsistencyType["TYPE"] = 0)] = "TYPE";
  InconsistencyType[(InconsistencyType["HAS_ONLY_CENTRAL"] = 1)] =
    "HAS_ONLY_CENTRAL";
  InconsistencyType[(InconsistencyType["HAS_ONLY_DATA"] = 2)] = "HAS_ONLY_DATA";
})(
  (InconsistencyType =
    exports.InconsistencyType || (exports.InconsistencyType = {}))
);
exports.InconsistencyTypeNames =
  ((_a = {}),
  (_a[InconsistencyType.TYPE] = "inconsistencyTypeType"),
  (_a[InconsistencyType.HAS_ONLY_CENTRAL] = "inconsistencyTypeHasOnlyCentral"),
  (_a[InconsistencyType.HAS_ONLY_DATA] = "inconsistencyTypeTypeHasOnlyData"),
  _a);
