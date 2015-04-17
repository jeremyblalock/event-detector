////////////////////////////////////////////////////////////////////
//                                                                //
//  EventFetcher class                                            //
//  Loads event data from remove URLs.                            //
//                                                                //
//  Usage:                                                        //
//                                                                //
//    var fetcher = new EventFetcher;                             //
//    fetcher.fetch(url, successCallback, errorCallback);         //
//                                                                //
//  successCallback receives an array of events.                  //
//                                                                //
////////////////////////////////////////////////////////////////////

var EventFetcher = function() {

  // Constants, used for prioritization.
  var TIME_ELEMENT = 0,
      ABBR_ELEMENT = 1,
      TEXT_SEARCH = 2;

  ////////////////////////////////////////////////////
  //
  //  Selector definitions.
  //  Used inside of recursive explore function.
  //
  ////////////////////////////////////////////////////

  var dateSelectors = {};

  dateSelectors[TIME_ELEMENT] = function($el) {
    if ($el.get(0).tagName == 'TIME' && $el.attr('datetime')) {
      return new Date($el.attr('datetime'));
    }
  }

  dateSelectors[ABBR_ELEMENT] = function($el) {
    if ($el.get(0).tagName == 'ABBR' && $el.attr('title')) {
      return new Date($el.attr('title'));
    }
  }

  dateSelectors[TEXT_SEARCH] = function($el) {
    return new Date(stripNonAscii($el.text()));
  }

  ////////////////////////////////////////////////////////
  //
  //  Data cleaning.
  //
  ////////////////////////////////////////////////////////

  // Remove <SCRIPT> elements.
  function stripScripts(html) {
      html = html.replace(/<{1}script.*?<\/script.*?>/ig, ' ');
      return html;
  }

  // Remove <STYLE> elements.
  function stripStylesheets(html) {
      html = html.replace(/<style.*?<\/style.*?>/ig, ' ');
      return html;
  }

  // Remove <IFRAMR> elements.
  function stripIFrames(html) {
      html = html.replace(/<iframe.*?<\/iframe.*?>/ig, ' ');
      return html;
  }

  // Remove <IMG> elements.
  function stripImages(html) {
    html = html.replace(/<img.*?>/ig, ' ');
    return html;
  }

  // Remmove characters out of the ASCII range (0-127).
  function stripNonAscii(str) {
    return str.replace(/[^\x00-\x7F]/ig, ' ');
  }


  //////////////////////////////////////////////////////////////
  //
  //  Helper methods.
  //
  //////////////////////////////////////////////////////////////

  // Takes a jQuery element selection, and returns a CSS selector
  // representing this particular element. Includes the tag name,
  // and class names, in the format: TAGNAME.CLASSNAME.CLASSNAME.CLASSNAME
  function getPathItem(el) {
      var tagName = el.tagName;
      var classList = el.className.split(/\s+/),
          filteredKeyList = [tagName],
          i;

      for (i = 0; i < classList.length; i += 1) {
          if (classList[i] && !classList[i].match(/\d+/) && !classList[i].match(/(last)|(first)/)) {
              filteredKeyList.push(classList[i]);
          }
      }
      return filteredKeyList.join('.');
  }

  // Return a copy of ARRAY, with ELEMENT removed.
  function arrayRemove(array, element) {
    var index = array.indexOf(element);
    if (index > -1) {
      array.splice(index, 1);
    }
  }

  // Takes an array RESULTS of objects containing of a CSS path.
  // If the path is unique in the set, assign the parentPath attribute to PATH.
  function assignPathIfUnique(results, path, $fragment) {
    var pathCounts = {},
        i;

    for (i = 0; i < results.length; i += 1) {
      if (pathCounts[results[i].path] == null) pathCounts[results[i].path] = 0;
      pathCounts[results[i].path] += 1;
    }

    for (i = 0; i < results.length; i += 1) {
      if (pathCounts[results[i].path] == 1) {
        results[i].parentPath = path;
        results[i].$el = $fragment;
      }
    }
  }


  ////////////////////////////////////////////////////////////////
  //
  //  Core Functionality Methods.
  //
  ////////////////////////////////////////////////////////////////


  // Filter RESULTS array, and determine the most commonly-matched PATH.
  // Return all the results matching this PATH.
  function filterResults(results) {
    var pathCounts = {},
        i, path, maxCount = 0, bestPathMethod = 1/0, bestPath;

    for (i = 0; i < results.length; i += 1) {
      if (pathCounts[results[i].path] == null) pathCounts[results[i].path] = [];
      pathCounts[results[i].path].push(results[i]);
    }

    for (path in pathCounts) {
      if (pathCounts[path].length > maxCount || 
          (pathCounts[path].length == maxCount &&
           bestPath && pathCounts[path][0].method < pathCounts[bestPath][0].method)) {
        maxCount = pathCounts[path].length;
        bestPathMethod = pathCounts[path][0].method;
        bestPath = path;
      }
    }

    return pathCounts[bestPath];
  }

  // Get the [relative] link to the event, if possible.
  function getLink($el) {
    var $wrap = $('<div></div>');
    $wrap.append($el);
    return $wrap.find('a[href]').attr('href');
  }

  // Get the title of the event, or return 'No Title'.
  function getTitle($el) {
    var titleCandidates = [],
        titleClassNames = ['title', 'summary', 'description'],
        result, i;

    // First, Check for <h1>, <h2>, etc.
    for (i = 1; i <= 6; i += 1) {
      titleCandidates.push($el.find('h' + i).first().text());
    }

    // Check for popular classNames
    for (i = 0; i < titleClassNames.length; i += 1) {
      titleCandidates.push($el.find('.' + titleClassNames[i]).first().text());
      titleCandidates.push($el.find('[itemprop="' + titleClassNames[i] + '"]').text());
    }

    // Check for <a> elements...
    titleCandidates.push($el.find('a[href]').text());

    // Return best match
    for (i = 0; i < titleCandidates.length; i += 1) {
      if (titleCandidates[i]) {
        return titleCandidates[i];
      }
    }
    return "No Title";
  }

  // Set the TITLEs and URLs of RESULTS, inline.
  function setMetaInformation(results) {
    var i;
    for (i = 0; i < results.length; i += 1) {
      results[i].url = getLink(results[i].$el);
      results[i].title = getTitle(results[i].$el);
      results[i].date = results[i].value;
    }
  }

  // Recursive Explore method looks at each node in FRAGMENT recursively,
  // and tries to determine if it contains a valid date.
  // This method checks against a number of matchers, defined as dateSelectors.
  function recursiveExplore($fragment, methods, path, ignorePath) {
    var results = [],
        newMethods = methods.slice(0),
        newPath = path,
        i;

    // Leave out the root element's path, since we created it ourselves.
    if (!ignorePath) {
      newPath = newPath + (path && ' ') + getPathItem($fragment.get(0))
    }

    // Check each of the methods that haven't matched a parent.
    for (i = 0; i < methods.length; i += 1) {
      if (methods.indexOf(methods[i]) >= 0) {
        var date = dateSelectors[methods[i]]($fragment);
        if (date && +date > 0) {
          results.push({
            type: methods[i],
            path: newPath,
            value: date
          });
          arrayRemove(newMethods, methods[i]);
        }
      }
    }

    // Now look recursively at all the element's children.
    $fragment.children().each(function() {
      results = results.concat(recursiveExplore($(this), newMethods, newPath));
    });
    assignPathIfUnique(results, newPath, $fragment);
    return results;
  }


  // Launch recursive function to search through elements.
  function explore($dom) {
      var methods = [TIME_ELEMENT, ABBR_ELEMENT, TEXT_SEARCH],
          results = recursiveExplore($dom, methods, '', true);

      // Filter results, to get a consistent signature.
      results = filterResults(results);

      // Add titles to results.
      setMetaInformation(results);

      return results;
  }

  // Clean HTML input, and output a DOM fragment object.
  function getDOM(html) {
      var bodyTagPos = html.search(/<body/i),
          bodyStartPos = html.substring(bodyTagPos).search(/>/) + bodyTagPos + 1,
          bodyEndPos = html.search(/<\/body/i),
          bodyContent;

      if (bodyEndPos >= bodyStartPos) {
          bodyContent = html.substring(bodyStartPos, bodyEndPos);
          bodyContent = bodyContent.replace(/[\r\n]/g, ' ');
          // Remove unicode space characters.
          bodyContent = bodyContent.replace(/[^\x00-\x7F]/, ' ');
          bodyContent = bodyContent.replace(/\s+/g, ' ');

          bodyContent = stripScripts(bodyContent);
          bodyContent = stripStylesheets(bodyContent);
          bodyContent = stripIFrames(bodyContent);
          bodyContent = stripImages(bodyContent);
          return $('<div>' + bodyContent + '</div>').get(0);
      }
  }

  // Process HTML, and return RESULTS object.
  function processResults(html, callback) {
      var dom = getDOM(html),
          $dom = $(dom);
      if (dom != null) {
        return explore($dom);
      }
  }

  ///////////////////////////////////////////////////
  //
  //  Fetch URL contents.
  //
  ///////////////////////////////////////////////////

  function fetchResults(url, callback, errCallback) {
      var fetchURL = 'http://www.whateverorigin.org/get?url=' +
            encodeURIComponent(url) + '&callback=?';

      $.getJSON(fetchURL, function(result) {
        if (result.status.http_code == 200 &&
            result.status.content_type.match(/^text\/html/)) {
          console.log("Processing...");
          var results = processResults(result.contents);
          if (callback) callback(results);
        } else {
          console.log("Error...");
          if (errCallback) errCallback();
        }
      });
  }

  this.fetch = fetchResults;

};
