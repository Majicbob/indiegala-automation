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
const Nightmare   = require('nightmare');
const async       = require('async');
const request     = require('request');
const cheerio     = require('cheerio');
const model       = require('./model');


const selectSql = 'SELECT DISTINCT steamUrl, steamId ' +
    'FROM giveaways WHERE steamId IS NOT NULL ' +
    'AND steamId NOT IN (SELECT DISTINCT steamId FROM games) ';

model.db.each(selectSql, (err, row) => {

    request(row.steamUrl, (err, resp, body) => {
        if (err) {
            console.error('Error loading Steam url: \n' + err);
        }

        console.log(row.steamUrl);

        const $ = cheerio.load(body);
        const game = {
            steamId:     row.steamId,
            reviewText:  $('.game_review_summary').first().text(),
            reviewStats: $('.user_reviews_summary_row').attr('data-store-tooltip'),
            genre:       $('div.breadcrumbs > div.blockbg > a:nth-child(2)').text(),
            metascore:   $('#game_area_metascore > span:nth-child(1)').text(),
            tag1:        $('.popular_tags > a:nth-child(1)').text().trim(),
            tag2:        $('.popular_tags > a:nth-child(2)').text().trim(),
            tag3:        $('.popular_tags > a:nth-child(3)').text().trim(),
            shortDesc:   $('.game_description_snippet').text().trim()

        };

        model.insertGame(game);

    });

}, (err, numRows) => {
    console.log('Num Rows: ' + numRows);
    if (err) {
        console.error('Error: \n' + err);
    }
    // all rows processed
    // insertGame.finalize(() => {
        // db.close();
    // })
} );