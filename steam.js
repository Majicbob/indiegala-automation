/**
 * Steam Game Info Scraper
 *
 * Scrape some data from the Steam page as part of the IndieGala automation.
 * Get a list of distinct Steam URLs that aren't in the DB yet.
 * Load that page, grab the data, and store in the games table.
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-11 04:41
 */

'use strict';

// modules
const nconf       = require('./config');
const async       = require('async');
const cheerio     = require('cheerio');
const model       = require('./model');
const Promise     = require('promise');
const SteamApi    = require('steam-api');
const Q           = require('q');
let   request     = require('request');

// Steam Constants
const STEAM_API_KEY = nconf.get('steam:apiKey');
const STEAM_USER_ID = nconf.get('steam:userId64');

// set Steam cookies for age checking
const jar = request.jar();
jar.setCookie('birthtime=-1577905199', 'http://store.steampowered.com');
jar.setCookie('lastagecheckage=1-January-1920', 'http://store.steampowered.com');
request = request.defaults({jar});


function scrapeGame(game) {
    request(game.steamUrl, (err, resp, body) => {
        if (err) {
            console.error('Error loading Steam url: \n' + err);
        }

        console.log(game.steamUrl);

        if (body.includes('Please enter your birth date to continue')) {
            console.log('### Steam Age Check');
            console.log('### Check Cookies, this should not come up');
        }

        const $ = cheerio.load(body);

        const gameData = {
            steamId:     game.steamId,
            reviewText:  $('.game_review_summary').first().text(),
            reviewStats: $('.user_reviews_summary_row').attr('data-store-tooltip'),
            genre:       $('div.breadcrumbs > div.blockbg > a:nth-child(2)').text(),
            metascore:   $('#game_area_metascore > span:nth-child(1)').text(),
            tag1:        $('.popular_tags > a:nth-child(1)').text().trim(),
            tag2:        $('.popular_tags > a:nth-child(2)').text().trim(),
            tag3:        $('.popular_tags > a:nth-child(3)').text().trim(),
            shortDesc:   $('.game_description_snippet').text().trim()
        };

        // console.log(gameData);

        // model.insertGame(gameData);
    });
}

function scrapeAllGames(games) {
    console.log('scrapeAllGames()');
    return new Q.Promise((fulfill, reject) => {
        async.each(games, (game) => {
            scrapeGame(game);
        }, () => {
            fulfill();
        });
    });
}

/**
 * Exported function to initiate scraping
 *
 * @returns {Promise}
 */
function scrape() {
    console.log('scrape()');
    return new Q.Promise((fulfill, reject) => {
        model
            .getNewGamesToDetail()
            .then( (games) => scrapeAllGames(games) )
            .then( () => fulfill() );
            // .then( fulfill );
    });
}


function getMyOwnedGames() {
    const player = new SteamApi.Player(STEAM_API_KEY, STEAM_USER_ID);

    player.GetOwnedGames()
        .done(function(result){
            console.log(result);
        });

    // player.GetSteamLevel().done(function(result){
        // console.log(result);
    // });
}

module.exports = {
    scrape
};

scrape()
.then( (data) => { console.log('Scrape Done') } )
.done( () => console.log('Done'))
// .catch( (err) => {
    // console.error(err);
// });

// getMyOwnedGames();
