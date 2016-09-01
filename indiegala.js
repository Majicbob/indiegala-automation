/**
 * IndieGala Module - Interface with IG using Nightmare or Reuest
 *
 * Some parts of their site require using Nightmare and others you can get
 * away with just Request. So far the giveaway list pages requires JS but
 * the individual detail pages do not.
 *
 * Overview:
 * - Handle parsings the giveaway listings pages to get individual giveaway links
 * - Parse individual giveaway pages for details
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
const fs          = require('fs');
const Q           = require('q');
const colors      = require('colors');

// config / globals
const baseUrl     = nconf.get('indiegala:baseUrl');

// IndieGala Constants
const IG_NOT_AUTHORIZED   = 'You are not authorized access for this giveaway.';
const IG_NOT_ENOUGH_COINS = 'Insufficient Indiegala Coins. Please choose a cheaper giveaway.';

/**
 * The number of giveaway listing pages to parse. There are 12 giveaways per page.
 *
 * @type {number}
 */
const pagesToParse = nconf.get('indiegala:pagesToParse');


// setup Nightmare instance
// require('nightmare-iframe-manager')(Nightmare);
const nmConfig  = nconf.get('nightmare');
nmConfig.show   = true; // show for manual login
const nmInst    = Nightmare(nmConfig);
nmInst.useragent(nmConfig.userAgent);


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
    });
}


/////////////////////// Electron Context Functions ////////////////////

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

/**
 * Returns data about the attempted giveaway. This is run in Nightmare/Electron browser context.
 *
 * @return {Object}
 */
function getDataFromGiveaway() {
    return {
        entered: $('.giv-coupon').length === 0,
        title: document.title,
        coins: document.querySelector('.coins-amount').title,
        error: $('.warning-cover:visible span').text()
    };
}

////////////////////////////////////////////////////////////////////


function parseGiveawaysList() {
    const deferred = Q.defer();
    // Setup local Nightmare and start processing pages
    const nmLocal = Nightmare(nconf.get('nightmare'));
    nmLocal.useragent(nconf.get('nightmare:userAgent'));

    async.timesSeries(pagesToParse + 1, (n, next) => {
        // timesSeries is zero-based, the links are 1 based so skip
        if (0 === n) {
            next();
        }
        else {
            const level = nconf.get('indiegala:level');
            const thisPage = baseUrl + '/giveaways/' + n + '/expiry/asc/level/' + level;
            nmLocal
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
                    console.error(colors.red(err));
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
            // console.log('Call Process.exit');
            close(nmLocal);
            deferred.resolve();
            // process.exit();
        }, 3000);
    });

    return deferred.promise;
}


/**
 * Login - having issues with the captcha
 * just logged in using the electron window and the cookies presist
 */
function login() {
    nmInst
        .goto('https://www.indiegala.com')
        .wait('.login-btn')
        .click('.login-btn')
        .wait('#login_popup') // wait for login popup to open
        .type('#popuppassword', nconf.get('indiegala:pass'))
        .type('#popupemail', nconf.get('indiegala:user'))
        .wait()
        .enterIFrame('#login_popup iframe')
        // .click('div.rc-anchor-normal-footer > div.rc-anchor-pt > a:nth-child(1)') /* works */
        // .evaluate(() => {
            // return document.getElementById('recaptcha-anchor').click();
        // })
        // .title()

        // .wait('.recaptcha-checkbox')
        .click('.rc-anchor-center-item')
        .click('.recaptcha-checkbox')

        .exitIFrame()
        .wait('.recaptcha-checkbox-checkmark')

        .then(() => console.log('nm then'))
        .catch((err) => {
            console.log(err);
        });
}


/**
 * Cookies testing function
 *
 * Clearing cookies by itself doesn't seem to log out within a single NM instance.
 * This is test code that doesn't appear to work, seems like IG is also doing some server-side
 * auth managment as well. Might come back to it at some point so I'll leave it in for now.
 *
 * @deprecated
 */
function cookiesTest() {
    nmInst
        // .cookies.clear()
        .goto('https://www.indiegala.com')
        .wait()
        // .goto('https://www.indiegala.com/giveaways')
        .exists('.site-menu .login-btn')
        .then((loginExists) => {
            if (loginExists) {
                // user is not logged in
                let cookies = fs.readFileSync(nconf.get('cookieFile'));
                cookies = JSON.parse(cookies);

                // return nmInst.cookies.set(cookies);
            }
            else {
                // user is logged in, save cookies
                return nmInst
                    .cookies.get()
                    .then((cookies) => {
                        // console.log(cookies);
                        const cookieJson = JSON.stringify(cookies);
                        fs.writeFile(nconf.get('cookieFile'), cookieJson, (err) => {
                            if (err) {
                                return console.error(err);
                            }

                            console.log('Cookies Saved');
                        });
                    });
            }
        })
        .then(() => {
            nmInst
                .goto('https://www.indiegala.com/giveaways');
        })
        .catch((err) => {
            console.error(err);
        });
}

