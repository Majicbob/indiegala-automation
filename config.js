/**
 * Config module, load config data from file and potentially other sources.
 *
 * Good article on using nconf for config with a variety of sources
 * http://www.codedependant.net/2015/01/31/production-ready-node-configuration/
 *
 * @todo Should a nconf object by exported or a populated config object?
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-17 20:11
 */

'use strict';

const nconf = require('nconf');

module.exports = nconf
    .argv()
    .env({separator:'__'})
    .file('config.json');