/**
 * Automation of Entering IndieGala Giveaways
 *
 * Overview:
 * Login - Handled by the indiegala module
 * @todo Priorities & Config Options
 * Enter Giveaways - Pass an array of the urls to IG
 *
 * @author   John Tribolet <john@tribolet.info>
 * @created  2016-08-13 17:22
 */

'use strict';

const model   = require('./model');
const Q       = require('q');

/**
 * Read options/preferences (to be implemented) and prioritize games accordingly
 *
 * @promise {Object[]}
 * @return {Promise} Object[]  Obj with url and id, highest priority is 0 index
 */
function prioritizeGiveaways() {
    const deferred = Q.defer();

    // games with positive in the reviewText sorted by endDate
    const now = Math.floor(new Date() / 1000);
    const sql = `
        SELECT id FROM giveaways ga
        INNER JOIN games g on ga.steamId = g.steamId
        WHERE entered = 0 AND endDate > ${now}
        AND (
            reviewText like "%Positive"
            OR metascore >= 70
        )
        AND price <= 20
        AND name != "Particula"
        ORDER BY endDate ASC
        LIMIT 30;
    `;


    model.db.all(sql, (err, rows) => {
        if (err) {
            console.error(err);
            deferred.reject(err);
        }
        const giveaways = rows.map((obj) => {
            return {
                url: 'https://www.indiegala.com/giveaways/detail/' + obj.id,
                id: obj.id
            };
        });

        deferred.resolve(giveaways);
    });

    return deferred.promise;
}


module.exports = {
    prioritizeGiveaways
};