/**
 * Insert a random delay, between configurable milliseconds using nconf for defaults
 *
 * IG will log you out without this (1 to 3 seconds seems to be the min)
 */
function rndDelay(low, high) {
    low  = low  || nconf.get('delayMs:low');
    high = high || nconf.get('delayMs:high');

    return Math.floor(Math.random() * (high - low + 1) + low);
}

//////////////////// Enter Giveaway functions ////////////////



/**
 * Next item callback for async.each style
 *
 * @see {@link http://caolan.github.io/async/docs.html#.each | async.each Docs}
 * @callback asyncNextItem
 * @param {(string|Object)} [error]
 */

/**
 *
 * @param {Object} giveaway - Giveaway obj with url and id
 * @param {Object} data - Results obj returned from {@link getDataFromGiveaway}
 * @param {asyncNextItem} next - Callback to continue to next item
 * @return {bool}
 */
function shouldRetryGiveaway(giveaway, data, next) {
    console.log(data.coins + '\t' + data.title);

    if (data.entered) {
        model.markAsEntered(giveaway.id);
        next();

        return false;
    }

    if (data.coins === '0 Indiegala Coins') {
        next('No More Coins');

        return false;
    }

    if (data.error === IG_NOT_AUTHORIZED) {
        console.log('--- Level Not High Enough');
        next();

        return false;
    }

    if (data.error === IG_NOT_ENOUGH_COINS) {
        console.log('--- Not Enough Coins');
        next();

        return false;
    }


    return true;
}



/**
 * For Nightmare.use() - goes to the url, clicks enter and
 * runs {@link getDataFromGiveaway} in the Electron context.
 */
function gotoAndClickTicket(url) {
    return (nightmare) => {
        nightmare
            .goto(url)
            .wait(rndDelay())
            .click('.giv-coupon')
            .wait(rndDelay())
            .evaluate(getDataFromGiveaway);
    }
}

/**
 * Enter the supplied giveaways and mark them as such
 *
 * @returns {Promise}
 */
function enterGiveaways(giveaways) {
    console.log(colors.green('Giveaways In Queue: ' + giveaways.length));

    const deferred = Q.defer();

    async.eachSeries(giveaways, (giveaway, next) => {
        nmInst
            .use(gotoAndClickTicket(giveaway.url))
            .then( (data) => {
                // console.log(data);
                if (shouldRetryGiveaway(giveaway, data, next)) {
                    console.log('Could not dectect succsessful entery, retry'.yellow);
                    return nmInst
                        .use(gotoAndClickTicket(giveaway.url))
                        .then( (data) => {
                            if (shouldRetryGiveaway(giveaway, data, next)) {
                                next();
                            }
                        });
                }
            })
            .catch((err) => {
                if (err === 'Unable to find element by selector: .giv-coupon') {
                    model.markAsEntered(giveaway.id);
                    next();
                }
                else {
                    console.error(err);
                    next('Nightmare Error entering giveaway: ' + err.message);
                }
            });
    }, (err) => {
        if (err) {
            console.error(err);
            // deferred.reject(err);
        }
        // all giveaways entered
        console.log('All Giveaways Entered');
        deferred.resolve();
    });

    return deferred.promise;
}

/**
 * Clicks all the 'Check if you won!' buttons
 */
function clickAllCheckForWinButtons(buttonCount, deferred) {
    console.log('Found Buttons: ' + buttonCount);

    async.timesSeries(buttonCount, (n, next) => {
        nmInst
            .click('.btn-check-if-won')
            // without this wait it tries to click the same button
            .wait(rndDelay(4000, 6000))
            .then(() => {
                next();
            });
    }, err => {
        if (err) {
            console.error(err);
            deferred.reject(err);
        }
        // all giveaways entered
        console.log('All Completed Giveaways Checked');
        deferred.resolve();
    });
}

/**
 * Go to profile page and check any completed ones for wins
 */
function checkWins() {
    console.log('Check for Wins');
    const deferred = Q.defer();

    nmInst
        .goto('https://www.indiegala.com/profile')
        .wait('#open-giveaways-library')
        .click('#open-giveaways-library')
        .click('.giveaway-completed .open-library')
        .wait(rndDelay(4000, 6000))
        .evaluate(() => {
            return document.querySelectorAll('.btn-check-if-won').length;
        })
        .then((buttonCount) => {
            clickAllCheckForWinButtons(buttonCount, deferred);
        })
        .catch((err) => {
            console.error(err);
        });

    return deferred.promise;
}


/**
 * End the Nightmare/Electron session
 */
function close(aNightmareInst) {
    aNightmareInst = aNightmareInst || nmInst;
    aNightmareInst
        .goto(baseUrl)
        .end()
        .catch((err) => {
            console.error(err);
        });
}

module.exports = {
    login,
    checkWins,
    enterGiveaways,
    parseGiveawaysList,
    close
};
