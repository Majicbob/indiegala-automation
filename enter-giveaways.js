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
        .goto('https://www.indiegala.com/giveaways')
        .exists('.site-menu .login-btn')
        .then((loginExists) => {
            if (loginExists) {
                // user is not logged in
                let cookies = fs.readFileSync(nconf.get('cookieFile'));
                cookies = JSON.parse(cookies);

                return nmInst.cookies.set(cookies);
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
        'AND reviewText like "%Positive" ' +
        'ORDER BY endDate ASC ' +
        'LIMIT 20';

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
 * Enter the supplied giveaways and mark them as such
 *
 */
function enterGiveaways(giveaways) {
    async.eachSeries(giveaways, (giveaway, next) => {
        nmInst
            .goto(giveaway.url)
            .wait()
            .click('.giv-coupon')
            .wait()
            // .title()
            .evaluate(() => {
                return {
                    title: document.title,
                    coins: document.querySelector('.coins-amount').title
                };
            })
            .then( (data) => {
                console.log(data);
                model.markAsEntered(giveaway.id);
                next();
            })
            .catch((err) => {
                console.error(err);
                next('Nightmare Error entering giveaway: ' + err.message);
            });
    }, (err) => {
        if (err) {
            console.error(err);
        }
        // all giveaways entered
        console.log('All Giveaways Entered');
    });
}


// login();
// cookiesTest();

prioritizeGiveaways().then( (giveaways) => enterGiveaways(giveaways) );
