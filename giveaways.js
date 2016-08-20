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
const nconf       = require('./config');
const Nightmare   = require('nightmare');
const async       = require('async');
const request     = require('request');
const cheerio     = require('cheerio');
const model       = require('./model');

// config / globals
const baseUrl     = nconf.get('indiegala:baseUrl');


/**
 * The number of giveaway listing pages to parse. There are 12 giveaways per page.
 * @type {number}
 */
const pagesToParse = nconf.get('indiegala:pagesToParse');


/**
 * Process giveaway pages using Request/Cheerio to grab data and store in DB.
 * @param {string[]} links  Relative links to individual giveaways
 */
function processGiveawayPages(links) {

    async.each(links, (link, next) => {
        const giveawayUrl = baseUrl + link;
        request(giveawayUrl, (err, resp, body) => {
            if (err) {
                console.error('Error loading giveaway url: \n' + err);
                next(err);
                return;
            }

            const $ = cheerio.load(body);

            // get end date from thier JS and convert to unix ts
            let endTime    = -1;
            const found    = body.match(/new Date\(Date\.UTC.*;/g);
            if (null !== found) {
                let getEndTime = new Function('return ' + found[0]);
                endTime        = Math.round(getEndTime().getTime() / 1000);
            }

            // get the steam url and remove trailing slashes
            let steamUrl = $('.ticket-info-cont .steam-link').attr('href');
            if (steamUrl.endsWith('/')) {
                steamUrl = steamUrl.slice(0, -1);
            }

            const steamId = steamUrl.substring(steamUrl.lastIndexOf('/') + 1);

            const giveaway = {
                'id':       $('.ticket-right .relative').attr('rel'),
                'name':     $('.ticket-info-cont h2').text(),
                'price':    $('.ticket-left .ticket-price strong').text(),
                'endDate':  endTime,
                'level':    $('.type-level-cont').text().trim(),
                steamUrl,
                steamId
            };

            model.insertGiveaway(giveaway);

            next();
        });
    }, (err) => {
        // all finished
        if (err) {
            console.error(err);
        }

        /** @todo Find out why this doesn't close the Nightmare instance. It will close it
                  when this is called for each page instead of all combined pages. */
        // nmInst.end();
    });
}

/**
 * Scrape the links to individual game links. This is run in Nightmare/Electron browser context.
 *
 * @return {string[]} Array of URLs to individual giveaway pages
 */
function parseGameLinks() {
    // eslint-disable-next-line no-var, no-undef
    var links = document.querySelectorAll('.ticket-info-cont h2 a');

    return Array.prototype.map.call(links, function(e) {
        return e.getAttribute('href');
    });
}


// Setup Nightmare and start processing pages
const nmInst = Nightmare(nconf.get('nightmare'));
nmInst.useragent(nconf.get('nightmare:userAgent'));

async.timesSeries(pagesToParse + 1, (n, next) => {
    // timesSeries is zero-based, the links are 1 based so skip
    if (0 === n) {
        next();
    }
    else {
        const level = nconf.get('indiegala:level');
        const thisPage = baseUrl + '/giveaways/' + n + '/expiry/asc/level/' + level;
        nmInst
            .goto(thisPage)
            .wait('.giveaways-main-page')
            .evaluate(parseGameLinks)
            .then((links) => {
                // console.log(links);
                processGiveawayPages(links);
                console.log('Finished ' + thisPage);
                next(null, links);
            })
            .catch((err) => {
                console.error('Nightmare error loading giveaway list page: ');
                console.error(err);
                next(err, links);
            });
    }

}, (err, allLinks) => {
    if (err) {
        console.error('All Finished Error: ' + err);
        return;
    }

    // const flatLinks = [].concat.apply([], allLinks);
    // processGiveawayPages(flatLinks);

    setTimeout(() => {
        console.log('Call Process.exit');
        nmInst.end();
        process.exit();
    }, 3000);
});



