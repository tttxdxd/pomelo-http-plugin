const fs = require('fs');
const path = require('path');
const http = require('http');
const http2 = require('http2');
const https = require('https');
const assert = require('assert');

const Koa = require('koa');
const Router = require('koa-router');

const utils = require('../util/utils');

const ST_INITED = 0;
const ST_STARTED = 1;
const ST_CLOSED = 2;

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 2333;

const HTTPService = function (app, opts) {
    this.app = app;
    this.opts = opts || {};
    this.state = ST_INITED;

    this.logger = opts.logger || getDefaultLogger();
    this.http = new Koa();
    this.server = null;
    this.beforeFilters = require('../../index').beforeFilters;
    this.afterFilters = require('../../index').afterFilters;

    this.host = opts.host || DEFAULT_HOST;
    this.port = opts.port || DEFAULT_PORT;
    this.protocol = opts.protocol || 'http';
    this.sslOtps = {};

    if (['http2', 'https'].includes(this.protocol)) {
        assert.ok(opts.key, '');
        assert.ok(opts.cert, '');

        this.sslOtps.key = fs.readFileSync(app.getBase(), opts.key);
        this.sslOtps.cert = fs.readFileSync(app.getBase(), opts.cert);
    }
};

module.exports = HTTPService;

HTTPService.prototype.start = function (cb) {
    this.logger.info('Http start');

    if (this.state !== ST_INITED) {
        this.logger.error('Http start');
        utils.invokeCallback(cb, new Error('invalied state'));
        return;
    }

    this.beforeFilters.forEach(m => this.http.use(m));
    this.loadRoutes();
    this.afterFilters.forEach(m => this.http.use(m));

    if (this.port === 'http2') {
        this.server = http2.createServer(this.sslOtps, this.http).listen(this.port, this.host);
    } else if (this.protocol === 'https') {
        this.server = https.createServer(this.sslOtps, this.http).listen(this.port, this.host);
    } else {
        this.server = http.createServer(this.http).listen(this.port, this.host);
    }

    this.server.on('listening', () => {
        this.state = ST_STARTED;
        this.logger.info('server listening', `url: ${this.protocol === 'http2' ? 'https' : this.protocol}://${this.host}:${this.port}`);
        utils.invokeCallback(cb);
    });
    this.server.on('close', () => {
        this.state = ST_CLOSED;
        this.logger.info('server close');
    });
    this.server.on('error', (err) => {
        this.logger.error('server error', err);
    });
};

HTTPService.prototype.afterStart = function (cb) {
    this.logger.info('Http afterStart');
    utils.invokeCallback(cb);
}

HTTPService.prototype.stop = function (force, cb) {
    this.logger.info('Http stop');

    if (this.state !== ST_STARTED) {
        utils.invokeCallback(cb, new Error('invalid state'));
        return;
    }

    this.server.close(() => {
        utils.invokeCallback(cb);
    });
};

HTTPService.prototype.before = function (middleware) {
    this.beforeFilters.push(middleware);
};

HTTPService.prototype.after = function (middleware) {
    this.afterFilters.push(middleware);
};

HTTPService.prototype.loadRoutes = function () {
    let routesPath = path.join(this.app.getBase(), 'app/servers', this.app.getServerType(), 'route');

    if (fs.existsSync(routesPath)) {
        fs.readdirSync(routesPath).forEach(route => {
            if (route.endsWith('.js')) {
                let routePath = path.join(routesPath, route);

                require(routePath)(this.app, this.http, this);
            }
        });
    } else {
        this.logger.error('routesPath is not found', routesPath);
    }
};

let getDefaultLogger = function () {
    return {
        debug: console.debug,
        info: console.log,
        warn: console.warn,
        error: console.error,
    };
};