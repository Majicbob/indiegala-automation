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
const Nightmare   = require('nightmare');
require('nightmare-iframe-manager')(Nightmare);
const async       = require('async');
const Promise     = require('promise')
const nconf       = require('nconf');
const sqlite3     = require('sqlite3').verbose();
const db          = new sqlite3.Database('db.sqlite3');


nconf.file('config.json');


// log in
const chromeUA    = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko)' +
                    ' Chrome/51.0.2704.103 Safari/537.36';

const nightmareConfig = {
    show: true,
    fullscreen: false,
    width: 1024,
    height: 800,
    // webPreferences: { webSecurity: false }
};
let nmInst = Nightmare(nightmareConfig);
nmInst.useragent(chromeUA);

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
        // .click('body > div.rc-anchor.rc-anchor-normal.rc-anchor-light > div.rc-anchor-normal-footer > div.rc-anchor-pt > a:nth-child(1)') /* works */
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

        /**
        auth="eyJfdXNlciI6WzQ2Njg4MjcyMzIzNzA2ODgsMSwiTUNnNWlmdTFtWjdDNDBJMjdyVGRaciIsMTQ3MTIzMTE0NSwxNDcxMjMxMTQ1XX0\075|1471231151|150cd0264b14eadce3e7620ef589baaf604eb8e1"

        */
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
        'ORDER BY endDate ASC ';

    return new Promise((fulfill, reject) => {
        db.all(sql, (err, rows) => {
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
    async.eachSeries(giveaways, (giveaways, next) => {
        nmInst
            .goto(giveaways.url)
            .wait()
            .click('.giv-coupon')
            .wait()
            .then( () => next() )
            .catch((err) => {
                next('Nightmare Error entering giveaway: ' + err);

                // update db
            });
    }, (err) => {
        if (err) {
            console.error(err);
        }
        // all giveaways entered
    });
}


prioritizeGiveaways()
.then((giveaways) => enterGiveaways(giveaways));