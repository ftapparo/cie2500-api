/**
 * Criado por Livecom on 3/22/2016.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

var crc = require("crc-32");
var fs = require("fs");

module.exports = {
  saveFile: function (path, replaceFile, type, config, callback) {
    var crc32 = generateCRC(config);
    config.crc = crc32;
    var response = { data: {} };
    response.event = type == "config" ? "save_file" : "save_logs";
    if (!replaceFile) {
      fs.stat(path, function (err, stat) {
        if (err == null) {
          response.data["type"] = "exist";
          callback(response);
        } else if (err.code == "ENOENT") {
          fs.writeFile(path, JSON.stringify(config), function (err) {
            if (err) {
              response.data["type"] = "write_err";
            } else {
              response.data["type"] = "success";
            }
            callback(response);
          });
        } else {
          response.data["type"] = "error";
          callback(response);
        }
      });
    } else {
      fs.writeFile(path, JSON.stringify(config), function (err) {
        if (err) {
          response.data["type"] = "write_err";
        } else {
          response.data["type"] = "success";
        }
        callback(response);
      });
    }
  },

  openFile: function (path, type, callback) {
    fs.readFile(path, "utf8", function (err, data) {
      var response = { event: "", data: {} };
      response.event = type == "config" ? "open_file" : "open_logs";

      if (err) {
        response.data["type"] = "read_err";
      } else {
        try {
          var config = JSON.parse(data);
          var read_crc32 = config.crc;
          delete config.crc;
          var real_crc32 = generateCRC(config);
          if (read_crc32 == real_crc32) {
            response.data["config"] = config;
            response.data["type"] = "success";
          } else {
            response.data["type"] = "corrupt_err";
          }
        } catch (e) {
          response.data["type"] = "corrupt_err";
        }
      }
      callback(response);
    });
  },

  openCertFile: function (path, callback) {
    try {
      const data = fs.readFileSync(path);
      callback(data);
    } catch (e) {
      callback(null);
    }
  },

  checkSizeFile: function (path) {
    try {
      var stats = fs.statSync(path);
      return stats.size;
    } catch (e) {
      return 0;
    }
  },
};

function generateCRC(config) {
  return crc.str(JSON.stringify(config) + "1NT3LBR4S_C13_F1L3");
}
