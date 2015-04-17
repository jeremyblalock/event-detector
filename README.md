# leadgenius-challenge
Enter the URL of an events calendar page, and get a nicely-formatted list of events, in list or grid format

## Running locally

You do not need a server to view the site, since the only AJAX requests are made through JSONP, which uses a script include tag. Simply open `index.html` in your browser.

**Note:** If you open the app by simply opening the HTML file, without it being served from a webserver, your will see a flash of the un-rendered Angular template. To see the proper functionality, start up a simple webserver and view it.

## Mobile readiness

The app should be fully responsive and mobile-friendly, down to about ~300px screen size.

## Known Issues

The following known issues exist in the app currently. I will work on fixing them as soon as I can.

1. Eventbrite event times are off (displaying midnight for everything). But the dates should be correct.
2. Once in a while the proxy server (used to fetch the data) lags, so you may have to refresh and try again if this happens.