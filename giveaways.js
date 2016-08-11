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

// modules
const Nightmare   = require('nightmare');
const async       = require('async');
const request     = require('request');
const cheerio     = require('cheerio');
const sqlite3     = require('sqlite3').verbose();

// config / globals
const baseUrl     = 'https://www.indiegala.com';

const chromeUA    = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko)' +
                    ' Chrome/51.0.2704.103 Safari/537.36';

const nightmareConfig = {
    show: true,
    fullscreen: false
};
let nmInst = Nightmare(nightmareConfig);
nmInst.useragent(chromeUA);

/**
 * The number of giveaway listing pages to parse. There are 12 giveaways per page.
 * @type {number}
 */
const pagesToParse = 20;

// setup sqlite3 db
const db          = new sqlite3.Database('db.sqlite3');

db.serialize(() => {
    db.run(
        'CREATE TABLE IF NOT EXISTS `giveaways` ( `id` INTEGER, `name` TEXT, ' +
        '`steam` TEXT, `price` NUMERIC, `endDate` INTEGER, PRIMARY KEY(id) );');

});


/**
 * Process giveaway pages using Request/Cheerio to grab data and store in DB.
 * @param {string[]} links  Relative links to individual giveaways
 */
function processGiveawayPages(links) {
    const insertGiveaway = db.prepare('INSERT INTO giveaways VALUES (?, ?, ?, ?, ?)');

    async.each(links, (link, next) => {
        const giveawayUrl = baseUrl + link;
        request(giveawayUrl, (err, resp, body) => {
            if (err) {
                console.error('Error loading giveaway url: \n' + err);
                next(err);
            }
            const $        = cheerio.load(body);

            // get end date from thier JS and convert to unix ts
            let endTime    = -1;
            let found      = body.match(/new Date\(Date\.UTC.*;/g);
            if (found.length) {
                let getEndTime = new Function('return ' + found[0]);
                endTime    = Math.round(getEndTime().getTime() / 1000);
            }

            let giveaway = {
                'id':       $('.ticket-right .relative').attr('rel'),
                'name':     $('.ticket-info-cont h2').text(),
                'steam':    $('.ticket-info-cont .steam-link').attr('href'),
                'price':    $('.ticket-left .ticket-price strong').text(),
                'endDate':  endTime,
                'level':    $('.type-level-cont').text().trim()
            };

            insertGiveaway.run(
                giveaway.id,
                giveaway.name,
                giveaway.steam,
                giveaway.price,
                giveaway.endDate,
                (insertErr) => {
                    if (insertErr) {
                        // ignore PK insert errors
                        if (! insertErr.message.includes('UNIQUE constraint failed')) {
                            console.error(insertErr);
                        }
                    }
                }
            );

            // console.log(giveaway);
            next();

        });
    }, (err) => {
        // all finished
        if (err) {
            console.error(err);
        }
        console.log('Giveaway Links Processed');

        // insertGiveaway.finalize();
        db.close();

        /** @todo Find out why this doesn't close the Nightmare instance. */
        nmInst.end();
    });
}

/**
 * Scrape the links to individual game links. This is run in Nightmare/Electron.
 */
function parseGameLinks() {
    // eslint-disable-next-line no-var, no-undef
    var links = document.querySelectorAll('.ticket-info-cont h2 a');

    return Array.prototype.map.call(links, function(e) {
        return e.getAttribute('href');
    });
}



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
                // processGiveawayPages(links);
                console.log('Finished ' + thisPage);
                next(null, links);
            })
            .catch((err) => console.error('Nightmare error loading giveaway list page: ' + err));
    }

}, (err, allLinks) => {
    if (err) {
        console.error(err);
        return;
    }

    const flatLinks = [].concat.apply([], allLinks);

    processGiveawayPages(flatLinks);

    // can't close Nightmare?
    // nmInst = Nightmare(nightmareConfig);
    // nmInst.goto(baseUrl).end();
});



