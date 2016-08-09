/**
 * Automation of IndieGala Giveaways
 *
 * Overview:
 * Parse giveaways and collect database of games with info from Steam
 * Allow configuration of priorities for games, based on name, genre, etc
 * Use Nightmare to login and enter the Giveaways (JS is required for clicking on the ticket)
 *
 * Main giveaway page requires JS but individual pages seem to work with just request
 *
 * Probably going to need to have 2 parts running, the parser and the runner
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-08 11:22
 */

'use strict';

const Nightmare = require('nightmare');
const async      = require('async');
const request    = require('request');
const cheerio    = require('cheerio');
const sqlite3    = require('sqlite3').verbose();

const baseUrl     = 'https://www.indiegala.com';
const giveawayUrl = baseUrl + '/giveaways';

const chromeUA    = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36';

const nightmareConfig = {
    show: true,
    fullscreen: false
};
let nmInst = Nightmare(nightmareConfig);

// setup sqlite3 db
const db          = new sqlite3.Database('db.sqlite3');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS `giveaways` ( `id` INTEGER, `name` INTEGER, `steam` TEXT, `price` NUMERIC, `timeLeft` TEXT, PRIMARY KEY(id) );");

});


// process giveaway pages /w request
function processGiveawayPages(links) {
    const insertGiveaway = db.prepare('INSERT INTO giveaways VALUES (?, ?, ?, ?, ?)');

    async.each(links, (link, next) => {
        let giveawayUrl = baseUrl + link;
        request(giveawayUrl, (err, resp, body) => {
            const $ = cheerio.load(body);

            let found = body.match(/new Date\(Date\.UTC.*;/g);
            let getEndDate = new Function('return ' + found[0]);

            let giveaway = {
                "id":       $('.ticket-right .relative').attr('rel'),
                "name":     $('.ticket-info-cont h2').text(),
                "steam":    $('.ticket-info-cont .steam-link').attr('href'),
                "price":    $('.ticket-left .ticket-price strong').text(),
                "endDate":  $('#minutes').html() + ':' + $('#seconds').text(),
                "level":    $('.type-level-cont').text().trim()
            };

            insertGiveaway.run(
                giveaway.id,
                giveaway.name,
                giveaway.steam,
                giveaway.price,
                giveaway.timeLeft,
                (err) => { }
            );

            // console.log(giveaway);
            next();

        });
    }, (err) => {
        // all finished
        console.log('Giveaway Links Processed');
        insertGiveaway.finalize();
        db.close();
    });
}


function parseGameLinks() {
    var links = document.querySelectorAll('.ticket-info-cont h2 a');

    return Array.prototype.map.call(links, function (e) {
        return e.getAttribute('href');
    });
}

// parse giveaway pages
const pagesToParse = 3;
async.timesSeries(pagesToParse, (n, next) => {
    console.log(n);
    // timesSeries is zero-based, the links are 1 based so skip
    if (0 === n) {
        next(null, []);
    }
    else {
        const thisPage = baseUrl + '/giveaways/' + n + '/expiry/asc/level/all';
        nmInst
            .goto(thisPage)
            .wait('.giveaways-main-page')
            .evaluate(parseGameLinks)
            .then((links) => {
                // console.log(links);
                console.log('Finished ' + thisPage);
                next(null, links);
            })
            .catch((err) => console.error('Error on main page: ' + error));
    }

}, (err, allLinks) => {
    if (err) {
        console.error(err);
        return;
    }
    // should have all links here

    let flatLinks = [].concat.apply([], allLinks);
    // console.log(flatLinks);

    processGiveawayPages(flatLinks);

    // can't close Nightmare?
    // nmInst = Nightmare(nightmareConfig);
    // nmInst.goto(baseUrl).end();
});



