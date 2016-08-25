/**
 * Model module, interface to database. Handle creating tables, queries, etc.
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-16 01:05
 */

'use strict';
const nconf       = require('./config');
const Q           = require('q');
const sqlite3     = require('sqlite3').verbose();
const db          = new sqlite3.Database(nconf.get('sqliteFile'));

sqlite3.verbose();
// setup tables
const createGamesTableSql = `
    CREATE TABLE IF NOT EXISTS games (
        steamId INTEGER,
        reviewText TEXT,
        reviewStats TEXT,
        genre TEXT,
        metascore INTEGER,
        tag1 TEXT,
        tag2 TEXT,
        tag3 TEXT,
        shortDesc TEXT,
        PRIMARY KEY(steamId)
    );
`;

const creatGiveawaysTableSql = `
    CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER,
        name TEXT,
        steamUrl TEXT,
        price NUMERIC,
        endDate INTEGER,
        steamId INTEGER,
        entered INTEGER DEFAULT 0,
        PRIMARY KEY(id)
    );
`;

const createGamesOwnedTableSql = `
    CREATE TABLE IF NOT EXISTS games_owned (
        steamId INTEGER,
        PRIMARY KEY(steamID)
    );
`;

// setup queries


const newGamesToDetailSql = `
    SELECT DISTINCT steamUrl, steamId
    FROM giveaways
    WHERE steamId IS NOT NULL
    AND steamId NOT IN (SELECT DISTINCT steamId FROM games)
`;

db.serialize();
db.run(createGamesTableSql);
db.run(creatGiveawaysTableSql);
db.run(createGamesOwnedTableSql);
db.parallelize();

// giveaways queries
const insertGiveaway = db.prepare(
    'INSERT INTO giveaways (id, name, steamUrl, price, endDate, steamId) ' +
    'VALUES (?, ?, ?, ?, ?, ?)');

const markAsEntered = db.prepare('UPDATE giveaways SET entered = 1 WHERE id = ?');

// games queries
const insertGame = db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

// games_owned queries
const insertOwnedGame = db.prepare('INSERT INTO games_owned VALUES (?)');


module.exports = {

    // direct interface to the db
    db,

    // set giveaways.entered = 1 for the provided id
    markAsEntered: (giveawayId) => {
        markAsEntered.run(giveawayId, (updateError) => {
            if (updateError) {
                console.error(updateError);
            }
            else {
                // console.log('Updated ' + giveawayId);
            }
        });
    },

    // insert new row to giveaways
    insertGiveaway: (giveaway) => {
        insertGiveaway.run(
            giveaway.id,
            giveaway.name,
            giveaway.steamUrl,
            giveaway.price,
            giveaway.endDate,
            giveaway.steamId,
            (insertErr) => {
                if (insertErr) {
                    // ignore PK insert errors
                    if (! insertErr.message.includes('UNIQUE constraint failed')) {
                        console.error(insertErr);
                    }
                }
            }
        );
    },

    // insert new row to games
    insertGame: (game) => {
        insertGame.run(
            game.steamId,
            game.reviewText,
            game.reviewStats,
            game.genre,
            game.metascore,
            game.tag1,
            game.tag2,
            game.tag3,
            game.shortDesc,
            (insertErr) => {
                if (insertErr) {
                    // ignore PK insert errors
                    if (! insertErr.message.includes('UNIQUE constraint failed')) {
                        console.error(insertErr);
                    }
                }
            }
        );
    },

    // insert new row to games
    insertOwnedGame: (steamId) => {
        insertOwnedGame.run(
            steamId,
            (insertErr) => {
                if (insertErr) {
                    // ignore PK insert errors
                    if (! insertErr.message.includes('UNIQUE constraint failed')) {
                        console.error(insertErr);
                    }
                }
            }
        );
    },

    // returns promise for array of objs with steamUrl and steamId
    getNewGamesToDetail: () => {
        return new Q.Promise((fulfill, reject) => {
            db.all(newGamesToDetailSql, (err, rows) => {
                if (err) {
                    console.error(err);
                    reject(err);
                }

                fulfill(rows);
            });
        });
    }
};
