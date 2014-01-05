var fs = require('fs');
var expect = require('chai').expect;
var express = require('express');
var request = require('request');
var eightTrack = require('../');
var httpUtils = require('./utils/http');
var serverUtils = require('./utils/server');

describe('A server', function () {
  serverUtils.run(1337, function (req, res) {
    res.send('oh hai');
  });

  describe('being proxied by `eight-track`', function () {
    var fixtureDir = __dirname + '/actual-files/basic';
    serverUtils.runEightServer(1338, {
      fixtureDir: fixtureDir,
      url: 'http://localhost:1337'
    });

    describe('when requested once', function () {
      httpUtils.save('http://localhost:1338/');

      it('touches the server', function () {
        expect(this.requests[1337]).to.have.property('length', 1);
      });

      it('receives the expected response', function () {
        expect(this.err).to.equal(null);
        expect(this.res.statusCode).to.equal(200);
        expect(this.body).to.equal('oh hai');
      });

      it('writes the response to a file', function () {
        var files = fs.readdirSync(fixtureDir);
        expect(files).to.have.property('length', 1);
      });

      describe('and when requested again', function () {
        httpUtils.save('http://localhost:1338/');

        it('does not touch the server', function () {
          expect(this.requests[1337]).to.have.property('length', 1);
        });

        it('receives the expected response', function () {
          expect(this.err).to.equal(null);
          expect(this.res.statusCode).to.equal(200);
          expect(this.body).to.equal('oh hai');
        });
      });
    });
  });
});

// DEV: This is testing uniquely generated keys
describe('A server with multiple paths', function () {
  serverUtils.run(1337, function (req, res) {
    if (req.url === '/hello') {
      res.send('hello');
    } else {
      res.send('world');
    }
  });

  describe('being proxied by `eight-track`', function () {
    serverUtils.runEightServer(1338, {
      fixtureDir: __dirname + '/actual-files/multi',
      url: 'http://localhost:1337'
    });

    describe('a request to `/hello`', function () {
      httpUtils.save('http://localhost:1338/hello');

      it('replies with \'hello\'', function () {
        expect(this.err).to.equal(null);
        expect(this.body).to.equal('hello');
      });

      describe('and a request to `/world`', function () {
        httpUtils.save('http://localhost:1338/world');

        it('replies with \'world\'', function () {
          expect(this.err).to.equal(null);
          expect(this.body).to.equal('world');
        });
      });
    });
  });
});

// DEV: This tests that we save a request with query parameters
// DEV: and that it forwards the query parameters
describe('A query-echoing server being proxied', function () {
  serverUtils.run(1337, function (req, res) {
    res.send(req.query);
  });
  serverUtils.runEightServer(1338, {
    fixtureDir: __dirname + '/actual-files/query',
    url: 'http://localhost:1337'
  });

  describe('when requested with one set of query parameters', function () {
    httpUtils.save('http://localhost:1338/?hello=world');

    it('receives with its query parameters', function () {
      expect(this.err).to.equal(null);
      expect(JSON.parse(this.body)).to.deep.equal({hello:'world'});
    });

    describe('when requested again', function () {
      httpUtils.save('http://localhost:1338/?hello=world');

      it('does not double request', function () {
        expect(this.requests[1337]).to.have.property('length', 1);
      });
    });

    describe('and a request with a different set of query parameters', function () {
      httpUtils.save('http://localhost:1338/?goodbye=moon');

      it('receives a different set of parameters', function () {
        expect(this.err).to.equal(null);
        expect(JSON.parse(this.body)).to.deep.equal({goodbye:'moon'});
      });
    });
  });
});

describe('A failing server that is being proxied', function () {
  serverUtils.run(1337, function (req, res) {
    res.send('error', 500);
  });
  serverUtils.runEightServer(1338, {
    fixtureDir: __dirname + '/actual-files/status',
    url: 'http://localhost:1337'
  });

  describe('when requested', function () {
    httpUtils.save('http://localhost:1338/');

    it('replies with a 500 status code and its message', function () {
      expect(this.err).to.equal(null);
      expect(this.res.statusCode).to.equal(500);
      expect(this.body).to.equal('error');
    });

    describe('when requested again', function () {
      httpUtils.save('http://localhost:1338/');

      it('has the same status code', function () {
        expect(this.res.statusCode).to.equal(500);
      });

      it('does not double request', function () {
        expect(this.requests[1337]).to.have.property('length', 1);
      });
    });
  });
});

describe('A server that echoes method that is being proxied', function () {
  serverUtils.run(1337, function (req, res) {
    express.urlencoded()(req, res, function (err) {
      if (err) { throw err; }
      res.send({
        method: req.method,
        body: req.body
      });
    });
  });
  serverUtils.runEightServer(1338, {
    fixtureDir: __dirname + '/actual-files/method',
    url: 'http://localhost:1337'
  });

  describe('when requested via POST', function () {
    httpUtils.save({
      method: 'POST',
      url: 'http://localhost:1338/',
      form: {
        hello: 'world'
      }
    });

    it('replies with POST', function () {
      expect(this.err).to.equal(null);
      expect(this.res.statusCode).to.equal(200);
      expect(JSON.parse(this.body)).to.deep.equal({
        method: 'POST',
        body: {
          hello: 'world'
        }
      });
    });

    describe('when requested again', function () {
      httpUtils.save({
        method: 'POST',
        url: 'http://localhost:1338/',
        form: {
          hello: 'world'
        }
      });

      it('does not double request', function () {
        expect(this.requests[1337]).to.have.property('length', 1);
      });
    });
  });
});

describe('A server that echoes HTTP headers', function () {
  serverUtils.run(1337, function (req, res) {
    res.send(req.headers);
  });
  serverUtils.runEightServer(1338, {
    fixtureDir: __dirname + '/actual-files/headers',
    url: 'http://localhost:1337'
  });

  describe('when requested with a special header', function () {
    httpUtils.save({
      headers: {
        'x-hai': 'world'
      },
      url: 'http://localhost:1338/'
    });

    it('replies with a our header', function () {
      expect(this.err).to.equal(null);
      expect(this.res.statusCode).to.equal(200);
      expect(JSON.parse(this.body)).to.have.property('x-hai', 'world');
    });

    describe('when requested again', function () {
      httpUtils.save({
        headers: {
          'x-hai': 'world'
        },
        url: 'http://localhost:1338/'
      });

      it('has the same header', function () {
        expect(JSON.parse(this.body)).to.have.property('x-hai', 'world');
      });

      it('does not double request', function () {
        expect(this.requests[1337]).to.have.property('length', 1);
      });
    });

    describe('and a request with a different set of headers', function () {
      httpUtils.save({
        headers: {
          'x-goodbye': 'moon'
        },
        url: 'http://localhost:1338/'
      });

      it('receives a different set of parameters', function () {
        expect(this.err).to.equal(null);
        expect(JSON.parse(this.body)).to.have.property('x-goodbye', 'moon');
      });
    });

  });
});

describe('An `eight-track` loading from a saved file', function () {
  serverUtils.run(1337, function (req, res) {
    // DEV: Same length as 'oh hai' for easier development =P
    res.send('NOOOOO');
  });
  serverUtils.run(1338, eightTrack({
    fixtureDir: __dirname + '/test-files/saved',
    url: 'http://localhost:1337'
  }));

  describe('a request to a canned response', function () {
    httpUtils.save({
      url: 'http://localhost:1338/'
    });

    it('uses the saved response', function () {
      expect(this.err).to.equal(null);
      expect(this.body).to.equal('oh hai');
    });
  });
});