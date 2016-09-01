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


/**
 * Use request/cheerio to scrape Steam data for the given game and insert to model
 *
 * @param {Object} game - Obj with steamUrl, steamId
 */
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

        model.insertGame(gameData);
    });
}

/**
 * Async run {@link scrapeGame} for every game given
 *
 * @param {Object[]} games - Array of objs with steamUrl and steamId to scrape
 * @returns {Promise}
 */
function scrapeAllGames(games) {
    const deferred = Q.defer();

    async.each(games, (game, next) => {
        scrapeGame(game);
        next();
    }, () => {
        deferred.resolve();
    });

    return deferred.promise;
}

/**
 * Exported function to initiate scraping
 *
 * @returns {Promise}
 */
function scrape() {
    const deferred = Q.defer();

    model
        .getNewGamesToDetail()
        .then(scrapeAllGames)
        .then(deferred.resolve);

    return deferred.promise;
}

/**
 * Syncs the Steam library tied to the API key to the local datastore.
 *
 * @todo Add a time check to do a full run only so often or have the module do it
 *       based on a config file. Then add a force option for calling this extern.
 */
function updateOwnedGames() {
    const player = new SteamApi.Player(STEAM_API_KEY, STEAM_USER_ID);

    player.GetOwnedGames().done((games) => {
        games.forEach( (game) => {
            model.insertOwnedGame(game.appId);
        })
    });


}

module.exports = {
    scrape,
    updateOwnedGames
};
