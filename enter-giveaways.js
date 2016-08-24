/**
 * Automation of Entering IndieGala Giveaways
 *
 * Overview:
 * Login
 * @todo Priorities & Config Options
 * Enter Giveaways
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-13 17:22
 */

'use strict';

// modules
const nconf       = require('./config');
const model       = require('./model');
const Nightmare   = require('nightmare');
require('nightmare-iframe-manager')(Nightmare);
const async       = require('async');
const Promise     = require('promise');
const fs          = require('fs');
const Q           = require('q');

// IndieGala Constants
const IG_NOT_AUTHORIZED = 'You are not authorized access for this giveaway.';

// setup Nightmare instance
const nmConfig  = nconf.get('nightmare');
nmConfig.show   = true; // show for manual login
const nmInst    = Nightmare(nmConfig);
nmInst.useragent(nmConfig.userAgent);

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
 * Read options/preferences (to be implemented) and prioritize games accordingly
 *
 * @promise {String[]}  Prioritized array of giveaway URLs, highest priority in 0 index
 */
function prioritizeGiveaways() {

    // games with positive in the reviewText sorted by endDate
    const now = Math.floor(new Date() / 1000);
    const sql =
        'SELECT id FROM giveaways ga ' +
        'INNER JOIN games g on ga.steamId = g.steamId ' +
        'WHERE entered = 0 AND endDate > ' + now + ' ' +
        'AND ( ' +
        '    reviewText like "%Positive" ' +
        '    OR metascore >= 70 ' +
        ') ' +
        'ORDER BY endDate ASC ' +
        'LIMIT 5';

    return new Promise((fulfill, reject) => {
        model.db.all(sql, (err, rows) => {
            if (err) {
                console.error(err);
                reject(err);
            }
            const giveaways = rows.map((obj) => {
                return {
                    url: 'https://www.indiegala.com/giveaways/detail/' + obj.id,
                    id: obj.id
                };
            });

            fulfill(giveaways);
        });
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
        console.log('Level Not High Enough');
        next();

        return false;
    }

    return true;
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

/**
 * Enter the supplied giveaways and mark them as such
 *
 * @returns {Promise}
 */
function enterGiveaways(giveaways) {
    console.log('Giveaways In Queue: ' + giveaways.length);

    const deferred = Q.defer();

    async.eachSeries(giveaways, (giveaway, next) => {
        nmInst
            .goto(giveaway.url)
            .wait(rndDelay())
            .click('.giv-coupon')
            .wait(rndDelay())
            .evaluate(getDataFromGiveaway)
            .then( (data) => {
                // console.log(data);
                if (shouldRetryGiveaway(giveaway, data, next)) {
                    console.log('Could not dectect succsessful entery, retry');
                    return nmInst
                        .refresh()
                        .click('.giv-coupon')
                        .wait(rndDelay())
                        .evaluate(getDataFromGiveaway)
                        .then( (data) => {
                            shouldRetryGiveaway(giveaway, data, next);
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
            deferred.reject(err);
        }
        // all giveaways entered
        console.log('All Giveaways Entered');
        deferred.resolve();
    });

    return deferred.promise;
}

/**
 * Go to profile page and check any completed ones for wins
 */
function checkWins() {
    console.log('Check for Wins');
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
            console.log('Found Buttons: ' + buttonCount);
            async.timesSeries(buttonCount, (n, next) => {
                nmInst
                    .click('.btn-check-if-won')
                    .wait(rndDelay(4000, 6000)) // without this wait it tries to click the same button
                    .then(() => {
                        next();
                    });
            });
        })
        .then(() => {
            console.log('Check Wins Complete');
        })
        .catch((err) => {
            console.error(err);
        });
}



// login();
// cookiesTest();

prioritizeGiveaways()
    .then( enterGiveaways )
    .then( checkWins )
    .catch( (err) => {
        console.error(err);
    });
