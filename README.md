# IndieGala Automation

>**Status:** <br/>
- Steam API has been added to the steam module which now has a function to populate a table of games owned in the database. 
- Giveaway + Steam data scraping is working and storing to a sqlite db. 
- Giveway entery automation is working and will check completed giveaways for wins.
- Login has to be done with a visible Electron window due to the captcha. After that login is saved, testing how long it will remain vaild with interaction.

Now need to finish the module code and call from an index or server file, add some tests and add a folder structure. Then all the main parts are working and I'll move on to the options and status/config page.
 
## Usage 

## Overview

This project automates the entry of IndieGala Giveaways with the goal of being able to define behavior 
such as preference for specific games, genres, or Steam ratings. Some pages require using Nightmare. 
The giveaway listing pages won't load with Request and the Take Part on individual giveaways requires JS.

When complete it will consist of several parts:

### Giveaway Scraper
This goes to each giveaway listing page, collects the individual giveaway links and loads those pages. 
The information about the giveaway is scraped and inserted into a sqlite database. 

### Steam Scraper
This will process the giveaway table. For each unique Steam link it will load that page and collect 
some additional data to be used for the options. Initially this will include the short description, 
overall user review status, popular tags, and metacritic score. This data will be stored in another sqlite table.

### Giveaway Entry 
This part will log in to the user account and automate the entry to specific giveaways based of the preferences 
defined in the config. 

#### Preferences
I'm still thinking over the ways the entry behavior can be customized. There are some settings that can be toggled that will change the where statment of the query. Also chose and/or combine some predefined queries. For more advanced add the ability to set a custom function or query for prioritizeGiveaways, with decent documentation that shouldn't be difficult. 
Some potential toggles and queries include: 
- Enter as many giveaways as possible - This would prioritize low cost giveaways with few participants. 
- Specific games 
- Genre - Based on Steam category and/or popular user tags.
- Popular - Steam user reviews and/or metacritic score.

## Future Potential Options & Features
- Load user's Steam profile and grab library (scraping or API if possible). This would allow filtering games already owned if desired as well as analyzing that and prioritizing similar games. 
- Web UI for status and config 

