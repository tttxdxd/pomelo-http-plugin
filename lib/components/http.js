const HTTPService = require('../service/httpService');

module.exports = function (app, opts) {
    return new HTTPService(app, opts);
};

module.exports.name = '__http__';