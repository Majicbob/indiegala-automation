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

const request    = require('request');
const cheerio    = require('cheerio');
const sqlite3    = require('sqlite3').verbose();

const baseUrl     = 'https://www.indiegala.com';
const giveawayUrl = baseUrl + '/giveaways';
// const db          = new sqlite3.Database('db.sqlite3');


// setup sqlite3 db



// parse games
let options = {
    'url': giveawayUrl,
    'jar': true,
    'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36'
    }
}
request(options, (err, resp, body) => {
    if (err) {
        console.error('Error loading main page ' + giveawayUrl + '\n ' + err);
        return;
    }
    const $ = cheerio.load(body);
    console.log(resp.statusCode);
    console.log(body);
    let games = [];
    $('.ticket-info-cont h2 a').each((i, elem) => {
        let url = $(elem).attr('href');
        console.log(url);
        if (-1 === games.indexOf(url)) {
            games.push(url);
        }
    });

    console.log(games);
});