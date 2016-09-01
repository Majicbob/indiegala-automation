/**
 * Automation of IndieGala Giveaways
 *
 * Overview:
 * Parse giveaways and collect database of games with info from Steam
 * Allow configuration of priorities for games, based on name, genre, etc
 * Use Nightmare to login and enter the Giveaways (JS is required for clicking on the ticket) *
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-09-01 03:02
 */

'use strict';


const ig       = require('./indiegala');
const steam    = require('./steam');
const priority = require('./enter-giveaways');


// steam.updateOwnedGames();

ig.parseGiveawaysList()
    .then(steam.scrape);

priority
    .prioritizeGiveaways()
    .then( ig.enterGiveaways )
    .then( ig.checkWins )
    .then( ig.close )
    .catch( (err) => {
        console.error(err);
        process.exit();
    });
