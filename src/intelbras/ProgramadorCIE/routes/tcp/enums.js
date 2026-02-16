"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsDetailType =
  exports.DeviceOperacaoDetailTypes =
  exports.DeviceFalhaDetailTypes =
  exports.EventsType =
  exports.LogTypeNameNumber =
  exports.LogTypes =
  exports.DeviceTypesInitials1060 =
  exports.DeviceTypes1060 =
  exports.LimitsCentralModel =
  exports.CentralModels =
  exports.ConnectionType =
    void 0;
var ConnectionType;
(function (ConnectionType) {
  ConnectionType["OFFLINE"] = "OFFLINE";
  ConnectionType["ONLINE"] = "ONLINE";
})((ConnectionType = exports.ConnectionType || (exports.ConnectionType = {})));
var CentralModels;
(function (CentralModels) {
  CentralModels["CIE1060"] = "CIE1060";
  CentralModels["CIE2500"] = "CIE2500";
  CentralModels["CIE1250"] = "CIE1250";
  CentralModels["CIE1125"] = "CIE1125";
})((CentralModels = exports.CentralModels || (exports.CentralModels = {})));
exports.LimitsCentralModel =
  ((_a = {}),
  (_a[CentralModels.CIE1060] = 60),
  (_a[CentralModels.CIE1125] = 125),
  (_a[CentralModels.CIE1250] = 250),
  (_a[CentralModels.CIE2500] = 250),
  _a);
exports.DeviceTypes1060 = {
  0: "Ausente       ",
  1: "Det.Fumaca    ",
  2: "Det.Temper    ",
  3: "AcionadorM    ",
  4: "M. De Zona    ",
  5: "M. Entrada    ",
  9: "M. E/Saida    ",
  10: "Sirene AV.    ",
};
exports.DeviceTypesInitials1060 = {
  0: "N/R",
  1: "DFE",
  2: "DTE",
  3: "AME",
  4: "MDZ",
  5: "MDI",
  9: "MIO",
  10: "SAV",
};
exports.LogTypes = {
  0: "alarme",
  1: "falha",
  2: "operacao",
};
exports.LogTypeNameNumber = {
  alarme: 0,
  falha: 1,
  operacao: 2,
};
var EventsTypeFalha = [
  "Desconhecido",
  "falhaFaltaRedeEletrica",
  "falhaFaltaBateria",
  "falhaFugaTerraPositivo",
  "falhaFugaTerraNegativo",
  "falhaSireneEmCurto",
  "falhaSireneEmAberto",
  "falhaSaida24VEmCurto",
  "falhaSubtensao",
];
var EventsTypeAlarme = ["Desconhecido", "alarmeGeral"];
var EventsTypeOperacao = [
  "Desconhecido",
  "CentralIniciada",
  "CentralReiniciada",
  "AcessoSenha_2_",
  "AcessoSenha_3_",
  "AcessoSenha_4_",
  "BipInternoSilenciado",
  "SireneAdiada",
  "SireneSilenciada",
  "DataHoraAlterada",
  "FuncaoGravarEnderececo",
  "FuncaoLerEndereco",
  "RegistroDeLaco",
  "AjusteTempoAtraso",
  "AjusteTempoMaximo",
  "AcessoFuncaoWiFi",
  "ConclusaoFuncaoWiFi",
  "AcessoFuncaoWizzard",
  "ConcluidoWizzardPadrao",
  "AjusteDisplayContrasteBacklight",
  "AcessoEdicaoNomesDispositivos",
  "AlteradoSenha_2_",
  "AlteradoSenha_3_",
  "AlteradoSenha_4_",
  "AcessoEdicaoLocalInstalacao",
  "RegraPadraoAlterada",
  "AlteradoCentralParaClasseA",
  "AlteradoCentralParaClasseB",
  "SireneConvencionalAcionadaManualmente",
  "SireneConvencionalDesacionadaManualmente",
  "SireneConvencionalBloqueadaManualmente",
  "SireneConvencionalDesbloqueadaManualmente",
  "ReleAlarmeAcionadoManualmente",
  "ReleAlarmeDesacionadoManualmente",
  "ReleAlarmeBloqueadoManualmente",
  "ReleAlarmeDesbloqueadoManualmente",
  "ReleFalhaAcionadoManualmente",
  "ReleFalhaDesacionadoManualmente",
  "ReleFalhaBloqueadoManualmente",
  "ReleFalhaDesbloqueadoManualmente",
  "BloqueioRegraPadrao",
  "DesbloqueioRegraPadrao",
  "BloqueioLaco",
  "DesbloqueioLaco",
  "BloquearTodos",
  "DesbloquearTodos",
  "AcionarTodos",
  "DesacionarTodos",
];
exports.EventsType = {
  alarme: EventsTypeAlarme,
  falha: EventsTypeFalha,
  operacao: EventsTypeOperacao,
};
exports.DeviceFalhaDetailTypes = [
  "falhaClasseABIndeterminada",
  "falhaClasseABNaSaidaDoLaco",
  "falhaClasseABNoRetornoDoLaco",
  "falhaClasseABNaSaidaERetornoDoLaco",
];
exports.DeviceOperacaoDetailTypes = [
  "Desconhecido",
  "OperacaoBloqueado",
  "OperacaoDesbloqueado",
  "OperacaoAcionado",
  "OperacaoDesacionado",
  "OperacaoIncluidoNaTabelaDeRegistros",
  "OperacaoExluidoDaTabelaDeRegistros",
];
exports.EventsDetailType = {
  alarme: [],
  falha: exports.DeviceFalhaDetailTypes,
  operacao: exports.DeviceOperacaoDetailTypes,
};
