const HTTPService = require('../service/httpService');

module.exports = function (app, opts) {
    let service = new HTTPService(app, opts)
    app.set('httpService', service);
    return service;
};

module.exports.name = '__http__';