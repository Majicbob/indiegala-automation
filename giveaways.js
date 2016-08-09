/**
 * Automation of IndieGala Giveaways
 *
 * Overview:
 * Parse giveaways and collect database of games with info from Steam
 * Allow configuration of priorities for games, based on name, genre, etc
 * Use Nightmare to login and enter the Giveaways (JS is required for clicking on the ticket)
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-08 11:22
 */

'use strict';

const Nightmare = require('nightmare');
const request    = require('request');
const cheerio    = require('cheerio');
const sqlite3    = require('sqlite3').verbose();

const baseUrl     = 'https://www.indiegala.com';
const giveawayUrl = baseUrl + '/giveaways';

const chromeUA    = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';
// const db          = new sqlite3.Database('db.sqlite3');

const nightmareConfig = {
    show: true,
    fullscreen: false
};

// setup sqlite3 db



// parse games
const nextSelector = '.page-nav > div:nth-child(7) > a';
let nmInst = Nightmare(nightmareConfig);

function parseGameLinks() {
    var links = document.querySelectorAll('.ticket-info-cont h2 a');

    return Array.prototype.map.call(links, function (e) {
        return e.getAttribute('href');
    });
}

nmInst
    .goto(giveawayUrl)
    .wait('.giveaways-main-page')
    .evaluate(function() {
        var links = document.querySelectorAll('.ticket-info-cont h2 a');

        return Array.prototype.map.call(links, function (e) {
            return e.getAttribute('href');
        });
    })
    .then((links) => {
        console.log(links);
    })
    .then(() => {
        return nmInst
            .click(nextSelector)
            .evaluate(parseGameLinks)
    })
    .then((links) => {
        console.log('Page 2 Links');
        console.log(links);
    })
    .catch((err) => console.error('Error on main page: ' + error));

