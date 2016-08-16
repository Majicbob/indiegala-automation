/**
 * Model module, interface to database. Handle creating tables, queries, etc.
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-16 01:05
 */

'use strict';
const sqlite3     = require('sqlite3').verbose();
const db          = new sqlite3.Database('db.sqlite3');

// setup tables


// setup queries
const markAsEntered = db.prepare('UPDATE giveaways SET entered = 1 WHERE id = ?');

module.exports = {

    markAsEntered: (giveawayId) => {
        markAsEntered.run(giveawayId, (updateError) => {
            if (updateError) {
                console.error(updateError);
            }
            else {
                console.log('Updated ' + giveawayId);
            }
        });
    }
}